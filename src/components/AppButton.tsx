import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from './Icon';
import { useHaptics } from '../hooks/useHaptics';
import { color, radius, readableTextOn, spacing, TOUCH_TARGET, type } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'lg' | 'md';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fill colour for the primary variant. Defaults to the calm brand indigo. */
  tint?: string;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The app's one button.
 *
 * Press feedback is a 0.97 scale plus a light haptic — the scale is on the
 * native driver and never moves surrounding layout, so pressing never makes the
 * screen jitter.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  tint = color.accent,
  icon,
  disabled = false,
  style,
  accessibilityHint,
}: AppButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const haptics = useHaptics();

  const handlePressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    haptics.tap();
    onPress();
  }, [haptics, onPress]);

  const isDisabled = disabled;
  const labelColor = resolveLabelColor(variant, tint);

  const height = size === 'lg' ? 60 : TOUCH_TARGET + 4;
  const labelStyle = size === 'lg' ? type.heading : type.label;

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        variant === 'primary' && !isDisabled ? glowStyle(tint) : null,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled }}
        style={[
          styles.base,
          { height },
          styles[variant],
          variant === 'primary' ? { backgroundColor: tint } : null,
          isDisabled ? styles.disabled : null,
        ]}
      >
        {icon ? (
          <View style={styles.icon}>
            <Icon name={icon} size={size === 'lg' ? 22 : 18} color={labelColor} />
          </View>
        ) : null}

        <Text
          style={[labelStyle, { color: labelColor }]}
          numberOfLines={1}
          // Long labels (German, Chinese at large Dynamic Type) should shrink
          // rather than truncate.
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function resolveLabelColor(variant: ButtonVariant, tint: string): string {
  switch (variant) {
    case 'primary':
      return readableTextOn(tint);
    case 'danger':
      return color.white;
    case 'secondary':
      return color.text;
    case 'ghost':
    default:
      return tint;
  }
}

/**
 * Accent glow behind the primary action, per the design system.
 *
 * A coloured shadow is the cheapest real glow on both platforms — Android's
 * `elevation` needs `shadowColor` plus a background to render at all.
 */
function glowStyle(tint: string): ViewStyle {
  return {
    shadowColor: tint,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderRadius: radius.pill,
  };
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    // 8pt rhythm between adjacent controls.
    gap: spacing.sm,
  },
  primary: {},
  secondary: {
    backgroundColor: color.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: color.danger,
  },
  disabled: {
    opacity: 0.38,
  },
  icon: {
    // Nudges the optical centre; icons read slightly high next to text.
    marginTop: 1,
  },
});
