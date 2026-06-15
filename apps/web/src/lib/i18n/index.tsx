'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import zh, { type Translations } from './locales/zh';
import en from './locales/en';
import ja from './locales/ja';
import fr from './locales/fr';

export type Locale = 'zh' | 'en' | 'ja' | 'fr';

const locales: Record<Locale, Translations> = { zh, en, ja, fr };

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  fr: 'Français',
};

const STORAGE_KEY = 'app-locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: zh,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && locales[stored]) setLocaleState(stored);
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : newLocale;
  }, []);

  const t = locales[locale];

  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: 'zh', setLocale, t: zh }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export type { Translations };
