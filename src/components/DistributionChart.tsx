import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, radius, spacing, type, withAlpha } from '../theme/tokens';

type DistributionChartProps = {
  /** The user's score, 0..100. */
  score: number;
  /** Pre-computed bins from the population baseline. */
  bins: { from: number; to: number; center: number; height: number }[];
  /** Optional median marker. */
  median?: number;
  tint?: string;
  height?: number;
  quieterLabel: string;
  louderLabel: string;
  /** Short label pinned to the user's marker, e.g. "YOU" / "你". */
  youLabel: string;
  /** Screen-reader description; charts must never be image-only. */
  accessibilityLabel: string;
};

/**
 * Population histogram with the user's position marked.
 *
 * A histogram — not a pie or a gauge — because the question being answered is
 * "where do I sit in this spread", which is a distribution, not a proportion.
 *
 * Accessibility: the bar chart is decorative reinforcement. The exact number
 * ("louder than 73% of screamers") is always rendered as text beside it, and the
 * whole chart carries a spoken summary, so nothing is conveyed by colour or
 * shape alone.
 */
export function DistributionChart({
  score,
  bins,
  median,
  tint = color.accent,
  height = 120,
  quieterLabel,
  louderLabel,
  youLabel,
  accessibilityLabel,
}: DistributionChartProps) {
  const range = useMemo(() => {
    if (bins.length === 0) return { from: 0, to: 100 };
    return { from: bins[0].from, to: bins[bins.length - 1].to };
  }, [bins]);

  const span = Math.max(1, range.to - range.from);
  const rawMarkerPercent = ((score - range.from) / span) * 100;

  /**
   * Clamp the marker so its pill never hangs outside the plot.
   *
   * At a score of 0 the true position is the very left edge, which would put
   * half of a 36pt pill outside the card. The exact figure is always stated in
   * the percentile text above, so nudging the marker at the extremes costs no
   * information and removes a visibly broken edge.
   */
  const MARKER_HALF_PERCENT = 6;
  const markerPercent = Math.max(
    MARKER_HALF_PERCENT,
    Math.min(100 - MARKER_HALF_PERCENT, rawMarkerPercent),
  );

  const medianPercent =
    median === undefined
      ? null
      : Math.max(0, Math.min(100, ((median - range.from) / span) * 100));

  const userBinIndex = bins.findIndex((bin) => score >= bin.from && score < bin.to);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.root}>
      <View style={[styles.plot, { height }]}>
        {/* Median reference, drawn behind the bars. */}
        {medianPercent !== null ? (
          <View
            pointerEvents="none"
            style={[styles.medianLine, { left: `${medianPercent}%` }]}
          />
        ) : null}

        <View style={styles.bars}>
          {bins.map((bin, index) => {
            const isUser = index === userBinIndex;
            return (
              <View
                key={`${bin.from.toFixed(1)}-${index}`}
                style={[
                  styles.bar,
                  {
                    // Never let a bar vanish entirely at the tails.
                    height: Math.max(3, bin.height * (height - spacing.sm)),
                    backgroundColor: isUser ? tint : withAlpha(color.white, 0.14),
                  },
                ]}
              />
            );
          })}
        </View>

        {/* The user's marker. Sits above the bars so it is never occluded. */}
        <View pointerEvents="none" style={[styles.marker, { left: `${markerPercent}%` }]}>
          <View style={[styles.markerLabel, { backgroundColor: tint }]}>
            <Text style={styles.markerLabelText} numberOfLines={1}>
              {youLabel}
            </Text>
          </View>
          <View style={[styles.markerStem, { backgroundColor: tint }]} />
        </View>
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{quieterLabel}</Text>
        <Text style={styles.axisLabel}>{louderLabel}</Text>
      </View>
    </View>
  );
}

/** Short marker label could collide with the chart edge, so it is centred on
 *  its own fixed-width track and clamped by the parent's padding. */
const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: spacing.sm,
  },
  plot: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  medianLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: color.borderStrong,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    // Centre the marker on its percentage position.
    marginLeft: -18,
    width: 36,
  },
  markerLabel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    minWidth: 36,
    alignItems: 'center',
  },
  markerLabelText: {
    ...type.micro,
    color: color.bgDeep,
    letterSpacing: 0.8,
  },
  markerStem: {
    flex: 1,
    width: 2,
    opacity: 0.75,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    ...type.caption,
    color: color.textFaint,
  },
});
