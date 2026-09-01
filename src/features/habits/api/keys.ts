import type { IsoDate } from '@/lib/date';

/**
 * Klucze zapytań. Wszystkie zaczynają się od 'habits', więc jedna
 * inwalidacja prefiksem czyści cały feature.
 *
 * userId jest częścią klucza celowo: po przelogowaniu cache poprzedniego
 * użytkownika nie może pokazać się nowemu.
 */
export const habitKeys = {
  all: ['habits'] as const,
  detail: (userId: string, habitId: string) =>
    [...habitKeys.all, 'detail', userId, habitId] as const,
  active: (userId: string) => [...habitKeys.all, 'active', userId] as const,
  logs: (userId: string, date: IsoDate) =>
    [...habitKeys.all, 'logs', userId, date] as const,
  progress: (userId: string, before: IsoDate) =>
    [...habitKeys.all, 'progress', userId, before] as const,
  streaks: (userId: string, today: IsoDate) =>
    [...habitKeys.all, 'streaks', userId, today] as const,
  streak: (userId: string, habitId: string, today: IsoDate) =>
    [...habitKeys.all, 'streak', userId, habitId, today] as const,
  dayPlan: (userId: string, date: IsoDate) =>
    [...habitKeys.all, 'day-plan', userId, date] as const,
  planProgress: (userId: string, before: IsoDate) =>
    [...habitKeys.all, 'plan-progress', userId, before] as const,
  /** Wpisy jednego nawyku od podanej daty — pod propozycję zmniejszenia. */
  history: (userId: string, habitId: string, from: IsoDate) =>
    [...habitKeys.all, 'history', userId, habitId, from] as const,
  downshift: (userId: string, habitId: string) =>
    [...habitKeys.all, 'downshift', userId, habitId] as const,
  /** Nawyki zdjęte z listy — sekcja „Zdjęte z listy" i licznik zbudowanych. */
  retired: (userId: string) => [...habitKeys.all, 'retired', userId] as const,
  retirement: (userId: string, habitId: string) =>
    [...habitKeys.all, 'retirement', userId, habitId] as const,
  revisions: (userId: string, habitId: string) =>
    [...habitKeys.all, 'revisions', userId, habitId] as const,
  revisionPreview: (userId: string, habitId: string, revisionId: string) =>
    [...habitKeys.all, 'revision-preview', userId, habitId, revisionId] as const,
  /** Wpisy z dowolnego dnia — pod cofnięcie dnia z mapy. */
  dayLogs: (userId: string, date: IsoDate) =>
    [...habitKeys.all, 'day-logs', userId, date] as const,
  /** Stały klucz mutacji — po niej odtwarzamy kolejkę offline po restarcie. */
  toggleLog: () => [...habitKeys.all, 'toggle-log'] as const,
  /** Przywrócenie wersji jest persystowane i idempotentne po requestId. */
  restoreRevision: () => [...habitKeys.all, 'restore-revision'] as const,
} as const;
