import { useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';

import { useAppStore } from '../store/AppStore';

/**
 * Haptics that respect the user's setting.
 *
 * Every call site goes through this rather than importing `expo-haptics`
 * directly, so the Settings toggle genuinely silences the whole app and nobody
 * has to remember to check the flag.
 */
export function useHaptics() {
  const { settings } = useAppStore();
  const enabled = settings.haptics;

  const tap = useCallback(() => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [enabled]);

  const select = useCallback(() => {
    if (!enabled) return;
    void Haptics.selectionAsync();
  }, [enabled]);

  const success = useCallback(() => {
    if (!enabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [enabled]);

  const warn = useCallback(() => {
    if (!enabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [enabled]);

  return useMemo(() => ({ enabled, tap, select, success, warn }), [enabled, tap, select, success, warn]);
}
