/**
 * Acoustic model — turns raw microphone amplitude into numbers a human cares
 * about.
 *
 * ── Why we compute this ourselves ──────────────────────────────────────────
 * We capture raw PCM from `expo-audio`'s `useAudioStream` and compute RMS in
 * JS, rather than relying on the recorder's `metering` field. Two reasons:
 *
 *   1. Reliability. Metering is only populated by the native *recorder*, and
 *      its availability has historically varied by platform and SDK version.
 *   2. Privacy. A stream has no file behind it. There is no temporary audio
 *      file to remember to delete, because none is ever created.
 *
 * ── dBFS vs dB SPL ─────────────────────────────────────────────────────────
 * PCM gives us dBFS (decibels relative to full scale): 0 dBFS is the loudest
 * value the converter can represent and everything quieter is negative.
 *
 * Humans care about dB SPL (sound pressure level) — "how loud is this in the
 * room". Converting between them needs a calibrated reference, because the
 * answer depends on microphone sensitivity, device model, and whether the OS
 * applied automatic gain control. We cannot measure true SPL from software
 * alone, so we apply a single documented offset and label the result as an
 * estimate in the UI. That is honest, and it is consistent across sessions on
 * the same device, which is what the scoring actually needs.
 */

/** Below this, we treat the microphone as hearing nothing. */
export const DBFS_FLOOR = -60;

/**
 * dBFS + this offset ≈ dB SPL.
 *
 * 95 puts the range in a believable place for a phone held at arm's length:
 *   -60 dBFS → 35 dB SPL  (quiet room)
 *   -30 dBFS → 65 dB SPL  (normal conversation)
 *   -10 dBFS → 85 dB SPL  (a shout)
 *     0 dBFS → 95 dB SPL  (a full scream)
 */
export const SPL_OFFSET_DB = 95;

/**
 * The quietest and loudest SPL we can actually derive.
 *
 * These are *derived* from the two constants above rather than chosen
 * independently, and that is the whole point. An earlier version hard-coded
 * `SPL_MIN = 30, SPL_MAX = 120`, which silently broke the product: a normalised
 * level of 1.0 then required 120 dB SPL, which needs +25 dBFS — impossible, since
 * PCM saturates at 0 dBFS. The top of the scale was unreachable, so the thermal
 * ramp could never reach gold no matter how hard anyone screamed.
 *
 * Anchoring the range to the real converter limits keeps level 0.0 at true
 * silence and level 1.0 at genuine clipping.
 */
export const SPL_MAX = SPL_OFFSET_DB; // 0 dBFS — the loudest PCM can represent
export const SPL_MIN = SPL_OFFSET_DB + DBFS_FLOOR; // -60 dBFS — our noise floor

/**
 * User-adjustable trim, for microphones that run hot or cold.
 * Applied on top of `SPL_OFFSET_DB`.
 */
export type SensitivityLevel = 'low' | 'normal' | 'high';

export const SENSITIVITY_OFFSET: Record<SensitivityLevel, number> = {
  low: -6,
  normal: 0,
  high: 6,
};

export const SENSITIVITY_LEVELS: readonly SensitivityLevel[] = ['low', 'normal', 'high'] as const;

// ---------------------------------------------------------------------------
// Amplitude → dBFS
// ---------------------------------------------------------------------------

/**
 * Root-mean-square amplitude of a PCM frame buffer, in 0..1.
 *
 * `data` is interleaved float32 PCM as delivered by `AudioStreamBuffer`, with
 * sample values normalised to -1..1.
 */
export function rmsFromPcm(data: Float32Array): number {
  if (data.length === 0) return 0;

  let sumOfSquares = 0;
  for (let i = 0; i < data.length; i += 1) {
    const sample = data[i];
    sumOfSquares += sample * sample;
  }
  return Math.sqrt(sumOfSquares / data.length);
}

/** Convert linear RMS amplitude (0..1) to dBFS. */
export function rmsToDbfs(rms: number): number {
  // Guard against log10(0) === -Infinity.
  const safe = Math.max(rms, 1e-7);
  return 20 * Math.log10(safe);
}

/** Peak absolute amplitude of a PCM frame buffer, in 0..1. */
export function peakFromPcm(data: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    const magnitude = Math.abs(data[i]);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

// ---------------------------------------------------------------------------
// dBFS → dB SPL → normalised level
// ---------------------------------------------------------------------------

export function dbfsToSpl(dbfs: number, sensitivity: SensitivityLevel = 'normal'): number {
  const spl = dbfs + SPL_OFFSET_DB + SENSITIVITY_OFFSET[sensitivity];
  return Math.max(SPL_MIN, Math.min(SPL_MAX, spl));
}

export function splToDbfs(spl: number, sensitivity: SensitivityLevel = 'normal'): number {
  return spl - SPL_OFFSET_DB - SENSITIVITY_OFFSET[sensitivity];
}

/**
 * Normalise an SPL reading onto 0..1, where 0 is a whisper and 1 is a scream.
 * Linear in dB, which matches how loudness is perceived.
 */
export function splToLevel(spl: number): number {
  const level = (spl - SPL_MIN) / (SPL_MAX - SPL_MIN);
  return Math.max(0, Math.min(1, level));
}

export function levelToSpl(level: number): number {
  return SPL_MIN + Math.max(0, Math.min(1, level)) * (SPL_MAX - SPL_MIN);
}

/** Convenience: one PCM frame straight through to a 0..1 level. */
export function pcmToLevel(data: Float32Array, sensitivity: SensitivityLevel = 'normal'): number {
  return splToLevel(dbfsToSpl(rmsToDbfs(rmsFromPcm(data)), sensitivity));
}

// ---------------------------------------------------------------------------
// Loudness bands
// ---------------------------------------------------------------------------

export type LoudnessBand = 'quiet' | 'talking' | 'loud' | 'screaming';

/**
 * Band boundaries as normalised levels. These are the numbers the whole app
 * agrees on for "is this person actually screaming".
 */
export const LEVEL_THRESHOLDS = {
  /** Below this it is ambient noise. */
  quiet: 0.2,
  /** Above this it is a raised voice. */
  talking: 0.45,
  /**
   * At or above this we count the user as screaming. ~0.70 ≈ 78 dB SPL,
   * which is a genuine shout rather than loud speech.
   */
  screaming: 0.7,
} as const;

export function classifyLevel(level: number): LoudnessBand {
  if (level < LEVEL_THRESHOLDS.quiet) return 'quiet';
  if (level < LEVEL_THRESHOLDS.talking) return 'talking';
  if (level < LEVEL_THRESHOLDS.screaming) return 'loud';
  return 'screaming';
}

/** True when this level should accumulate "time spent screaming". */
export function isScreaming(level: number): boolean {
  return level >= LEVEL_THRESHOLDS.screaming;
}

// ---------------------------------------------------------------------------
// Envelope follower
// ---------------------------------------------------------------------------

/**
 * One-pole envelope follower with separate attack and release times.
 *
 * A raw RMS reading jitters frame to frame, which makes a needle or a bar look
 * broken. Real meters smooth this asymmetrically: snap up so a sudden scream
 * registers instantly, and fall away slowly so the display stays readable.
 */
export function smoothLevel(
  previous: number,
  next: number,
  deltaMs: number,
  attackMs = 60,
  releaseMs = 260,
): number {
  if (deltaMs <= 0) return next;

  const isRising = next > previous;
  const tau = Math.max(1, isRising ? attackMs : releaseMs);
  // Exponential approach: 1 - e^(-dt/tau)
  const alpha = 1 - Math.exp(-deltaMs / tau);
  return previous + (next - previous) * alpha;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Round to a whole dB — sub-decibel precision is noise, not signal. */
export function roundDb(spl: number): number {
  return Math.round(spl);
}

/** `1:07` style clock for anything longer than a minute, else `7.4s`. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Compact duration for stat tiles: `0:07`, `2:14`. */
export function formatDurationShort(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
