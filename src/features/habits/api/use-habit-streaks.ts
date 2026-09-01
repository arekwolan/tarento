import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchHabitsStreaks } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { HabitStreak } from '@/features/habits/model/habit';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

export type UseHabitStreaksResult = {
  /** habitId → seria. Brak klucza znaczy „jeszcze nie policzono". */
  streaks: ReadonlyMap<string, HabitStreak>;
  isLoading: boolean;
  error: DataError | null;
};

const EMPTY: ReadonlyMap<string, HabitStreak> = new Map();

/**
 * Serie wszystkich aktywnych nawyków w jednym zapytaniu.
 *
 * Wersja dla list. Do pojedynczego nawyku jest useHabitStreak(), ale na
 * ekranie „Dziś" wołanie go w pętli oznaczałoby tyle zapytań, ile pozycji.
 */
export function useHabitStreaks(): UseHabitStreaksResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: habitKeys.streaks(userId ?? 'anonymous', today),
    queryFn: () => fetchHabitsStreaks(today),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });

  return {
    streaks: query.data ?? EMPTY,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
  };
}
