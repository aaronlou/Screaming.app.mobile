/**
 * Global population baseline — powers "where do you rank".
 *
 * ⚠️  PLACEHOLDER DATA.
 *
 * This MVP is local-first and has no backend, so there is no real crowd to rank
 * against. What follows is a *modelled* score distribution, and the UI labels it
 * as such — we never claim a user count we do not have.
 *
 * The seam is deliberately narrow: the UI only ever calls `percentileForScore`,
 * `scoreForPercentile` and `distributionBins`. When a real backend lands, fetch
 * a `GlobalBaseline` and pass it in; nothing else in the app has to change.
 */

export type GlobalBaseline = {
  /** Mean score across the population, 0..100. */
  mean: number;
  /** Standard deviation of scores. */
  stdDev: number;
  /** How many sessions this baseline was computed from. 0 = modelled. */
  sampleSize: number;
  /** ISO timestamp, or null when the baseline is hard-coded. */
  updatedAt: string | null;
};

/**
 * A right-leaning bell curve: most people land in the forties and fifties,
 * with a thin tail of genuinely terrifying screamers. Chosen so that a
 * committed scream scores well without the top of the range being unreachable.
 */
export const MODELLED_BASELINE: GlobalBaseline = {
  mean: 48,
  stdDev: 19,
  sampleSize: 0,
  updatedAt: null,
};

/** True when we are ranking against a model rather than real users. */
export function isModelled(baseline: GlobalBaseline): boolean {
  return baseline.sampleSize === 0;
}

// ---------------------------------------------------------------------------
// Normal distribution maths
// ---------------------------------------------------------------------------

/**
 * Error function, Abramowitz & Stegun 7.1.26.
 * Absolute error below 1.5e-7 — far more precision than a percentile badge needs.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);

  return sign * y;
}

/** Cumulative distribution function of a normal distribution. */
export function normalCdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x < mean ? 0 : 1;
  return 0.5 * (1 + erf((x - mean) / (stdDev * Math.SQRT2)));
}

/** Probability density function of a normal distribution. */
export function normalPdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0;
  const z = (x - mean) / stdDev;
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
}

// ---------------------------------------------------------------------------
// Public API used by the UI
// ---------------------------------------------------------------------------

/**
 * What share of the population this score beats, as 0..100.
 *
 * We never report 0% or 100%: telling someone they beat nobody is unkind, and
 * telling them they beat everybody is a lie. Clamped to 1..99.
 */
export function percentileForScore(
  score: number,
  baseline: GlobalBaseline = MODELLED_BASELINE,
): number {
  const pct = normalCdf(score, baseline.mean, baseline.stdDev) * 100;
  return Math.max(1, Math.min(99, Math.round(pct)));
}

/** Inverse of `percentileForScore`, used to place axis ticks. */
export function scoreForPercentile(
  percentile: number,
  baseline: GlobalBaseline = MODELLED_BASELINE,
): number {
  const p = Math.max(0.001, Math.min(0.999, percentile / 100));
  return baseline.mean + baseline.stdDev * Math.SQRT2 * inverseErf(2 * p - 1);
}

/** The score a typical person gets — shown as a reference marker. */
export function medianScore(baseline: GlobalBaseline = MODELLED_BASELINE): number {
  return Math.round(baseline.mean);
}

export type DistributionBin = {
  /** Inclusive lower bound of the score range. */
  from: number;
  /** Exclusive upper bound. */
  to: number;
  /** Midpoint, used for hit-testing and labels. */
  center: number;
  /** Relative height, 0..1, normalised so the tallest bin is 1. */
  height: number;
};

/**
 * Sample the baseline into chart-ready bins.
 *
 * Heights are normalised against the tallest bin so the caller can lay out bars
 * without knowing anything about the underlying distribution.
 */
export function distributionBins(
  binCount = 24,
  baseline: GlobalBaseline = MODELLED_BASELINE,
): DistributionBin[] {
  const spread = baseline.stdDev * 4;
  const from = Math.max(0, baseline.mean - spread);
  const to = Math.min(100, baseline.mean + spread);
  const width = (to - from) / binCount;

  const raw = Array.from({ length: binCount }, (_, index) => {
    const binFrom = from + index * width;
    // Pin the final edge to `to` rather than accumulating `from + width`, so
    // floating-point drift cannot push the last bin past the score range.
    const binTo = index === binCount - 1 ? to : binFrom + width;
    return {
      from: binFrom,
      to: binTo,
      center: (binFrom + binTo) / 2,
      density: normalPdf(binFrom + width / 2, baseline.mean, baseline.stdDev),
    };
  });

  const maxDensity = raw.reduce((max, bin) => Math.max(max, bin.density), 0) || 1;

  return raw.map((bin) => ({
    from: bin.from,
    to: bin.to,
    center: bin.center,
    height: bin.density / maxDensity,
  }));
}

/**
 * Inverse error function — needed only to place reference markers on the chart.
 * Uses a rational approximation good to ~1e-4, which is invisible on a 24-bar
 * histogram.
 */
function inverseErf(x: number): number {
  const clamped = Math.max(-0.9999, Math.min(0.9999, x));
  const a = 0.147;
  const lnTerm = Math.log(1 - clamped * clamped);
  const first = 2 / (Math.PI * a) + lnTerm / 2;
  const second = lnTerm / a;
  const sign = clamped < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.sqrt(first * first - second) - first);
}
