import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  clearHistory,
  consumeMicStartPending,
  DEFAULT_SETTINGS,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
  summarize,
  MAX_STORED_SESSIONS,
  type AppSettings,
} from '../storage/store';
import type { HistorySummary, ScreamSession } from '../types';

type AppStoreValue = {
  /** False until the first read from disk completes. */
  hydrated: boolean;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  history: ScreamSession[];
  summary: HistorySummary;
  addSession: (session: ScreamSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /**
   * True when the previous run died while starting the microphone.
   * Set once on hydration and cleared by the user dismissing the notice.
   */
  micStartCrashed: boolean;
  clearMicStartCrash: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

/**
 * Single source of truth for settings and scream history.
 *
 * Hydration is deliberately non-blocking: the UI renders immediately with
 * defaults and re-renders once the disk read finishes. Showing a spinner over a
 * sub-100 ms AsyncStorage read would be worse than a brief default.
 */
export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<ScreamSession[]>([]);
  const [micStartCrashed, setMicStartCrashed] = useState(false);

  /**
   * Mirror of `history` for callbacks that must not depend on it.
   *
   * List mutations are computed from this ref rather than inside a `setState`
   * updater, because React is allowed to invoke an updater more than once (and
   * does, under StrictMode) — side effects inside one would run twice.
   */
  const historyRef = useRef<ScreamSession[]>([]);

  /** Mirror of `settings`, for the same reason as `historyRef` above. */
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  const commitHistory = useCallback((next: ScreamSession[]) => {
    historyRef.current = next;
    setHistory(next);
    void saveHistory(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedSettings, storedHistory, crashed] = await Promise.all([
        loadSettings(),
        loadHistory(),
        consumeMicStartPending(),
      ]);
      if (cancelled) return;
      historyRef.current = storedHistory;
      settingsRef.current = storedSettings;
      setSettings(storedSettings);
      setHistory(storedHistory);
      setMicStartCrashed(crashed);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    // Fire and forget: the in-memory value is already correct, and a failed
    // write only means the choice does not survive a restart.
    void saveSettings(next);
  }, []);

  const addSession = useCallback(
    async (session: ScreamSession) => {
      commitHistory([session, ...historyRef.current].slice(0, MAX_STORED_SESSIONS));
    },
    [commitHistory],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      commitHistory(historyRef.current.filter((session) => session.id !== id));
    },
    [commitHistory],
  );

  const clearAll = useCallback(async () => {
    historyRef.current = [];
    setHistory([]);
    await clearHistory();
  }, []);

  const clearMicStartCrash = useCallback(() => setMicStartCrashed(false), []);

  const summary = useMemo(() => summarize(history), [history]);

  const value = useMemo<AppStoreValue>(
    () => ({
      hydrated,
      settings,
      updateSettings,
      history,
      summary,
      addSession,
      deleteSession,
      clearAll,
      micStartCrashed,
      clearMicStartCrash,
    }),
    [
      hydrated,
      settings,
      updateSettings,
      history,
      summary,
      addSession,
      deleteSession,
      clearAll,
      micStartCrashed,
      clearMicStartCrash,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used inside an <AppStoreProvider>');
  }
  return context;
}
