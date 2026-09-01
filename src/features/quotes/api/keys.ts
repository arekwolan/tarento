import type { IsoDate } from '@/lib/date';

export const quoteKeys = {
  all: ['quotes'] as const,
  daily: (userId: string, date: IsoDate) =>
    [...quoteKeys.all, 'daily', userId, date] as const,
  favoriteList: (userId: string) => [...quoteKeys.all, 'favorite-list', userId] as const,
  history: (userId: string) => [...quoteKeys.all, 'history', userId] as const,
  favorites: (userId: string) => [...quoteKeys.all, 'favorites', userId] as const,
  /** Stały klucz mutacji — po niej odtwarzamy kolejkę offline po restarcie. */
  toggleFavorite: () => [...quoteKeys.all, 'toggle-favorite'] as const,
} as const;
