/**
 * The "stale air released" metric.
 *
 * This is the playful half of the results screen — the physical, felt part of
 * catharsis. It is an *estimate*, and the UI says so, but the model behind it is
 * grounded in real respiratory numbers rather than invented:
 *
 *   - Quiet breathing moves roughly 0.5 L/s.
 *   - A forceful shout or scream moves roughly 2–4 L/s.
 *
 * So we scale airflow linearly with intensity and integrate it over the time
 * spent screaming. At the scream threshold (level ≈ 0.7) this yields ~2.8 L/s,
 * which sits right in the middle of the physiological range.
 *
 * Because the session already accumulates `screamEnergy` (∫ level dt over the
 * screaming period, in level-seconds), the integral here is just a
 * multiplication — no extra bookkeeping during the session.
 */

/** Litres per second at a full-intensity scream (level = 1). */
export const AIRFLOW_AT_FULL_LPS = 4;

/** Litres per second at the scream threshold (level = 0.7). ≈2.8 L/s. */
export const AIRFLOW_NEAR_REST_LPS = 0;

/** A standard party balloon holds roughly this much air. */
export const LITERS_PER_BALLOON = 12;

/**
 * Convert accumulated level-seconds into litres of air exhaled.
 *
 * `screamEnergy` is `Σ(level × Δt)` over samples at or above the scream
 * threshold, so this is a genuine time integral of the airflow curve.
 */
export function wasteAirLiters(screamEnergy: number): number {
  const litres = screamEnergy * AIRFLOW_AT_FULL_LPS;
  return Math.max(0, litres);
}

/** Litres → number of party balloons, for the fun comparison line. */
export function toBalloons(litres: number): number {
  return litres / LITERS_PER_BALLOON;
}

/** One decimal place is the most precision this model can honestly claim. */
export function formatLiters(litres: number): string {
  if (litres < 10) return litres.toFixed(1);
  return Math.round(litres).toString();
}
