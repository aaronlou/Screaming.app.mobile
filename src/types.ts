/**
 * Domain types shared across the audio engine, storage and UI.
 */

/**
 * Everything measured during one scream, plus the derived score.
 *
 * Nothing here is audio. `curve` is a downsampled array of loudness levels —
 * a graph, not a recording, and it cannot be played back or reconstructed into
 * speech.
 */
export type ScreamMetrics = {
  /** Loudest normalised level reached, 0..1. */
  peakLevel: number;
  /** Mean normalised level across the whole session, 0..1. */
  avgLevel: number;
  /** Loudest reading in estimated dB SPL. */
  peakDb: number;
  /** Mean reading while screaming, in estimated dB SPL. */
  avgDb: number;
  /** Milliseconds spent at or above the scream threshold. */
  screamMs: number;
  /** Total milliseconds from the first moment of the live phase to the stop. */
  durationMs: number;
  /** ∫ level dt over the entire session, in level-seconds. */
  energy: number;
  /** ∫ level dt over screaming samples only, in level-seconds. */
  screamEnergy: number;
  /** Downsampled loudness curve, oldest first. Values 0..1. */
  curve: number[];
  /** Composite score, 0..100. */
  score: number;
};

/**
 * A stored scream.
 *
 * `percentile` and `wasteAirLiters` are frozen at record time on purpose: the
 * baseline they were computed against will change, and a user's history should
 * not silently rewrite itself.
 */
export type ScreamSession = {
  id: string;
  /** Epoch milliseconds. */
  startedAt: number;
  metrics: ScreamMetrics;
  /** Share of the population beaten, 1..99. */
  percentile: number;
  /** Estimated litres of air exhaled while screaming. */
  wasteAirLiters: number;
};

/** Aggregate figures shown on the home screen. */
export type HistorySummary = {
  count: number;
  bestScore: number;
  averageScore: number;
  totalScreamMs: number;
  totalWasteAirLiters: number;
  lastSession: ScreamSession | null;
};

export function emptySummary(): HistorySummary {
  return {
    count: 0,
    bestScore: 0,
    averageScore: 0,
    totalScreamMs: 0,
    totalWasteAirLiters: 0,
    lastSession: null,
  };
}

export function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
