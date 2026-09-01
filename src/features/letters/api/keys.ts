import type { IsoDate } from '@/lib/date';

/**
 * Klucze zapytań o listy.
 *
 * Data wchodzi do klucza, bo termin doręczenia rozstrzyga się na dobie
 * logicznej: list, który wczoraj jeszcze czekał, dziś ma się pokazać.
 */
export const letterKeys = {
  all: ['letters'] as const,
  due: (userId: string, today: IsoDate) =>
    [...letterKeys.all, 'due', userId, today] as const,
  delivered: (userId: string) => [...letterKeys.all, 'delivered', userId] as const,
} as const;
