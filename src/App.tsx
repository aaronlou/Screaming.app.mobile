import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenTransition } from './components/ScreenTransition';
import { I18nProvider } from './i18n';
import { AppStoreProvider, useAppStore } from './store/AppStore';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SafetyScreen } from './screens/SafetyScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { percentileForScore } from './stats/global';
import { wasteAirLiters as computeWasteAir } from './stats/waste';
import { color } from './theme/tokens';
import { createSessionId, type ScreamMetrics, type ScreamSession } from './types';

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

type Route =
  | { name: 'home' }
  | { name: 'safety' }
  | { name: 'session' }
  | { name: 'result'; session: ScreamSession }
  | { name: 'history' }
  | { name: 'settings' };

/**
 * Root component.
 *
 * Provider order matters: the store must sit above `I18nProvider`, because the
 * language preference comes out of the store and the translator needs it before
 * any screen renders.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <LocalisedShell />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}

function LocalisedShell() {
  const { settings, updateSettings } = useAppStore();

  const handleLanguageChange = useCallback(
    (language: typeof settings.language) => updateSettings({ language }),
    [updateSettings],
  );

  return (
    <I18nProvider preference={settings.language} onPreferenceChange={handleLanguageChange}>
      {/* The whole app is dark; a light status bar is the only readable option. */}
      <StatusBar style="light" />
      <Navigator />
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Navigator
// ---------------------------------------------------------------------------

/**
 * A deliberately small stack navigator.
 *
 * The app has six screens in a mostly linear flow, so pulling in a full
 * navigation library would buy deep linking and gesture handling we do not use
 * yet, at the cost of another native dependency on a very new SDK. This keeps
 * the dependency surface to Expo-official packages.
 */
function Navigator() {
  const { addSession } = useAppStore();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [transitionKey, setTransitionKey] = useState(0);

  const current = stack[stack.length - 1];

  const push = useCallback((route: Route) => {
    setStack((previous) => [...previous, route]);
    setTransitionKey((key) => key + 1);
  }, []);

  const replace = useCallback((route: Route) => {
    setStack((previous) => [...previous.slice(0, -1), route]);
    setTransitionKey((key) => key + 1);
  }, []);

  const pop = useCallback(() => {
    setStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
    setTransitionKey((key) => key + 1);
  }, []);

  const popToTop = useCallback(() => {
    setStack([{ name: 'home' }]);
    setTransitionKey((key) => key + 1);
  }, []);

  // Android hardware back should walk the stack before it exits the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1) return false;
      pop();
      return true;
    });
    return () => subscription.remove();
  }, [stack.length, pop]);

  const handleSessionFinish = useCallback(
    (metrics: ScreamMetrics) => {
      const session: ScreamSession = {
        id: createSessionId(),
        // The session began `durationMs` before it ended, so anchor the
        // timestamp to the start rather than to the moment the user let go.
        startedAt: Date.now() - metrics.durationMs,
        metrics,
        percentile: percentileForScore(metrics.score),
        wasteAirLiters: computeWasteAir(metrics.screamEnergy),
      };

      // Show the result immediately; persistence catches up behind it.
      replace({ name: 'result', session });
      void addSession(session);
    },
    [addSession, replace],
  );

  return (
    <View style={styles.root}>
      <ScreenTransition key={transitionKey}>{renderRoute()}</ScreenTransition>
    </View>
  );

  function renderRoute() {
    switch (current.name) {
      case 'safety':
        return <SafetyScreen onContinue={() => push({ name: 'session' })} onBack={pop} />;

      case 'session':
        return <SessionScreen onFinish={handleSessionFinish} onCancel={pop} />;

      case 'result':
        return (
          <ResultScreen
            session={current.session}
            onAgain={() => replace({ name: 'session' })}
            onDone={popToTop}
          />
        );

      case 'history':
        return <HistoryScreen onBack={pop} />;

      case 'settings':
        return <SettingsScreen onBack={pop} />;

      case 'home':
      default:
        return (
          <HomeScreen
            onStart={() => push({ name: 'safety' })}
            onOpenHistory={() => push({ name: 'history' })}
            onOpenSettings={() => push({ name: 'settings' })}
          />
        );
    }
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bgDeep,
  },
});
