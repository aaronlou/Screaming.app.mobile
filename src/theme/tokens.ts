/**
 * Design tokens for Screaming.
 *
 * Style direction: "Modern Dark (Cinema Mobile)" — cinematic dark, ambient
 * light blobs, glass surfaces, spring motion.
 *
 * Core concept — the THERMAL RAMP. The whole UI is a temperature gauge for the
 * user's voice: cool indigo at rest, heating through violet → magenta → orange
 * to white-hot gold at a full-throated scream. Colour here is never decorative;
 * it *is* the readout.
 *
 * Deliberately never pure #000000 — pure black causes visible smear on OLED
 * during scroll and removes all sense of depth.
 */

export const color = {
  bgDeep: '#020203',
  bgBase: '#050506',
  bgElevated: '#0a0a0c',

  surface: 'rgba(255, 255, 255, 0.05)',
  surfaceRaised: 'rgba(255, 255, 255, 0.08)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  text: '#EDEDEF',
  textMuted: '#8A8F98',
  textFaint: '#5A5F68',

  /** Cool indigo — the "at rest" brand accent. */
  accent: '#5E6AD2',
  /** Teal used only for the post-scream "relief" state. */
  relief: '#2DD4BF',
  danger: '#F04452',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Type scale. Sizes are in points; RN uses density-independent units. */
export const type = {
  display: { fontSize: 64, lineHeight: 68, fontWeight: '800' as const, letterSpacing: -1.5 },
  hero: { fontSize: 44, lineHeight: 48, fontWeight: '800' as const, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 1.2 },
} as const;

/**
 * Every numeral that can change while the user watches it (timer, dB readout,
 * score) must use tabular figures, otherwise the layout jitters on every tick.
 */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Motion — one shared rhythm so the whole app feels like one object. */
export const motion = {
  /** Enter: decelerate. Exit: accelerate. Never linear for UI. */
  fast: 160,
  normal: 240,
  slow: 380,
  /** Existing UI standard: cubic-bezier(0.16, 1, 0.3, 1) — "expo out". */
  standardEasing: [0.16, 1, 0.3, 1] as const,
} as const;

/** Minimum tappable size — Apple HIG 44pt, Material 48dp. */
export const TOUCH_TARGET = 48;

// ---------------------------------------------------------------------------
// Thermal ramp
// ---------------------------------------------------------------------------

export type ThermalStop = { at: number; hex: string };

/**
 * Five stops the UI interpolates between as intensity rises.
 * Index 0 is a calm speaking voice; index 4 is a full scream.
 */
export const THERMAL_STOPS: readonly ThermalStop[] = [
  { at: 0.0, hex: '#4F5BD5' }, // indigo  — at rest
  { at: 0.28, hex: '#8B5CF6' }, // violet  — warming up
  { at: 0.55, hex: '#E0459B' }, // magenta — pushing
  { at: 0.78, hex: '#FF6B35' }, // orange  — loud
  { at: 1.0, hex: '#FFD23F' }, // gold    — full scream
] as const;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const ratio = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  });
}

/** Convert an `#RRGGBB` string to an `rgba()` string with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Map a normalised intensity (0..1) onto the thermal ramp.
 * This is the single source of truth for "how hot does the UI look right now".
 */
export function thermalColor(intensity: number): string {
  const level = Math.max(0, Math.min(1, intensity));

  for (let i = 0; i < THERMAL_STOPS.length - 1; i += 1) {
    const current = THERMAL_STOPS[i];
    const next = THERMAL_STOPS[i + 1];
    if (level <= next.at) {
      const span = next.at - current.at;
      const local = span === 0 ? 0 : (level - current.at) / span;
      return mixHex(current.hex, next.hex, local);
    }
  }

  return THERMAL_STOPS[THERMAL_STOPS.length - 1].hex;
}

/** Semantic palette for the calm/relief state shown after a session ends. */
export const calmColor = color.accent;
export const reliefColor = color.relief;

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colours, 1 .. 21. */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose the label colour for a filled surface.
 *
 * The thermal ramp runs from deep indigo to pale gold, so a single hard-coded
 * "white text on the button" would fail contrast at the gold end. This picks
 * whichever candidate actually reads better, which keeps every button legible
 * at every point on the ramp.
 */
export function readableTextOn(
  background: string,
  light: string = color.white,
  dark: string = color.bgDeep,
): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}
