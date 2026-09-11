import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { useHaptics } from '../hooks/useHaptics';
import { color, radius, TOUCH_TARGET } from '../theme/tokens';

type IconButtonProps = {
  name: IconName;
  onPress: () => void;
  /** Required: an icon-only control must still announce itself. */
  accessibilityLabel: string;
  size?: number;
  tint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Circular icon-only control for screen headers.
 *
 * The visual circle is smaller than the touch target: the `Pressable` always
 * occupies at least 48×48 so the control meets the platform minimum even when
 * the glyph is drawn at 20pt.
 */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 20,
  tint = color.text,
  style,
}: IconButtonProps) {
  const haptics = useHaptics();

  const handlePress = useCallback(() => {
    haptics.tap();
    onPress();
  }, [haptics, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Icon name={name} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  // Press feedback via colour only — no transform, so nothing around it moves.
  pressed: {
    backgroundColor: color.surfaceRaised,
  },
});
