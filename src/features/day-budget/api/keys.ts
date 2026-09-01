/**
 * Klucze zapytań budżetu czasu. Wszystkie zaczynają się od 'day-budget', więc
 * jedna inwalidacja prefiksem czyści cały feature.
 *
 * userId jest częścią klucza celowo: po przelogowaniu cache poprzedniego
 * użytkownika nie może pokazać się nowemu.
 *
 * Data nie wchodzi do żadnego klucza: rotacja, szablony i bloki nie zależą od
 * dnia — dzień wybiera szablon dopiero w pamięci (templateForDate), więc jeden
 * pobrany zestaw obsługuje każdą datę.
 */
export const dayBudgetKeys = {
  all: ['day-budget'] as const,
  rotation: (userId: string) => [...dayBudgetKeys.all, 'rotation', userId] as const,
  templates: (userId: string) => [...dayBudgetKeys.all, 'templates', userId] as const,
  blocks: (userId: string) => [...dayBudgetKeys.all, 'blocks', userId] as const,
  restDays: (userId: string) => [...dayBudgetKeys.all, 'rest-days', userId] as const,
} as const;
