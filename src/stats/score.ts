/**
 * Scoring — turn one session's measurements into a single 0..100 number.
 *
 * The score is deliberately a blend rather than "just peak dB", because the
 * product goal is catharsis, not competitiveness. Rewarding only raw volume
 * would push people to hurt their throats; rewarding sustain and total energy
 * rewards the actual behaviour we want — a long, committed release.
 */

export type ScoreInputs = {
  /** Loudest normalised level reached, 0..1. */
  peakLevel: number;
  /** Milliseconds spent at or above the scream threshold. */
  screamMs: number;
  /** Integral of level over time while screaming, in level-seconds. */
  screamEnergy: number;
};

export const SCORE_WEIGHTS = {
  peak: 0.45,
  sustain: 0.35,
  energy: 0.2,
} as const;

/** Eight seconds of sustained screaming earns full marks on the sustain term. */
export const SUSTAIN_TARGET_MS = 8000;

/** ~6 level-seconds is a full-marks energy term (e.g. 8s at level 0.75). */
export const ENERGY_TARGET = 6;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Composite score in 0..100.
 *
 * Peak alone can be gamed by one sharp bark, and sustain alone by humming
 * loudly, so the three terms are intentionally different in character.
 */
export function computeScore({ peakLevel, screamMs, screamEnergy }: ScoreInputs): number {
  const peakTerm = clamp01(peakLevel);
  const sustainTerm = clamp01(screamMs / SUSTAIN_TARGET_MS);
  const energyTerm = clamp01(screamEnergy / ENERGY_TARGET);

  const weighted =
    peakTerm * SCORE_WEIGHTS.peak +
    sustainTerm * SCORE_WEIGHTS.sustain +
    energyTerm * SCORE_WEIGHTS.energy;

  return Math.round(clamp01(weighted) * 100);
}

/**
 * Six named tiers, evenly spaced across the score range.
 * Index 1..6 so it maps directly onto the `result.tier.N` translation keys.
 */
export function scoreTier(score: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (score < 20) return 1;
  if (score < 38) return 2;
  if (score < 56) return 3;
  if (score < 74) return 4;
  if (score < 90) return 5;
  return 6;
}
