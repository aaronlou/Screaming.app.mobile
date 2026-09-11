import React, { useId, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { color } from '../theme/tokens';

type WaveformProps = {
  /** Levels, 0..1, oldest first. */
  values: number[];
  height?: number;
  /** Stroke colour. Defaults to a bright neutral. */
  tint?: string;
  /** Fill the area under the curve with a fading gradient. */
  fill?: boolean;
  strokeWidth?: number;
  /** Horizontal inset so the curve never clips its own caps. */
  padding?: number;
};

/**
 * A loudness curve.
 *
 * Used twice: as the rolling window during a live scream, and as the full
 * recorded shape on the results screen. It is a graph of *level over time* — the
 * app never stores or renders audio, so this is the closest thing to a playback
 * view that exists.
 *
 * Points are joined with quadratic segments through their midpoints rather than
 * straight lines; at 56+ samples a polyline looks jagged and reads as noise,
 * while the smoothed curve reads as a voice.
 */
export function Waveform({
  values,
  height = 120,
  tint = color.text,
  fill = true,
  strokeWidth = 2.5,
  padding = 4,
}: WaveformProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(1, windowWidth - 64);

  // `useId` is deterministic across renders; the colons it produces are not
  // safe inside an SVG `url(#…)` reference, so they are stripped.
  const gradientId = `wave-${useId().replace(/:/g, '')}`;

  const { linePath, areaPath } = useMemo(
    () => buildPaths(values, width, height, padding),
    [values, width, height, padding],
  );

  return (
    <View style={[styles.root, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tint} stopOpacity={0.35} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Baseline so an empty curve still reads as a chart, not a bug. */}
        <Path
          d={`M 0 ${height - padding} L ${width} ${height - padding}`}
          stroke={color.border}
          strokeWidth={1}
        />

        {fill && areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}

        {linePath ? (
          <Path
            d={linePath}
            stroke={tint}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}

function buildPaths(
  values: number[],
  width: number,
  height: number,
  padding: number,
): { linePath: string; areaPath: string } {
  if (values.length === 0) return { linePath: '', areaPath: '' };

  // Leave headroom so a level of 1.0 does not touch the very top edge.
  const usableHeight = height - padding * 2;

  const points = values.map((value, index) => {
    const x =
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const clamped = Math.max(0, Math.min(1, value));
    return { x, y: padding + (1 - clamped) * usableHeight };
  });

  const linePath = smoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;

  return { linePath, areaPath };
}

/** Quadratic smoothing through midpoints — cheap and visually clean. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const only = points[0];
    return `M ${only.x} ${only.y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    path += ` Q ${previous.x} ${previous.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
