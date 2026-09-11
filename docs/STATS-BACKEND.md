# Global stats backend — API contract

The MVP ships a **modelled** population baseline (`src/stats/global.ts`,
mean 48, σ 19) and says so in the UI. This document is the contract for
replacing it with real data.

The goal is one feature: **"you were louder than N% of screamers."**

---

## Non-negotiable constraints

These come from the product's privacy promise, which is enforced technically
rather than stated as policy:

1. **No audio ever leaves the device.** Not clips, not spectrograms, not
   embeddings. The client has no audio to send — capture reduces each PCM frame
   to a single RMS number and discards the frame.
2. **No accounts.** No email, no phone, no social login. A random,
   device-scoped install ID is the maximum identifier.
3. **Aggregates only, never rows.** The read path returns distribution
   parameters, never another user's session.
4. **The app must work fully offline.** The backend is an enhancement. If the
   request fails, the app falls back to the modelled baseline and the footnote
   stays visible.

---

## Write path

### `POST /v1/sessions`

Called once per completed scream, fire-and-forget, batched offline.

```jsonc
{
  "installId": "b3f1c2a4-...",   // random UUID, regenerated on reinstall
  "clientVersion": "1.0.0",
  "platform": "ios",             // "ios" | "android"
  "startedAt": "2026-03-04T21:14:07.221Z",

  "metrics": {
    "score": 73,
    "peakDb": 91,                // estimated dB SPL, not calibrated
    "avgDb": 78,
    "screamMs": 6200,
    "durationMs": 9100,
    "peakLevel": 0.87,
    "screamEnergy": 4.31
  }
}
```

**Deliberately absent:** the loudness curve. It is the one field that is
arguably personal — it is a behavioural fingerprint of someone's voice — and it
adds nothing to a distribution. Keep it on the device.

**Response:** `202 Accepted`, empty body. The client does not wait.

### Server-side handling

- **Reject outliers before they enter the baseline.** A score of 100 from a
  device sitting next to a stereo is not a scream. Drop the top and bottom 1%,
  and drop sessions with `screamMs < 500` or `durationMs < 1000`.
- **Rate limit per install ID** (e.g. 200/day). Trivial to script otherwise.
- **Never store the raw payload long-term.** Fold each session into a running
  histogram and discard the row. This is what makes the privacy claim survive a
  breach: after aggregation there is nothing to breach.

---

## Read path

### `GET /v1/baseline`

```jsonc
{
  "version": "2026-03-05T00:00:00Z",
  "cohort": "global",            // "global" | "ios" | "android" | region
  "sampleSize": 184320,
  "mean": 51.2,
  "stdDev": 18.7,
  "median": 49,
  "p10": 27,
  "p90": 76,
  "buckets": [                   // optional: real histogram, 24 bins over 0..100
    { "from": 0,  "to": 4.17, "count": 812 },
    { "from": 4.17, "to": 8.33, "count": 1544 }
  ]
}
```

`Cache-Control: public, max-age=3600`. The client caches it in AsyncStorage and
refreshes at most once a day.

**Why return buckets as well as parameters:** the chart currently derives its
shape from a normal PDF. Real scream scores will not be perfectly normal — they
will pile up just above the scream threshold and thin out at the top. Returning
actual buckets lets the histogram show the true shape while `percentileForScore`
keeps using the parameters. If `buckets` is absent the client falls back to
synthesising them, so the endpoint can ship before the histogram is ready.

---

## Minimum sample size

Below **1,000 sessions**, do not serve a percentile at all. Return
`sampleSize` and let the client fall back to the modelled baseline. Publishing a
percentile computed from 40 sessions is both statistically meaningless and, at
small scale, a weak deanonymisation vector.

---

## Client migration

The seam is intentionally narrow. Today `src/stats/global.ts` exposes:

```ts
percentileForScore(score, baseline?)
scoreForPercentile(percentile, baseline?)
distributionBins(binCount?, baseline?)
medianScore(baseline?)
```

Migration is three steps and touches no UI:

1. Extend `GlobalBaseline` with `median`, `p10`, `p90`, and optional `buckets`.
2. Add `fetchBaseline()` with a cache in AsyncStorage; return
   `MODELLED_BASELINE` on any failure.
3. Hold the fetched baseline in `AppStore` and pass it into the existing calls.

`isModelled(baseline)` already exists, and the results screen already renders
`result.distribution.estimateNote`. Flipping that footnote off should be driven
by `isModelled()` returning false — never by a build flag, so the UI can never
claim real crowd data it does not have.

---

## Open questions

- **Cohort granularity.** Global-only is simplest and safest. By-platform is
  tempting (Android mics behave differently) but shrinks the sample and adds an
  inference surface. Start global.
- **Score drift.** If the scoring weights in `score.ts` ever change, historical
  sessions become incomparable. Version the score and keep separate baselines
  per score version, or recompute the histogram from stored raw metrics — noting
  that the latter needs the rows we just said we would discard.
- **Calibration.** Estimated dB SPL varies by device. Collecting a one-time
  calibration against a known reference would make cross-device comparison
  meaningful, but it is a large UX ask for a casual app.
