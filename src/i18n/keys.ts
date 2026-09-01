import type { ParseKeys } from 'i18next';

/**
 * Wszystkie klucze istniejące w pl.json (i, dzięki testowi parzystości,
 * w en.json). Typ pochodzi z augmentacji w src/i18n/i18next.d.ts.
 *
 * Dzięki temu klucz da się przekazywać między modułami jako wartość i nadal
 * jest sprawdzany przez typecheck — bez rzutowania na wejściu do t().
 */
export type TranslationKey = ParseKeys;
