import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';

type ScreenTransitionProps = {
  children: React.ReactNode;
};

/**
 * Enter animation for a pushed screen.
 *
 * Rising from below and fading in encodes hierarchy: the new screen is "deeper"
 * than the one it replaced. Only the enter is animated — the outgoing screen is
 * unmounted immediately, which keeps the tree small and avoids two live screens
 * competing for the meter frame budget.
 *
 * Under reduced motion the rise is dropped and only a brief dissolve remains.
 * Keeping *a* transition matters: an instant swap with no transition at all
 * makes navigation feel broken rather than calm.
 */
export function ScreenTransition({ children }: ScreenTransitionProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 160 : 260,
      // Decelerating curve — fast at first, settling gently.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: progress,
          transform: [
            {
              translateY: reduceMotion
                ? 0
                : progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
