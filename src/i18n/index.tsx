import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { getLocales } from 'expo-localization';

import { enMessages, type Messages, type TranslationKey } from './en';
import { zhMessages } from './zh';

export type { TranslationKey };

/** What the user chose in Settings. */
export type LanguagePreference = 'system' | 'en' | 'zh';

/** What we actually render — 'system' resolved down to a real catalogue. */
export type ResolvedLanguage = 'en' | 'zh';

export const SUPPORTED_LANGUAGES: readonly ResolvedLanguage[] = ['en', 'zh'] as const;

const CATALOGUES: Record<ResolvedLanguage, Messages> = {
  en: enMessages,
  zh: zhMessages,
};

/**
 * Pick the best catalogue for the device's preferred languages.
 *
 * Chinese is matched on the bare language code so that zh-Hans, zh-Hant,
 * zh-CN and zh-TW all resolve here. Everything we do not ship falls back to
 * English, which is the product's primary market.
 */
export function resolveSystemLanguage(): ResolvedLanguage {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (code === 'zh') return 'zh';
    if (code === 'en') return 'en';
  }
  return 'en';
}

/** The BCP-47 tag we hand to `Intl` for number and date formatting. */
export function resolveLanguageTag(language: ResolvedLanguage): string {
  const preferred = getLocales()[0]?.languageTag;
  if (language === 'zh') {
    return preferred?.toLowerCase().startsWith('zh') ? preferred : 'zh-Hans';
  }
  return preferred?.toLowerCase().startsWith('en') ? preferred : 'en-US';
}

/**
 * Replace `{{name}}` placeholders. Kept deliberately dumb: no ICU, no
 * dependency, and the same syntax in every locale file.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

type I18nContextValue = {
  t: TranslateFn;
  /** The language actually being rendered. */
  language: ResolvedLanguage;
  /** The user's stored preference, which may be 'system'. */
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  /** BCP-47 tag for `Intl` formatting. */
  languageTag: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: React.ReactNode;
  preference: LanguagePreference;
  onPreferenceChange: (preference: LanguagePreference) => void;
};

export function I18nProvider({
  children,
  preference,
  onPreferenceChange,
}: I18nProviderProps) {
  // Bumping this forces a re-resolve of the device locale. Android lets users
  // change language without restarting the app, so we re-read on foreground.
  const [systemLanguage, setSystemLanguage] = useState<ResolvedLanguage>(() =>
    resolveSystemLanguage(),
  );

  useEffect(() => {
    if (preference !== 'system') return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSystemLanguage(resolveSystemLanguage());
    });
    return () => subscription.remove();
  }, [preference]);

  const language: ResolvedLanguage = preference === 'system' ? systemLanguage : preference;

  const t = useCallback<TranslateFn>(
    (key, params) => interpolate(CATALOGUES[language][key], params),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      t,
      language,
      preference,
      setPreference: onPreferenceChange,
      languageTag: resolveLanguageTag(language),
    }),
    [t, language, preference, onPreferenceChange],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside an <I18nProvider>');
  }
  return context;
}

/** Convenience hook when a component only needs the translate function. */
export function useTranslation(): TranslateFn {
  return useI18n().t;
}
