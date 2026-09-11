import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, spacing, type } from '../theme/tokens';

type SettingRowProps = {
  label: string;
  /** Persistent helper text. Never used as a placeholder substitute. */
  hint?: string;
  children: React.ReactNode;
};

/**
 * One settings entry: a label, an optional hint, and the control.
 *
 * The control sits on its own line beneath the label rather than beside it, so
 * segmented controls and switches keep full width at large Dynamic Type sizes
 * instead of being squeezed and truncating.
 */
export function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  text: {
    gap: 2,
  },
  label: {
    ...type.body,
    color: color.text,
    fontWeight: '600',
  },
  hint: {
    ...type.caption,
    color: color.textMuted,
  },
});
