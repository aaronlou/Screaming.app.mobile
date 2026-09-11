import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, spacing } from '../theme/tokens';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Adds a soft accent halo behind the card. Use sparingly — one per screen. */
  glow?: string;
};

/**
 * The app's one surface primitive.
 *
 * Dark glass: a translucent fill, a hairline border for definition, and a
 * brighter hairline along the top edge. That top highlight is what stops a dark
 * card from reading as a flat hole in the background — it implies a light
 * source above, which is the whole point of the cinematic style.
 */
export function Card({ children, style, glow }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        glow
          ? {
              shadowColor: glow,
              shadowOpacity: 0.28,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 6,
            }
          : null,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.topHighlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.borderStrong,
  },
});
