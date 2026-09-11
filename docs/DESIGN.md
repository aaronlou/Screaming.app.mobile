# Design system

The single source of truth for these values is `src/theme/tokens.ts`. This
document explains *why* they are what they are.

---

## Style direction

**Modern Dark (Cinema Mobile)** — chosen for its fit with Expo and React Native
and because the emotional register matches the product: catharsis happens in the
dark, alone, at night, in a parked car or a stairwell.

- Deep, near-black gradient base
- Slow-drifting ambient light
- Glass surfaces with hairline borders
- Spring and decelerate motion
- Accent glow behind the primary action

**Never pure `#000000`.** Pure black causes visible smear on OLED during scroll
and removes all sense of depth. The base is `#050506` with a gradient down to
`#020203`.

### Anti-patterns we deliberately avoid

- 2D, flat design with no depth or light source
- Emoji used as structural icons
- Random shadow values — there is one elevation scale
- Mixing flat and skeuomorphic treatments
- Decorative-only animation
- Colour as the sole carrier of meaning

---

## The thermal ramp

The core idea. The entire UI is a temperature gauge for the user's voice:

| Intensity | Colour | Hex | Reads as |
| --- | --- | --- | --- |
| 0.00 | indigo | `#4F5BD5` | at rest |
| 0.28 | violet | `#8B5CF6` | warming up |
| 0.55 | magenta | `#E0459B` | pushing |
| 0.78 | orange | `#FF6B35` | loud |
| 1.00 | gold | `#FFD23F` | full scream |

`thermalColor(intensity)` interpolates in RGB between these stops and is the
**only** way colour enters the live and results screens. Nothing hard-codes a
"loud" colour.

This satisfies the `motion-meaning` and `color-not-decorative-only` rules: the
colour change expresses a cause-effect relationship (the user's voice) and is
always accompanied by a number, so nothing is conveyed by colour alone.

### Contrast on a ramp

The ramp runs from a dark indigo to a pale gold, so a hard-coded "white text on
the button" fails contrast at the gold end. `readableTextOn(background)` computes
WCAG relative luminance for both candidates and returns whichever actually reads
better. Every filled surface uses it.

---

## Colour tokens

| Token | Value | Use |
| --- | --- | --- |
| `bgDeep` | `#020203` | bottom of the gradient |
| `bgBase` | `#050506` | mid |
| `bgElevated` | `#0a0a0c` | top of the gradient |
| `surface` | `rgba(255,255,255,0.05)` | cards, controls |
| `surfaceRaised` | `rgba(255,255,255,0.08)` | secondary buttons, tracks |
| `border` | `rgba(255,255,255,0.08)` | hairline card borders |
| `borderStrong` | `rgba(255,255,255,0.16)` | top-edge highlight |
| `text` | `#EDEDEF` | primary |
| `textMuted` | `#8A8F98` | secondary |
| `textFaint` | `#5A5F68` | tertiary, footnotes |
| `accent` | `#5E6AD2` | brand, calm state, primary CTA |
| `relief` | `#2DD4BF` | post-scream relief, stale-air metric |
| `danger` | `#F04452` | destructive |

Three text tiers with clear separation rather than a continuum of greys. On dark
surfaces secondary text stays above 4.5:1 against the card fill.

---

## Typography

Platform system stack — no custom fonts. Two reasons: it renders Chinese
correctly with zero configuration (a Latin display font like Bebas Neue has no
CJK glyphs and would need per-platform fallback handling), and it removes a font
asset from the bundle and a failure mode from launch.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display` | 64 / 68 | 800 | score, countdown |
| `hero` | 44 / 48 | 800 | meter centre |
| `title` | 28 / 34 | 700 | screen titles |
| `heading` | 20 / 26 | 700 | section headings, buttons |
| `body` | 16 / 24 | 400 | prose |
| `label` | 14 / 20 | 600 | control labels |
| `caption` | 13 / 18 | 500 | hints, footnotes |
| `micro` | 11 / 14, +1.2 tracking | 600 | uppercase eyebrows |

**`tabularNums` is mandatory for any number that changes while the user watches
it** — the timer, decibel readings, score. Without tabular figures the layout
jitters on every tick.

Hierarchy comes from size, spacing and weight, not colour alone. `textTransform:
uppercase` is reserved for short eyebrows where the letter-spacing can breathe.

### Do not reach for `adjustsFontSizeToFit`

It looks like free insurance against long translations and large Dynamic Type.
On iOS it is a trap, and it cost us a real bug.

When the `Text` sits content-sized inside a centred container — a button's
centred row, a segmented control's centred segment — iOS resolves the fit logic
against a zero width during the very first layout pass and collapses the label
to `minimumFontScale`. It never recovers, because nothing invalidates it.

Worse, it is a *first-pass race*, so it hits only whichever instance renders
first. In the settings screen the language picker's labels came out at a third
of their correct size while the two identical controls below it were perfectly
fine — which reads as a data problem, not a layout one, and sent us looking in
the wrong place first.

Giving the `Text` a definite width (`alignSelf: 'stretch'`, `flexShrink: 1`) is
the intuitive fix and **did not work**. Removing the prop did. Labels now
truncate with an ellipsis at extreme text sizes, which is what the platform's own
controls do.

`StatTile` is the one place it is still used, and it is safe there: its label
sits in a stretching column, so it genuinely does receive a width. If you add a
new one, put it in a stretching parent or don't use it at all.

---

## Spacing, radius, touch

- **Spacing**: 4/8 rhythm — `2, 4, 8, 12, 16, 24, 32, 48, 64`. No arbitrary
  values.
- **Radius**: 8 (small), 12 (controls), 16 (cards), 24 (large cards, sheets),
  999 (pills).
- **Touch targets**: `TOUCH_TARGET = 48`. Icon buttons draw a 20pt glyph inside a
  48×48 `Pressable`; the visual circle is smaller than the hit area, never the
  other way around.

---

## Motion

One shared rhythm so the whole app feels like one object.

| Token | ms | Use |
| --- | --- | --- |
| `fast` | 160 | micro-interactions, press feedback |
| `normal` | 240 | state changes, thermal wash |
| `slow` | 380 | screen transitions, countdown pop |

Easing is `cubic-bezier(0.16, 1, 0.3, 1)` — decelerate in, never linear for UI.
Press feedback uses spring physics.

Rules applied throughout:

- **Transform and opacity only.** No animation of width, height, or position.
- **Press feedback never moves layout.** Buttons scale to 0.97 on a transform;
  icon buttons change background colour only.
- **One or two animated elements per view**, maximum.
- **Native driver wherever possible** — the ambient blobs drift on the native
  driver so they stay smooth while the JS thread folds microphone buffers.
- **The countdown re-animates per digit** rather than morphing, with a slight
  `Easing.back` overshoot, because the pop is what makes the beat feel
  intentional.

---

## Layout

- Safe-area insets are applied as **padding**, not by wrapping in
  `SafeAreaView`, so a scrolling screen keeps a full-bleed bounce area while the
  content still clears the notch and home indicator.
- Single column, `spacing.xl` (24) gutters, 8pt vertical rhythm between blocks.
- Content is centred vertically on the short screens (countdown, permission) and
  scrolls everywhere it could overflow at large Dynamic Type sizes.
- The 270° gauge deliberately puts **time in the centre and loudness on the
  ring**: loudness is instantaneous feedback, time is the thing being
  accumulated, so time gets the most legible position on screen.

---

## Components

| Component | Notes |
| --- | --- |
| `AmbientBackground` | Gradient + 3 drifting radial-gradient SVG pools + thermal wash |
| `Screen` | Safe area, gutters, optional scroll |
| `ScreenTransition` | Enter-only fade + rise, keyed per navigation |
| `Card` | Dark glass, hairline border, top-edge highlight |
| `AppButton` | 4 variants, 2 sizes, accent glow, haptic + scale press |
| `IconButton` | 48×48 target, colour-only press feedback |
| `SegmentedControl` | Selection carried by fill **and** weight |
| `SettingRow` | Label + hint, control on its own line |
| `StatTile` | Tabular figures, `adjustsFontSizeToFit` |
| `Icon` | 14 hand-built Lucide-style glyphs, one stroke width |
| `LevelMeter` | 270° gauge, thermal ring, time in the centre |
| `Waveform` | Quadratic-smoothed loudness curve with gradient fill |
| `DistributionChart` | Population histogram with the user's position marked |

---

## Accessibility

- **Contrast**: 4.5:1 minimum for body text, verified on dark surfaces; the
  thermal ramp is contrast-checked at every stop via `readableTextOn`.
- **Colour is never the only signal.** Every thermal colour is paired with a
  number, the selected segment is bold *and* filled, and the distribution chart
  states its result as text.
- **Charts carry spoken summaries.** `DistributionChart` takes an
  `accessibilityLabel` describing the key insight, and the histogram is
  reinforcement for a number that is always rendered as text.
- **Touch targets** are ≥48pt with ≥8pt gaps.
- **Labels, not placeholders.** Icon-only controls require an
  `accessibilityLabel` prop — it is typed as required, so it cannot be forgotten.
- **Charts and gauges are single elements.** `DistributionChart` carries a
  spoken summary of its key insight, and `LevelMeter` is exposed as one
  `progressbar` with an `accessibilityValue` plus a sentence describing
  loudness, elapsed time and the current band. Announcing the ring, the timer
  and the caption separately would produce a stream of fragmented numbers.
- **Text scaling**: `adjustsFontSizeToFit` with `minimumFontScale` on labels and
  readouts so large Dynamic Type shrinks rather than truncates.
- **Reduced motion** is honoured via `useReducedMotion()`. The distinction the
  app draws: motion that *decorates* is removed (the ambient pools stop
  drifting entirely), while motion that *carries information* is kept but made
  instantaneous (the thermal wash snaps to the current loudness instead of
  easing, and screen transitions keep a brief dissolve but drop the rise). A
  screen that swaps with no transition at all reads as broken rather than calm.

### Known accessibility gaps

- Landscape is untested; the layout is portrait-first.
- The history list has no per-row accessibility grouping — a row is announced as
  its individual parts rather than as one session.

---

## Pre-delivery checklist

- [x] No emoji as structural icons
- [x] One icon family, consistent stroke width
- [x] Semantic tokens, no ad-hoc hex in components
- [x] Pressed states never shift layout
- [x] Touch targets ≥48pt
- [x] Micro-interactions in the 160–380 ms range
- [x] Safe areas respected on every screen
- [x] Scroll content clears fixed bars
- [x] Primary text ≥4.5:1 in dark mode
- [x] Colour never carries meaning alone
- [x] Every interactive element has an accessibility label
- [x] Charts and gauges carry spoken summaries
- [x] Reduced motion implemented (decorative motion removed, informative motion kept)
- [ ] Verified on a physical small phone and a tablet
- [ ] Verified at maximum Dynamic Type
