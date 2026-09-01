/**
 * Klucze zapytań feature'u powiadomień.
 *
 * Wszystkie zaczynają się od 'notifications', więc jedna inwalidacja
 * prefiksem czyści cały feature. userId jest częścią klucza celowo:
 * po przelogowaniu cudze wyciszenie nie może obowiązywać.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  quietWeek: (userId: string) => [...notificationKeys.all, 'quiet-week', userId] as const,
  quietSignal: (userId: string, from: string) =>
    [...notificationKeys.all, 'quiet-signal', userId, from] as const,
} as const;
