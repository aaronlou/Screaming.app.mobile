import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, spacing, tabularNums, type } from '../theme/tokens';

type StatTileProps = {
  label: string;
  value: string;
  /** Rendered smaller, after the value. e.g. "dB" or "L". */
  unit?: string;
  /** Value colour. Defaults to primary text. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Label-over-value readout, used for every number in the app.
 *
 * Values use tabular figures so a ticking timer or a live decibel readout does
 * not shift its own layout 20 times a second.
 */
export function StatTile({ label, value, unit, tint = color.text, style }: StatTileProps) {
  return (
    <View style={[styles.root, style]}>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>

      <View style={styles.valueRow}>
        <Text
          style={[styles.value, tabularNums, { color: tint }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {value}
        </Text>
        {unit ? <Text style={[styles.unit, { color: tint }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...type.caption,
    color: color.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    ...type.title,
  },
  unit: {
    ...type.label,
    opacity: 0.7,
  },
});
