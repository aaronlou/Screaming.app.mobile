import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from './AmbientBackground';
import { spacing } from '../theme/tokens';

type ScreenProps = {
  children: React.ReactNode;
  /** Thermal intensity for the backdrop, 0..1. */
  intensity?: number;
  /** Backdrop glow colour. */
  tint?: string;
  /** Wrap content in a ScrollView. Use for anything that can overflow. */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Which safe-area edges to inset. Defaults to top and bottom. */
  edges?: readonly ('top' | 'bottom')[];
};

/**
 * Standard screen chrome: atmosphere, safe-area insets, and horizontal gutters.
 *
 * Insets are applied as padding rather than by wrapping in `SafeAreaView`, so
 * that a scrolling screen keeps its bounce area full-bleed while the content
 * still clears the notch and the home indicator.
 */
export function Screen({
  children,
  intensity = 0,
  tint,
  scroll = false,
  contentContainerStyle,
  style,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const paddingStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
  };

  const content = (
    <View style={[styles.gutter, paddingStyle, contentContainerStyle]}>{children}</View>
  );

  return (
    <AmbientBackground intensity={intensity} tint={tint}>
      <View style={[styles.root, style]}>
        {scroll ? (
          <ScrollView
            style={styles.root}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            // Keep the keyboard from covering inputs on the settings screen.
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gutter: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
});
