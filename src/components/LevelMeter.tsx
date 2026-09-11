import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { color, tabularNums, thermalColor, type } from '../theme/tokens';

type LevelMeterProps = {
  /** Current smoothed level, 0..1. */
  level: number;
  /** Diameter of the gauge. */
  size?: number;
  /** Large text in the middle — normally the elapsed time. */
  centerValue: string;
  /** Small caption under the centre value. */
  centerCaption: string;
  /** Optional secondary readout pinned under the gauge. */
  footnote?: string;
  /**
   * Spoken description of what the gauge reads right now, e.g.
   * "Loudness 82 percent, 7.4 seconds elapsed".
   *
   * When supplied, the whole gauge becomes a single accessibility element. That
   * is deliberate: a screen reader announcing the ring, the timer and the
   * caption separately would produce a stream of fragmented numbers. One
   * coherent sentence per focus is far more usable.
   */
  accessibilityLabel?: string;
};

/** Fraction of the circle the gauge sweeps. 0.75 = a 270° speedometer arc. */
const ARC_FRACTION = 0.75;
const STROKE = 10;

/**
 * The live gauge.
 *
 * Two things are deliberate:
 *
 *  - The ring carries loudness, the centre carries *time*. Loudness is
 *    instantaneous feedback; time is the thing the user is actually
 *    accumulating, so it gets the most legible position on screen.
 *  - Colour comes straight off the thermal ramp, so the ring is hot gold at a
 *    full scream and indigo when the user is quiet. The colour is a readout,
 *    never decoration — and the numeric readout beside it means colour is never
 *    the *only* signal.
 */
export function LevelMeter({
  level,
  size = 260,
  centerValue,
  centerCaption,
  footnote,
  accessibilityLabel,
}: LevelMeterProps) {
  const clamped = Math.max(0, Math.min(1, level));
  const tint = thermalColor(clamped);

  const stroke = STROKE;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * ARC_FRACTION;

  // The gap in the track sits at the bottom, so the arc reads like a dial.
  const rotation = 90 + (360 * (1 - ARC_FRACTION)) / 2;

  const progressLength = arcLength * clamped;

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      {/* Soft halo that brightens with the voice. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2,
            backgroundColor: tint,
            opacity: 0.05 + clamped * 0.13,
          },
        ]}
      />

      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color.surfaceRaised}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          transform={`rotate(${rotation} ${center} ${center})`}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${progressLength} ${circumference - progressLength}`}
          transform={`rotate(${rotation} ${center} ${center})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
          {centerValue}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {centerCaption}
        </Text>
      </View>

      {footnote ? (
        <Text style={[styles.footnote, { color: tint }]} numberOfLines={1}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    ...type.hero,
    color: color.text,
  },
  caption: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  footnote: {
    ...type.label,
    position: 'absolute',
    bottom: -4,
  },
});
