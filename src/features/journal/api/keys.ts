import type { IsoDate } from '@/lib/date';

/**
 * Klucze zapytań dziennika. Prefiks 'journal' pozwala unieważnić cały feature
 * jednym wywołaniem; userId w kluczu — żeby po przelogowaniu nie pokazał się
 * cudzy wpis.
 */
export const journalKeys = {
  all: ['journal'] as const,
  note: (userId: string, date: IsoDate) =>
    [...journalKeys.all, 'note', userId, date] as const,
  recall: (userId: string, date: IsoDate) =>
    [...journalKeys.all, 'recall', userId, date] as const,
} as const;
