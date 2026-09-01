import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';

export const supportedLanguages = ['pl', 'en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** Polski jest domyślny i zapasowy — patrz CLAUDE.md, sekcja Język. */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'pl';

export const resources = {
  pl: { translation: pl },
  en: { translation: en },
} as const;

function isSupported(code: string | null): code is SupportedLanguage {
  return code !== null && (supportedLanguages as readonly string[]).includes(code);
}

/** Pierwszy język urządzenia, który umiemy obsłużyć; inaczej polski. */
export function detectLanguage(): SupportedLanguage {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) {
      return locale.languageCode;
    }
  }
  return FALLBACK_LANGUAGE;
}

// i18next eksportuje również nazwany `use`, przez co reguła bierze metodę
// instancji za ten eksport. Fluent API i18next jest tutaj poprawne.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: supportedLanguages,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
