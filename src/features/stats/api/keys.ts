import type { IsoDate } from '@/lib/date';

export const statsKeys = {
  all: ['stats'] as const,
  daily: (userId: string, from: IsoDate, to: IsoDate) =>
    [...statsKeys.all, 'daily', userId, from, to] as const,
  habits: (userId: string, today: IsoDate) =>
    [...statsKeys.all, 'habits', userId, today] as const,
} as const;
