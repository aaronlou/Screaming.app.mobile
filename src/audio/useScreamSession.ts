import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';

import {
  classifyLevel,
  dbfsToSpl,
  isScreaming,
  LEVEL_THRESHOLDS,
  levelToSpl,
  rmsFromPcm,
  rmsToDbfs,
  smoothLevel,
  splToLevel,
  SPL_MIN,
  type LoudnessBand,
  type SensitivityLevel,
} from './level';
import { computeScore } from '../stats/score';
import { setMicStartPending } from '../storage/store';
import type { ScreamMetrics } from '../types';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Seconds of countdown before the live phase begins. */
export const COUNTDOWN_FROM = 3;
const COUNTDOWN_TICK_MS = 1000;

/**
 * Hard cap on a single scream, for the user's sake as much as the battery's.
 * Sustained screaming for longer than this risks real vocal strain.
 */
export const MAX_SESSION_MS = 30_000;

/** How often we fold the incoming audio into React state. 20 fps. */
const UI_INTERVAL_MS = 50;

/** Points kept in the live rolling waveform. */
const RECENT_POINTS = 56;

/** Points stored in the saved curve, regardless of session length. */
const CURVE_POINTS = 120;

/** Minimum gap between "you are still screaming" haptic pulses. */
const HAPTIC_PULSE_MS = 250;

const HAPTIC_BY_BAND: Record<LoudnessBand, Haptics.ImpactFeedbackStyle> = {
  quiet: Haptics.ImpactFeedbackStyle.Light,
  talking: Haptics.ImpactFeedbackStyle.Light,
  loud: Haptics.ImpactFeedbackStyle.Medium,
  screaming: Haptics.ImpactFeedbackStyle.Heavy,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * `ready` is the resting state after permission is granted but before the user
 * commits to the countdown.
 */
export type SessionPhase =
  | 'checking'
  | 'needsPermission'
  | 'ready'
  | 'countdown'
  | 'live'
  | 'finished'
  | 'error';

export type LiveSnapshot = {
  /** Smoothed current level, 0..1. */
  level: number;
  peakLevel: number;
  avgLevel: number;
  peakDb: number;
  avgDb: number;
  elapsedMs: number;
  screamMs: number;
  band: LoudnessBand;
  /** Rolling window of recent levels, oldest first. */
  recent: number[];
};

const EMPTY_LIVE: LiveSnapshot = {
  level: 0,
  peakLevel: 0,
  avgLevel: 0,
  peakDb: SPL_MIN,
  avgDb: SPL_MIN,
  elapsedMs: 0,
  screamMs: 0,
  band: 'quiet',
  recent: [],
};

type Accumulator = {
  startedAt: number;
  peakLevel: number;
  peakDbSpl: number;
  levelSum: number;
  levelCount: number;
  screamMs: number;
  screamLevelSum: number;
  screamLevelCount: number;
  energy: number;
  screamEnergy: number;
  rawCurve: number[];
};

export type UseScreamSessionOptions = {
  sensitivity: SensitivityLevel;
  hapticsEnabled: boolean;
};

export type ScreamSessionController = {
  phase: SessionPhase;
  countdown: number;
  live: LiveSnapshot;
  /** Populated once `phase === 'finished'`. */
  metrics: ScreamMetrics | null;
  error: string | null;
  /** False when the OS will no longer show a permission prompt. */
  canAskAgain: boolean;
  /** Begin the countdown. Assumes permission is already granted. */
  start: () => void;
  requestPermission: () => Promise<void>;
  openSettings: () => void;
  /** End the live phase early and compute the result. */
  stop: () => void;
  /** Return to `ready` so the user can go again. */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reduce an arbitrary-length series to `target` points by averaging buckets.
 * Keeps the stored curve a fixed size whatever the session length.
 */
function downsample(values: number[], target: number): number[] {
  if (values.length <= target) return values.slice();

  const bucketSize = values.length / target;
  const output: number[] = [];

  for (let i = 0; i < target; i += 1) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(values.length, Math.floor((i + 1) * bucketSize));

    let sum = 0;
    for (let j = start; j < end; j += 1) sum += values[j];
    output.push(end > start ? sum / (end - start) : 0);
  }

  return output;
}

function createAccumulator(): Accumulator {
  return {
    startedAt: Date.now(),
    peakLevel: 0,
    peakDbSpl: SPL_MIN,
    levelSum: 0,
    levelCount: 0,
    screamMs: 0,
    screamLevelSum: 0,
    screamLevelCount: 0,
    energy: 0,
    screamEnergy: 0,
    rawCurve: [],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Drives one scream session end to end.
 *
 * Audio handling is intentionally split across two clocks:
 *
 *   - `onBuffer` fires on the native side, potentially dozens of times a second.
 *     It does the minimum possible work (RMS over the frame) and writes into
 *     refs, so it never triggers a React render.
 *   - A 50 ms interval reads those refs, folds them into an accumulator, and
 *     pushes a single state update for the UI.
 *
 * Without that split, a fast microphone would drive hundreds of renders a
 * second and the UI would fall apart on a mid-range Android device.
 */
export function useScreamSession({
  sensitivity,
  hapticsEnabled,
}: UseScreamSessionOptions): ScreamSessionController {
  const [phase, setPhase] = useState<SessionPhase>('checking');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [live, setLive] = useState<LiveSnapshot>(EMPTY_LIVE);
  const [metrics, setMetrics] = useState<ScreamMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  // -- Mutable engine state (never triggers a render) ----------------------
  const isLiveRef = useRef(false);
  const envelopeRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const levelRef = useRef(0);
  const recentRef = useRef<number[]>([]);
  const accumulatorRef = useRef<Accumulator | null>(null);
  const lastBandRef = useRef<LoudnessBand>('quiet');
  const lastHapticAtRef = useRef(0);

  const sensitivityRef = useRef(sensitivity);
  const hapticsRef = useRef(hapticsEnabled);

  /** Guards against calling `stream.start()` more than once per warm-up. */
  const streamStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    hapticsRef.current = hapticsEnabled;
  }, [hapticsEnabled]);

  // -- Microphone ----------------------------------------------------------

  /**
   * Runs on the native audio thread's schedule. Deliberately allocation-light:
   * one typed-array view over the delivered buffer, one RMS pass, and a write
   * into a ref. No state updates, no logging, no object churn.
   */
  const handleBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (!isLiveRef.current) return;

    const samples = new Float32Array(buffer.data);
    const dbfs = rmsToDbfs(rmsFromPcm(samples));
    const raw = splToLevel(dbfsToSpl(dbfs, sensitivityRef.current));

    const now = Date.now();
    const deltaMs = lastFrameAtRef.current === 0 ? 16 : now - lastFrameAtRef.current;
    lastFrameAtRef.current = now;

    envelopeRef.current = smoothLevel(envelopeRef.current, raw, deltaMs);
    levelRef.current = envelopeRef.current;
  }, []);

  // Stable options object — a new identity here would tear down the native
  // stream on every render.
  const streamOptions = useMemo(
    () => ({
      sampleRate: 48000,
      channels: 1,
      encoding: 'float32' as const,
      onBuffer: handleBuffer,
    }),
    [handleBuffer],
  );

  const { stream } = useAudioStream(streamOptions);
  const streamRef = useRef(stream);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // -- Finishing -----------------------------------------------------------

  const finish = useCallback(() => {
    if (!isLiveRef.current) return;
    isLiveRef.current = false;
    // Allow the next `ready` to warm the microphone back up.
    streamStartedRef.current = false;

    try {
      streamRef.current?.stop();
    } catch {
      // The stream may already be gone if the OS revoked the mic. Nothing to do.
    }

    const accumulator = accumulatorRef.current;
    accumulatorRef.current = null;
    if (!accumulator) return;

    const durationMs = Date.now() - accumulator.startedAt;
    const avgLevel =
      accumulator.levelCount > 0 ? accumulator.levelSum / accumulator.levelCount : 0;

    // Average loudness should reflect the screaming, not the silence between
    // breaths, otherwise a great scream is diluted by the wind-up.
    const screamAvg =
      accumulator.screamLevelCount > 0
        ? accumulator.screamLevelSum / accumulator.screamLevelCount
        : avgLevel;

    setMetrics({
      peakLevel: accumulator.peakLevel,
      avgLevel,
      peakDb: Math.round(accumulator.peakDbSpl),
      avgDb: Math.round(levelToSpl(screamAvg)),
      screamMs: accumulator.screamMs,
      durationMs,
      energy: accumulator.energy,
      screamEnergy: accumulator.screamEnergy,
      curve: downsample(accumulator.rawCurve, CURVE_POINTS),
      score: computeScore({
        peakLevel: accumulator.peakLevel,
        screamMs: accumulator.screamMs,
        screamEnergy: accumulator.screamEnergy,
      }),
    });

    setPhase('finished');

    if (hapticsRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  // -- The 50 ms UI clock --------------------------------------------------

  const tick = useCallback(() => {
    const accumulator = accumulatorRef.current;
    if (!accumulator) return;

    const now = Date.now();
    const level = levelRef.current;

    accumulator.levelSum += level;
    accumulator.levelCount += 1;
    if (level > accumulator.peakLevel) accumulator.peakLevel = level;

    const spl = levelToSpl(level);
    if (spl > accumulator.peakDbSpl) accumulator.peakDbSpl = spl;

    const deltaSeconds = UI_INTERVAL_MS / 1000;
    accumulator.energy += level * deltaSeconds;
    accumulator.rawCurve.push(level);

    const screaming = isScreaming(level);
    if (screaming) {
      accumulator.screamMs += UI_INTERVAL_MS;
      accumulator.screamLevelSum += level;
      accumulator.screamLevelCount += 1;
      accumulator.screamEnergy += level * deltaSeconds;
    }

    // -- Haptics: pulse on band change, then keep a slow pulse going while
    //    the user is at full tilt so the phone feels like it is straining too.
    const band = classifyLevel(level);
    if (hapticsRef.current) {
      if (band !== lastBandRef.current) {
        lastBandRef.current = band;
        lastHapticAtRef.current = now;
        void Haptics.impactAsync(HAPTIC_BY_BAND[band]);
      } else if (band === 'screaming' && now - lastHapticAtRef.current >= HAPTIC_PULSE_MS) {
        lastHapticAtRef.current = now;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else {
      lastBandRef.current = band;
    }

    recentRef.current = [...recentRef.current, level].slice(-RECENT_POINTS);

    setLive({
      level,
      peakLevel: accumulator.peakLevel,
      avgLevel: accumulator.levelCount > 0 ? accumulator.levelSum / accumulator.levelCount : 0,
      peakDb: Math.round(accumulator.peakDbSpl),
      avgDb: Math.round(
        levelToSpl(
          accumulator.screamLevelCount > 0
            ? accumulator.screamLevelSum / accumulator.screamLevelCount
            : level,
        ),
      ),
      elapsedMs: now - accumulator.startedAt,
      screamMs: accumulator.screamMs,
      band,
      recent: recentRef.current,
    });

    if (now - accumulator.startedAt >= MAX_SESSION_MS) {
      finish();
    }
  }, [finish]);

  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(tick, UI_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, tick]);

  // -- Phase transitions ---------------------------------------------------

  const beginLive = useCallback(() => {
    accumulatorRef.current = createAccumulator();
    envelopeRef.current = 0;
    lastFrameAtRef.current = 0;
    levelRef.current = 0;
    recentRef.current = [];
    lastBandRef.current = 'quiet';
    lastHapticAtRef.current = 0;
    isLiveRef.current = true;
    setLive(EMPTY_LIVE);
    setPhase('live');
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown <= 0) {
      beginLive();
      return;
    }

    const id = setTimeout(() => setCountdown((value) => value - 1), COUNTDOWN_TICK_MS);
    return () => clearTimeout(id);
  }, [phase, countdown, beginLive]);

  const start = useCallback(() => {
    setError(null);
    setMetrics(null);
    setCountdown(COUNTDOWN_FROM);
    setPhase('countdown');
  }, []);

  const stop = useCallback(() => {
    finish();
  }, [finish]);

  const reset = useCallback(() => {
    isLiveRef.current = false;
    accumulatorRef.current = null;
    envelopeRef.current = 0;
    levelRef.current = 0;
    recentRef.current = [];
    setLive(EMPTY_LIVE);
    setMetrics(null);
    setError(null);
    setCountdown(COUNTDOWN_FROM);
    setPhase('ready');
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const response = await requestRecordingPermissionsAsync();
      setCanAskAgain(response.canAskAgain);
      setPhase(response.granted ? 'ready' : 'needsPermission');
    } catch {
      setCanAskAgain(false);
      setPhase('needsPermission');
    }
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  // -- Warm the microphone up as soon as we have permission ----------------
  //
  // Starting the stream takes a beat on real hardware. Doing it when we reach
  // `ready` — before the countdown — means the first syllable of the scream is
  // actually captured instead of being lost to the device spin-up.
  //
  // Guarded by a ref rather than by effect dependencies: `phase` changes twice
  // more during a session (countdown, live) and we must not call `start()` on
  // an already-running stream.

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'ready' || streamStartedRef.current) return;

    streamStartedRef.current = true;

    (async () => {
      try {
        // `doNotMix` is deliberate: if the user's music kept playing, the
        // microphone would measure the music as well as the scream.
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        });

        // ⚠️ KNOWN LIMITATION — this `try`/`catch` is not a real safety net for
        // the case where the device has no audio input at all.
        //
        // `AudioStream.start()` installs a tap on the input node, and when no
        // input exists `AVAudioNode.installTapOnBus:` raises an Objective-C
        // exception. ObjC exceptions are not JS errors, so nothing here catches
        // them: the process aborts. Verified on an iPhone 16 Pro simulator
        // hosted on a Mac with no audio input device, with this native
        // backtrace:
        //
        //   objc_exception_throw
        //   AUGraphNodeBaseV3::CreateRecordingTap
        //   AVAudioEngineImpl::InstallTapOnNode
        //   -[AVAudioNode installTapOnBus:bufferSize:format:block:]
        //   AudioStream.start()
        //
        // This cannot happen on real iPhone or iPad hardware, which always has
        // a built-in microphone — it is a development-environment and
        // hardware-failure case. `expo-audio` exposes `getAvailableInputs()`
        // only on the *recorder*, after preparation, so there is no way to
        // pre-flight the check for a stream from JavaScript today. Revisit if
        // expo-audio adds input enumeration to `AudioModule`.
        // Sentinel: if the process dies inside `start()`, this marker survives
        // and the next launch can explain what happened. Awaited, because it
        // has to reach disk before the native call that might abort.
        await setMicStartPending(true);
        await streamRef.current?.start();
        await setMicStartPending(false);
      } catch {
        streamStartedRef.current = false;
        await setMicStartPending(false);
        if (!mountedRef.current) return;
        setError('microphone');
        setPhase('error');
      }
    })();
  }, [phase]);

  // -- Permission check on mount ------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getRecordingPermissionsAsync();
        if (cancelled) return;
        setCanAskAgain(response.canAskAgain);

        if (response.granted) {
          setPhase('ready');
        } else {
          setPhase('needsPermission');
        }
      } catch {
        if (cancelled) return;
        setPhase('needsPermission');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // -- Never leave the microphone hot in the background --------------------

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && isLiveRef.current) {
        finish();
      }
    });
    return () => subscription.remove();
  }, [finish]);

  useEffect(
    () => () => {
      isLiveRef.current = false;
      try {
        streamRef.current?.stop();
      } catch {
        // Releasing an already-released stream is not worth surfacing.
      }
    },
    [],
  );

  return {
    phase,
    countdown,
    live,
    metrics,
    error,
    canAskAgain,
    start,
    requestPermission,
    openSettings,
    stop,
    reset,
  };
}

/** Re-exported so screens can render threshold hints without duplicating them. */
export { LEVEL_THRESHOLDS };
