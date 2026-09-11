import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user has asked the system to reduce motion.
 *
 * The app is full of deliberate movement — drifting ambient light, screen
 * transitions, a countdown that pops — and for some people that movement is
 * genuinely unpleasant or nauseating. This is the hook that lets every animated
 * surface opt out.
 *
 * Note the distinction the app makes: motion that *decorates* is removed
 * entirely, while motion that *carries information* (the thermal wash tracking
 * loudness) is kept but made instantaneous. Reduced motion should not mean
 * reduced feedback.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        // Not supported on this platform — assume motion is fine.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
