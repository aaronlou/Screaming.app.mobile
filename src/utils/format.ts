/**
 * Locale-aware formatting.
 *
 * Every `Intl` call is wrapped: Hermes ships `Intl` on both platforms, but a
 * missing or partial ICU build would otherwise throw at render time and blank a
 * whole screen. The fallbacks are deliberately plain rather than clever.
 */

export function formatNumber(
  value: number,
  languageTag = 'en-US',
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(languageTag, options).format(value);
  } catch {
    return String(value);
  }
}

/** One decimal place, locale-aware. Used for litres. */
export function formatDecimal(value: number, languageTag = 'en-US', digits = 1): string {
  return formatNumber(value, languageTag, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "Today" / "Yesterday" / "Mar 4" for a history row.
 * The two relative labels are passed in so they stay translatable.
 */
export function formatDayLabel(
  timestamp: number,
  languageTag: string,
  todayLabel: string,
  yesterdayLabel: string,
): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (isSameDay(date, now)) return todayLabel;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return yesterdayLabel;

  try {
    return new Intl.DateTimeFormat(languageTag, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

/** Clock time, e.g. "14:32" or "2:32 PM" depending on locale. */
export function formatTimeOfDay(timestamp: number, languageTag: string): string {
  try {
    return new Intl.DateTimeFormat(languageTag, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    const date = new Date(timestamp);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}

/**
 * Format a level for display according to the user's unit preference.
 * Percent mode exists because "78 dB" means nothing to most people, whereas
 * "78%" is immediately legible.
 */
export function formatLevel(
  level: number,
  db: number,
  units: 'db' | 'percent',
): { value: string; unit: string } {
  if (units === 'percent') {
    return { value: String(Math.round(Math.max(0, Math.min(1, level)) * 100)), unit: '%' };
  }
  return { value: String(Math.round(db)), unit: 'dB' };
}
