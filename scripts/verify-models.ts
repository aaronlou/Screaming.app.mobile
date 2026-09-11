/**
 * Sanity checks for the pure model modules.
 *
 * These four modules (`level`, `score`, `global`, `waste`) are deliberately
 * side-effect-free and free of React Native imports, which means they run
 * directly under Node:
 *
 *     npx tsx scripts/verify-models.ts
 *
 * This is not a substitute for a real test runner — see the roadmap in the
 * README — but it catches the class of bug that matters most here: silently
 * wrong maths that still renders a plausible-looking number.
 */

import {
  classifyLevel,
  dbfsToSpl,
  isScreaming,
  LEVEL_THRESHOLDS,
  levelToSpl,
  rmsToDbfs,
  smoothLevel,
  splToLevel,
  SPL_MAX,
  SPL_MIN,
} from '../src/audio/level';
import { computeScore, scoreTier } from '../src/stats/score';
import {
  distributionBins,
  medianScore,
  MODELLED_BASELINE,
  normalCdf,
  percentileForScore,
  scoreForPercentile,
} from '../src/stats/global';
import { toBalloons, wasteAirLiters } from '../src/stats/waste';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

function near(label: string, actual: number, expected: number, tolerance: number): void {
  check(
    label,
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} ±${tolerance}, got ${actual}`,
  );
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
section('level.ts — amplitude mapping');
// ---------------------------------------------------------------------------

// Full-scale and silence should land at the documented ends of the range.
near('rms 1.0 → 0 dBFS', rmsToDbfs(1), 0, 0.001);
check('rms 0 → very negative dBFS', rmsToDbfs(0) < -100, `got ${rmsToDbfs(0)}`);

// The documented anchor points from level.ts.
near('-60 dBFS → 35 dB SPL', dbfsToSpl(-60), 35, 0.001);
near('-30 dBFS → 65 dB SPL', dbfsToSpl(-30), 65, 0.001);
near('  0 dBFS → 95 dB SPL', dbfsToSpl(0), 95, 0.001);

// Sensitivity trim shifts by exactly ±6 dB and stays clamped.
near('high sensitivity +6', dbfsToSpl(-30, 'high'), 71, 0.001);
near('low sensitivity -6', dbfsToSpl(-30, 'low'), 59, 0.001);
check('SPL is clamped at the top', dbfsToSpl(0, 'high') <= SPL_MAX);
check('SPL is clamped at the bottom', dbfsToSpl(-160, 'low') >= SPL_MIN);

// Normalisation and its inverse must agree.
near('SPL_MIN → level 0', splToLevel(SPL_MIN), 0, 1e-9);
near('SPL_MAX → level 1', splToLevel(SPL_MAX), 1, 1e-9);
near('level clamps below 0', splToLevel(SPL_MIN - 50), 0, 1e-9);
near('level clamps above 1', splToLevel(SPL_MAX + 50), 1, 1e-9);

// Round trips only hold inside the representable range; out-of-range values
// clamp by design, which is asserted separately below.
for (const spl of [35, 50, 65, 77, 95]) {
  near(`levelToSpl(splToLevel(${spl})) round trip`, levelToSpl(splToLevel(spl)), spl, 1e-6);
}

check('SPL above the ceiling clamps', splToLevel(110) === 1);
check('SPL below the floor clamps', splToLevel(10) === 0);

// Band boundaries.
check('level 0 → quiet', classifyLevel(0) === 'quiet');
check('level 0.3 → talking', classifyLevel(0.3) === 'talking');
check('level 0.5 → loud', classifyLevel(0.5) === 'loud');
check('level 0.9 → screaming', classifyLevel(0.9) === 'screaming');
check('threshold itself counts as screaming', isScreaming(LEVEL_THRESHOLDS.screaming));
check('just below threshold is not', !isScreaming(LEVEL_THRESHOLDS.screaming - 1e-9));

// The scream threshold should sit in a believable place on the SPL scale.
const thresholdSpl = levelToSpl(LEVEL_THRESHOLDS.screaming);
check(
  `scream threshold is 75–82 dB SPL (got ${thresholdSpl.toFixed(1)})`,
  thresholdSpl >= 75 && thresholdSpl <= 82,
);

// ---------------------------------------------------------------------------
section('level.ts — envelope follower');
// ---------------------------------------------------------------------------

// Attack must be faster than release: up quickly, down slowly.
const afterRise = smoothLevel(0, 1, 50);
const afterFall = smoothLevel(1, 0, 50);
check(
  `attack (${afterRise.toFixed(3)}) outpaces release (${(1 - afterFall).toFixed(3)})`,
  afterRise > 1 - afterFall,
);
check('a zero delta is a no-op', smoothLevel(0.5, 1, 0) === 1);
check('repeated steps converge upward', smoothLevel(smoothLevel(0, 1, 50), 1, 50) > afterRise);

// ---------------------------------------------------------------------------
section('score.ts — composite scoring');
// ---------------------------------------------------------------------------

const zero = computeScore({ peakLevel: 0, screamMs: 0, screamEnergy: 0 });
check('silence scores 0', zero === 0, `got ${zero}`);

const perfect = computeScore({ peakLevel: 1, screamMs: 8000, screamEnergy: 6 });
check('a full-throated 8s scream scores 100', perfect === 100, `got ${perfect}`);

// Monotonic in each term, holding the others fixed.
const base = computeScore({ peakLevel: 0.7, screamMs: 4000, screamEnergy: 3 });
check(
  'louder scores higher',
  computeScore({ peakLevel: 0.9, screamMs: 4000, screamEnergy: 3 }) > base,
);
check(
  'longer scores higher',
  computeScore({ peakLevel: 0.7, screamMs: 8000, screamEnergy: 3 }) > base,
);
check(
  'more energy scores higher',
  computeScore({ peakLevel: 0.7, screamMs: 4000, screamEnergy: 6 }) > base,
);

// One sharp bark should not beat a sustained release.
const bark = computeScore({ peakLevel: 1, screamMs: 300, screamEnergy: 0.3 });
const sustained = computeScore({ peakLevel: 0.82, screamMs: 9000, screamEnergy: 6 });
check(
  `sustained release (${sustained}) beats a one-off bark (${bark})`,
  sustained > bark,
);

check('score is clamped to 0..100', computeScore({ peakLevel: 5, screamMs: 1e9, screamEnergy: 1e9 }) === 100);
check('tier 1 for a whisper', scoreTier(5) === 1);
check('tier 6 at the top', scoreTier(100) === 6);
check('tiers are monotonic', scoreTier(10) <= scoreTier(45) && scoreTier(45) <= scoreTier(95));

// ---------------------------------------------------------------------------
section('global.ts — distribution maths');
// ---------------------------------------------------------------------------

check('normalCdf at the mean is 0.5', Math.abs(normalCdf(48, 48, 19) - 0.5) < 1e-9);
check('normalCdf is monotonic', normalCdf(30, 48, 19) < normalCdf(60, 48, 19));
near('normalCdf far left → 0', normalCdf(-100, 48, 19), 0, 1e-6);
near('normalCdf far right → 1', normalCdf(200, 48, 19), 1, 1e-6);

// Percentile is monotonic and never reports a cruel or dishonest extreme.
let previous = 0;
let monotonic = true;
for (let score = 0; score <= 100; score += 5) {
  const pct = percentileForScore(score);
  if (pct < previous) monotonic = false;
  if (pct < 1 || pct > 99) monotonic = false;
  previous = pct;
}
check('percentile is monotonic and clamped to 1..99', monotonic);

check(
  'the median score sits at ~50th percentile',
  Math.abs(percentileForScore(medianScore()) - 50) <= 1,
  `got ${percentileForScore(medianScore())}`,
);

// The inverse must actually invert, or the axis markers would be misplaced.
let worstInverseError = 0;
for (let pct = 2; pct <= 98; pct += 2) {
  const roundTripped = percentileForScore(scoreForPercentile(pct));
  worstInverseError = Math.max(worstInverseError, Math.abs(roundTripped - pct));
}
check(
  `scoreForPercentile inverts percentileForScore (worst error ${worstInverseError.toFixed(1)} pts)`,
  worstInverseError <= 1,
);

const bins = distributionBins(24);
check('produces the requested bin count', bins.length === 24, `got ${bins.length}`);
check('heights are normalised to 0..1', bins.every((b) => b.height >= 0 && b.height <= 1));
check(
  'the tallest bin is exactly 1',
  Math.abs(Math.max(...bins.map((b) => b.height)) - 1) < 1e-9,
);
check('bins are contiguous', bins.every((b, i) => i === 0 || Math.abs(b.from - bins[i - 1].to) < 1e-9));
check(
  'bins stay inside the score range',
  bins[0].from >= 0 && bins[bins.length - 1].to <= 100,
);
// The mode of a normal distribution should be near its mean.
const tallest = bins.reduce((best, b) => (b.height > best.height ? b : best));
check(
  `the mode sits near the baseline mean (${tallest.center.toFixed(0)} vs ${MODELLED_BASELINE.mean})`,
  Math.abs(tallest.center - MODELLED_BASELINE.mean) <= 6,
);

// ---------------------------------------------------------------------------
section('waste.ts — airflow model');
// ---------------------------------------------------------------------------

near('zero energy → zero litres', wasteAirLiters(0), 0, 1e-9);
check('energy cannot produce negative volume', wasteAirLiters(-5) === 0);

// A 5-second scream at the threshold should land in the physiological band.
const fiveSecondsAtThreshold = wasteAirLiters(5 * LEVEL_THRESHOLDS.screaming);
check(
  `5s at threshold ≈ 11–16 L (got ${fiveSecondsAtThreshold.toFixed(1)}, ${(fiveSecondsAtThreshold / 5).toFixed(1)} L/s)`,
  fiveSecondsAtThreshold >= 11 && fiveSecondsAtThreshold <= 16,
);

const rateAtThreshold = wasteAirLiters(1 * LEVEL_THRESHOLDS.screaming);
check(
  `threshold airflow is 2–4 L/s (got ${rateAtThreshold.toFixed(1)})`,
  rateAtThreshold >= 2 && rateAtThreshold <= 4,
);

check('balloon conversion is positive', toBalloons(24) > 0);
near('24 L is 2 balloons', toBalloons(24), 2, 1e-9);

// ---------------------------------------------------------------------------
console.log(
  `\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);
