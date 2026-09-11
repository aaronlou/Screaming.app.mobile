# Screaming

**Scream into your phone. Feel better. See how you compare.**

Screaming is an emotional-release app. You find somewhere private, you scream as
loud as you can, and the app measures it — how loud, how long, and where that
lands against everyone else. Then it tells you how much stale air you just got
out of your chest.

English-first, localised for Chinese. iOS and Android from one codebase.

---

## The flow

```
Home  →  Safety check  →  3-2-1 countdown  →  Live scream  →  Results
                                                    │
                                              History / Settings
```

1. **Safety check.** Before every session: look around, find somewhere private,
   mind your throat. A real scream can frighten bystanders, wake a baby, or
   distract a driver, so this is a deliberate one-tap gate — short enough that
   people actually read it.
2. **Countdown.** Three seconds to breathe in. The microphone is already warm so
   the first syllable isn't lost to device spin-up.
3. **Live scream.** A gauge that heats from cool indigo to white-hot gold as you
   get louder, a running timer, a rolling waveform, and live peak/average
   readings. Haptics pulse harder as you push. Tapping anywhere stops it; the
   session auto-stops at 30 seconds for the sake of your voice.
4. **Results.** Scream score, tier, your waveform, your position in the
   population distribution, and the litres of stale air you released.

---

## What makes it work

### The thermal ramp

The entire UI is a temperature gauge for the user's voice. Colour is never
decoration — it *is* the readout:

| Intensity | Colour | Meaning |
| --- | --- | --- |
| 0.00 | `#4F5BD5` indigo | at rest |
| 0.28 | `#8B5CF6` violet | warming up |
| 0.55 | `#E0459B` magenta | pushing |
| 0.78 | `#FF6B35` orange | loud |
| 1.00 | `#FFD23F` gold | full scream |

Every colour in the app derives from `thermalColor(intensity)` in
`src/theme/tokens.ts`. The results screen is tinted by how loud you actually got,
so the payoff is visual before it is numeric.

### Privacy is enforced by architecture, not by policy

**No audio is ever written to disk.** This is not a promise in a settings
screen — it is a structural property of how capture works:

- Most React Native apps record with the native *recorder*, which writes a file
  that the app must then remember to delete. We don't.
- Screaming uses `useAudioStream()` from `expo-audio`, which delivers raw PCM
  frames to JavaScript. **There is no recorder and therefore no file** — nothing
  to delete, nothing to leak, nothing to upload.
- Each frame is reduced to a single RMS number in `src/audio/level.ts` and then
  discarded. What gets stored is a curve of loudness values, roughly 120 points.
  It is a graph. It cannot be played back, and it cannot be reconstructed into
  speech.

The iOS permission prompt says exactly this, because the system string is set in
`app.json`.

### Scoring rewards release, not volume

`src/stats/score.ts` blends three terms:

| Term | Weight | What it measures |
| --- | --- | --- |
| Peak | 0.45 | Loudest level reached |
| Sustain | 0.35 | Time spent at or above the scream threshold (8 s = full marks) |
| Energy | 0.20 | ∫ level dt while screaming (~6 level-seconds = full marks) |

Scoring on peak alone would push people to hurt their throats on one sharp bark.
Weighting sustain and total energy rewards the behaviour the product actually
wants: a long, committed release.

### "Stale air released"

Grounded in real respiratory numbers rather than invented ones: quiet breathing
moves ~0.5 L/s, a forceful shout or scream moves ~2–4 L/s. We scale airflow
linearly with intensity and integrate it over the time spent screaming, which
lands at ~2.8 L/s at the scream threshold. The UI labels it an estimate, because
that is what it is.

### Unit conversion is honest about its limits

PCM gives us **dBFS** (0 = loudest the converter can represent). People care
about **dB SPL** ("how loud is this in the room"). Converting between them needs
a calibrated reference, because the answer depends on microphone sensitivity,
device model, and OS gain control.

We cannot measure true SPL from software alone, so `src/audio/level.ts` applies
one documented offset (`SPL_OFFSET_DB = 95`) and the UI calls the result an
estimate. It is consistent across sessions on the same device, which is what the
scoring actually needs. A **sensitivity** setting (low / normal / high) trims it
±6 dB for microphones that run hot or cold.

---

## Internationalisation

- **Automatic.** `expo-localization` detects the device language; `zh` (any
  variant — Hans, Hant, CN, TW) resolves to Chinese, everything else falls back
  to English, which is the primary market.
- **Override.** Settings offers Automatic / English / 中文.
- **Type-safe.** `TranslationKey` is derived from the English catalogue and every
  other locale is typed `Record<TranslationKey, string>`. **A missing translation
  is a compile error, not an "undefined" on screen.** This was already earned
  during development — two keys used in `HomeScreen` but never defined were
  caught by `tsc`, not by a user.
- **Android locale changes** are picked up on foreground, since Android lets
  users change language without restarting the app.
- **No i18n library.** No ICU syntax, no runtime dependency: `{{name}}`
  placeholders and a `Record`. At this size a dependency would cost more than it
  saves.
- Numbers and dates go through `Intl` with the device's BCP-47 tag
  (`src/utils/format.ts`), each call wrapped in a fallback.

---

## Architecture

```
src/
  App.tsx                  providers + the stack navigator
  types.ts                 ScreamMetrics, ScreamSession, HistorySummary
  config.ts
  theme/tokens.ts          colour, spacing, type, motion, thermal ramp, contrast
  i18n/                    en.ts, zh.ts, index.tsx (provider + t())
  audio/
    level.ts               the acoustic model — RMS→dBFS→SPL→level, bands, envelope
    useScreamSession.ts    the session engine and state machine
  stats/
    score.ts               composite scoring + tiers
    global.ts              population baseline, percentile maths, chart bins
    waste.ts               airflow model
  storage/store.ts         AsyncStorage persistence + validation + summary
  store/AppStore.tsx       settings + history context
  hooks/useHaptics.ts      setting-aware haptics
  components/              design-system primitives and signature visuals
  screens/                 Home, Safety, Session, Result, History, Settings
  utils/format.ts          locale-aware number/date formatting
```

### Two clocks

The audio path is split across two independent rates, which matters more than
anything else for performance:

- **`onBuffer`** fires on the native audio thread's schedule — dozens of times a
  second. It does the minimum possible work (one RMS pass over the frame) and
  writes into refs. It never triggers a React render.
- **A 50 ms interval** folds those refs into an accumulator and pushes a single
  state update for the UI.

Without that split, a fast microphone would drive hundreds of renders a second
and the UI would fall apart on a mid-range Android device. The ambient backdrop
blobs are additionally memoised and animated on the native driver, and the
thermal wash animates *opacity* on the native driver while its *colour* changes
only at band boundaries.

### Navigation

A ~60-line stack navigator in `src/App.tsx` rather than a navigation library.
The app has six screens in a mostly linear flow; a full library would buy deep
linking and gesture handling that aren't used yet, at the cost of another native
dependency on a very new SDK. Android hardware back is handled explicitly. Swap
in `expo-router` or React Navigation when deep links or push notifications land.

**Dependencies are deliberately limited to Expo-official and Expo-blessed
packages** (`expo-audio`, `expo-haptics`, `expo-linear-gradient`,
`expo-localization`, `expo-splash-screen`, `react-native-svg`,
`react-native-safe-area-context`, `@react-native-async-storage/async-storage`,
plus `react-dom` / `react-native-web` for the web preview). The project is on
Expo SDK 57 / React Native 0.86 / React 19.2, which is very new; third-party
native modules are the highest-risk thing you can add.

---

## The global distribution is currently a model

`src/stats/global.ts` ships a **modelled** baseline (mean 48, σ 19). The app is
local-first and has no backend, so there is no real crowd to rank against — and
**the UI says so**, in a footnote on every results screen. We never display a
user count we do not have.

The seam is deliberately narrow: the UI only ever calls `percentileForScore`,
`scoreForPercentile` and `distributionBins`. Swapping in real data means
fetching a `GlobalBaseline` and passing it in — nothing else changes. See
[`docs/STATS-BACKEND.md`](docs/STATS-BACKEND.md) for the API contract.

---

## Running it

```bash
npm install
npm run ios       # or: npm run android
npm run typecheck # tsc --noEmit
npm run verify    # 59 checks over the pure model modules
```

Requires Xcode (iOS) and/or Android Studio.

### Web preview

`npm run web` renders the whole UI in a browser, which is genuinely useful for
iterating on layout and copy without a simulator.

**It is a UI preview only.** `expo-audio`'s `useAudioStream` is a **no-op stub on
web** (`build/AudioStream.web.js` returns `{ stream: null, isStreaming: false }`),
so there is no microphone capture, every level reads as the noise floor, and no
score above zero is possible. The app degrades cleanly — timer runs, UI updates,
no crash — but anything audio-related must be verified on a device or simulator.

> **Note on this checkout.** The environment that produced this code had a
> read-only home directory, so `npm` and `expo` were pointed at a workspace-local
> cache via a `HOME` override. On a normal machine, plain
> `npm install && npm run ios` is all you need.

---

## Verification status

What has actually been checked, as opposed to written:

| Area | Status |
| --- | --- |
| TypeScript, whole project | ✅ `tsc --noEmit` clean, `strict: true` |
| Production bundle | ✅ `expo export --platform ios` — 763 modules, 1.8 MB Hermes |
| Model maths | ✅ 59 assertions in `scripts/verify-models.ts` |
| Every screen renders (browser) | ✅ driven in a real browser at 393×852 |
| Full flow: home → safety → countdown → live → results | ✅ in browser, including auto-stop at the 30 s cap |
| Tap-anywhere-to-stop | ✅ |
| i18n auto-detection and live switching | ✅ rendered in both zh and en |
| Persistence across reload | ✅ history and language survive |
| Runtime console | ✅ 0 errors, checked on every screen including live |
| Live gauge accessibility | ✅ `progressbar` role with a spoken label |
| Reduced-motion support | ✅ verified in-browser, with a motion-on control run |
| **Runs on the iOS simulator** | ✅ Expo Go 57.0.9 on iPhone 16 Pro (iOS 18.5) — home, settings and results screens confirmed natively |
| Thermal ramp reaches full heat | ✅ score 94 rendered gold natively, confirming the SPL range fix |
| Microphone crash recovery | ✅ crash triggered for real, sentinel confirmed on disk, notice shown on relaunch |
| Native label sizing | ✅ regression found on device and fixed, re-verified natively |
| **Native microphone capture** | ❌ **not verified — blocked by hardware**; see below |
| Session screen on a Mac without audio input | ⚠️ still aborts (unavoidable from JS) but now recovers with an explanation |
| Physical device / tablet / landscape | ❌ not verified |
| Maximum Dynamic Type (font scaling) | ❌ not verified |

### The one thing that could not be verified, and why

The microphone path is the only part of this app that has never actually run.

Two independent environment limits, both outside the code:

1. **This machine has no audio input device.** `system_profiler SPAudioDataType`
   lists output devices only — an LS27A800U monitor and the Mac mini speakers.
   There is no microphone for the simulator to borrow, so no real loudness can
   be produced or measured here.
2. **Starting the stream on a machine with no input aborts the process.**
   `AudioStream.start()` installs a tap on the input node, and with no input
   `AVAudioNode.installTapOnBus:` raises an Objective-C exception. That is not a
   JavaScript error, so the `try`/`catch` around `start()` cannot intercept it.
   Confirmed with a native crash report:

   ```
   objc_exception_throw
   AUGraphNodeBaseV3::CreateRecordingTap
   AVAudioEngineImpl::InstallTapOnNode
   -[AVAudioNode installTapOnBus:bufferSize:format:block:]
   AudioStream.start()
   ```

   This cannot occur on real iPhone or iPad hardware, which always has a
   built-in microphone. It is a simulator/hardware-failure case. `expo-audio`
   exposes `getAvailableInputs()` only on the *recorder*, after preparation, so
   there is no way to pre-flight this from JavaScript today — and preparing a
   recorder would create exactly the audio file this app promises never to
   create, so that workaround was rejected on privacy grounds.

   **What the app does about it instead:** a native abort cannot be prevented
   from JS, but it can be *noticed*. `useScreamSession` writes a small sentinel
   to storage immediately before starting the microphone and clears it the
   instant the start succeeds. If the sentinel is still present on the next
   launch, the home screen explains that the microphone failed to start and
   suggests checking it, rather than letting the user walk into the same wall
   blindly. This was verified end to end on the simulator: the crash was
   triggered for real, the sentinel was confirmed on disk
   (`screaming.micstart.v1 = pending`), and the next launch showed the notice.

**Next step to close this out:** run `npm run ios` on a Mac with a working
microphone, or on a physical device, walk the flow, and compare the reported
dB against a reference sound-level meter to calibrate `SPL_OFFSET_DB`.

Four real bugs were caught by actually running the thing rather than by reading
the code:

1. **The top of the loudness scale was unreachable.** `SPL_MIN`/`SPL_MAX` were
   hard-coded to `30`/`120`, which meant a normalised level of 1.0 required
   120 dB SPL — needing +25 dBFS, impossible since PCM saturates at 0 dBFS. The
   thermal ramp could never reach gold no matter how hard anyone screamed. The
   range is now derived from the converter's real limits.
2. **Two translation keys used in `HomeScreen` were never defined.** The typed
   catalogue turned this into a compile error.
3. **The "YOU" marker hung off the edge of the distribution chart** at extreme
   scores, putting half the pill outside the card.
4. **The live screen rendered nested interactive elements.** The full-screen
   "tap anywhere to stop" area was exposed with a `button` role while containing
   the STOP button — invalid nested `<button>` markup on web, and on native a
   control nested inside another control. The tap area is now semantically
   invisible and the STOP button is the single announced control.

Bug 4 is the instructive one: it was invisible until the console was checked
*while the live screen was on screen*. An earlier pass had reported "0 console
errors" from a different screen, which was true and misleading in equal measure.

A fifth, tooling-shaped bug: `npm run verify` was documented but did not work on
a clean checkout. `tsx` was resolving from an unrelated project that happened to
sit on this machine's `PATH`. It is now a declared devDependency.

And a sixth, which only a real device could have surfaced:

6. **iOS silently shrank button and segmented-control labels.** `AppButton` and
   `SegmentedControl` both used `adjustsFontSizeToFit` on a `Text` that sits
   content-sized inside a centred container. On iOS the fit logic resolves
   against a zero width during the very first layout pass and collapses the
   label to `minimumFontScale` — permanently. Because it is a first-pass race
   it hit *only whichever segmented control rendered first* (the language
   picker, whose labels came out at roughly a third of the correct size) while
   the two identical controls below it were fine, which made it look like a
   data problem rather than a layout one. Adding a definite width did not fix
   it; removing `adjustsFontSizeToFit` did. Labels now truncate at extreme
   Dynamic Type instead of shrinking, matching what the platform's own controls
   do. `StatTile` still uses the feature safely — its label sits in a stretching
   column, so it does get a real width.

The highest-value next check is a real device run to confirm `useAudioStream`
delivers PCM on iOS and Android, and to calibrate `SPL_OFFSET_DB`.

---

## Safety and ethics

Screaming is a release valve, not a treatment. The app is explicit about this in
two places:

- **The safety gate**, before every single session — it is not a one-time
  onboarding step.
- **A disclaimer in Settings**, plus a pointer to local helplines for anyone in
  crisis.

It is not a medical device, it makes no health claims, and the respiratory
figures are presented as estimates with their assumptions stated.

---

## Roadmap

**Next, in rough order of value:**

1. **Verify audio on a real device.** Everything downstream of the microphone is
   unverified until this happens. Confirm `useAudioStream` delivers PCM on both
   platforms, then calibrate `SPL_OFFSET_DB` against a reference meter using the
   sensitivity setting.
2. **Real global stats.** Stand up the backend described in
   `docs/STATS-BACKEND.md`, add anonymous device-scoped IDs, keep everything
   aggregate.
3. **Shareable result cards.** The share sheet currently sends text. A rendered
   image card of the waveform is the single best growth loop this product has.
4. **Streaks and gentle nudges.** A local notification at a user-chosen time,
   framed as an invitation rather than a guilt trip.
5. **Guided sessions.** Timed prompts ("30 seconds, let it build"), and a
   deliberate post-scream cool-down with breathing.
6. **Watch app.** Peak dB and a stop control from the wrist.

**Known gaps:**

- The live waveform is JS-thread driven at 20 fps; a Skia canvas would be
  smoother if it ever matters.
- History is unbounded in the UI and capped at 200 entries in storage.
- `scripts/verify-models.ts` is a hand-rolled assertion script, not a test
  runner. It covers the pure modules well; there is nothing yet for the React
  layer. Moving it to Vitest is the obvious next step.
- **Suspected, unconfirmed:** ~~in the native settings screenshot the language
  segmented control's labels render noticeably smaller...~~ **Resolved** — it
  was `adjustsFontSizeToFit`, not a data problem. See bug 6 above.
