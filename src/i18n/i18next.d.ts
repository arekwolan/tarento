import 'i18next';

import type pl from '@/i18n/locales/pl.json';

/**
 * Dzięki temu `t('today.empty.title')` jest sprawdzane przez typecheck,
 * a literówka w kluczu jest błędem kompilacji, a nie surowym stringiem na
 * ekranie. pl.json jest źródłem prawdy dla kształtu kluczy.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof pl };
    returnNull: false;
  }
}
