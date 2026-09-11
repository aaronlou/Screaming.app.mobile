import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SensitivityLevel } from '../audio/level';
import type { LanguagePreference } from '../i18n';
import type { ScreamMetrics, ScreamSession } from '../types';
import { emptySummary, type HistorySummary } from '../types';

/**
 * Local persistence.
 *
 * Everything the app knows lives on the device. There is no account, no sync
 * and no network call in this layer — which is exactly what the privacy promise
 * on the home screen commits to.
 *
 * Stored payloads are versioned. Anything that fails validation on read is
 * dropped rather than crashing the app, because a corrupt history is an
 * inconvenience and a crash on launch is a one-star review.
 */

const HISTORY_KEY = 'screaming.history.v1';
const SETTINGS_KEY = 'screaming.settings.v1';
const MIC_START_KEY = 'screaming.micstart.v1';

/** Keep the stored history bounded; the UI only ever shows recent items. */
export const MAX_STORED_SESSIONS = 200;

// ---------------------------------------------------------------------------
// Microphone start sentinel
// ---------------------------------------------------------------------------

/**
 * A crash sentinel for microphone start-up.
 *
 * `AudioStream.start()` can abort the whole process — notably when the device
 * has no audio input at all, where `AVAudioNode.installTapOnBus:` raises an
 * Objective-C exception that JavaScript cannot catch. See the long note in
 * `src/audio/useScreamSession.ts`.
 *
 * A native abort cannot be prevented from JS, but it *can* be noticed. We write
 * a marker immediately before starting the microphone and clear it the moment
 * the start succeeds. If the marker is still there on next launch, the app died
 * during start-up and we can tell the user something useful instead of letting
 * them hit the same wall blindly.
 *
 * The window is deliberately tiny — two awaits around one native call — so a
 * false positive needs the process to die in that exact gap (a user force-quit,
 * say). The UI copy is worded to stay true in that case too.
 */
export async function setMicStartPending(pending: boolean): Promise<void> {
  try {
    if (pending) {
      await AsyncStorage.setItem(MIC_START_KEY, 'pending');
    } else {
      await AsyncStorage.removeItem(MIC_START_KEY);
    }
  } catch {
    // If we cannot write the sentinel we simply lose crash detection for this
    // run; that is not worth failing a session over.
  }
}

/**
 * Read and clear the sentinel. Returns true when the previous run died while
 * starting the microphone.
 */
export async function consumeMicStartPending(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MIC_START_KEY);
    if (value !== 'pending') return false;
    await AsyncStorage.removeItem(MIC_START_KEY);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type LoudnessUnit = 'db' | 'percent';

export type AppSettings = {
  language: LanguagePreference;
  units: LoudnessUnit;
  haptics: boolean;
  sensitivity: SensitivityLevel;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
  units: 'db',
  haptics: true,
  sensitivity: 'normal',
};

const LANGUAGES: readonly LanguagePreference[] = ['system', 'en', 'zh'];
const UNITS: readonly LoudnessUnit[] = ['db', 'percent'];
const SENSITIVITIES: readonly SensitivityLevel[] = ['low', 'normal', 'high'];

/** Repair whatever came out of storage into a valid `AppSettings`. */
function coerceSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const value = raw as Partial<Record<keyof AppSettings, unknown>>;

  return {
    language: LANGUAGES.includes(value.language as LanguagePreference)
      ? (value.language as LanguagePreference)
      : DEFAULT_SETTINGS.language,
    units: UNITS.includes(value.units as LoudnessUnit)
      ? (value.units as LoudnessUnit)
      : DEFAULT_SETTINGS.units,
    haptics: typeof value.haptics === 'boolean' ? value.haptics : DEFAULT_SETTINGS.haptics,
    sensitivity: SENSITIVITIES.includes(value.sensitivity as SensitivityLevel)
      ? (value.sensitivity as SensitivityLevel)
      : DEFAULT_SETTINGS.sensitivity,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return coerceSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A failed settings write is not worth interrupting the user for; the
    // in-memory value is still correct for this session.
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coerceMetrics(raw: unknown): ScreamMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<Record<keyof ScreamMetrics, unknown>>;

  if (!isFiniteNumber(value.score) || !isFiniteNumber(value.peakDb)) return null;

  const curve = Array.isArray(value.curve)
    ? value.curve.filter(isFiniteNumber).map((point) => Math.max(0, Math.min(1, point)))
    : [];

  return {
    peakLevel: isFiniteNumber(value.peakLevel) ? value.peakLevel : 0,
    avgLevel: isFiniteNumber(value.avgLevel) ? value.avgLevel : 0,
    peakDb: value.peakDb,
    avgDb: isFiniteNumber(value.avgDb) ? value.avgDb : 0,
    screamMs: isFiniteNumber(value.screamMs) ? value.screamMs : 0,
    durationMs: isFiniteNumber(value.durationMs) ? value.durationMs : 0,
    energy: isFiniteNumber(value.energy) ? value.energy : 0,
    screamEnergy: isFiniteNumber(value.screamEnergy) ? value.screamEnergy : 0,
    curve,
    score: value.score,
  };
}

function coerceSession(raw: unknown): ScreamSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<Record<keyof ScreamSession, unknown>>;

  if (typeof value.id !== 'string' || !isFiniteNumber(value.startedAt)) return null;

  const metrics = coerceMetrics(value.metrics);
  if (!metrics) return null;

  return {
    id: value.id,
    startedAt: value.startedAt,
    metrics,
    percentile: isFiniteNumber(value.percentile) ? value.percentile : 50,
    wasteAirLiters: isFiniteNumber(value.wasteAirLiters) ? value.wasteAirLiters : 0,
  };
}

/** Newest first. */
export async function loadHistory(): Promise<ScreamSession[]> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(coerceSession)
      .filter((session): session is ScreamSession => session !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

/**
 * Write the whole list. Callers own the list and pass the authoritative copy,
 * which keeps the list maths in one place and out of React state updaters.
 */
export async function saveHistory(sessions: ScreamSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(sessions.slice(0, MAX_STORED_SESSIONS)),
    );
  } catch {
    // Ignore: the caller optimistically updated in-memory state already.
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    // Nothing useful to do; the in-memory list is cleared by the caller anyway.
  }
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function summarize(sessions: ScreamSession[]): HistorySummary {
  if (sessions.length === 0) return emptySummary();

  const scoreTotal = sessions.reduce((sum, session) => sum + session.metrics.score, 0);
  const bestScore = sessions.reduce(
    (best, session) => Math.max(best, session.metrics.score),
    0,
  );

  return {
    count: sessions.length,
    bestScore,
    averageScore: Math.round(scoreTotal / sessions.length),
    totalScreamMs: sessions.reduce((sum, session) => sum + session.metrics.screamMs, 0),
    totalWasteAirLiters: sessions.reduce((sum, session) => sum + session.wasteAirLiters, 0),
    lastSession: sessions[0] ?? null,
  };
}
