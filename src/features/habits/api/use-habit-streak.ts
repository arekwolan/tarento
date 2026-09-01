import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchHabitStreak } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { HabitStreak } from '@/features/habits/model/habit';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

export type UseHabitStreakResult = {
  streak: HabitStreak;
  isLoading: boolean;
  error: DataError | null;
};

const EMPTY_STREAK: HabitStreak = { currentStreak: 0, longestStreak: 0 };

/**
 * Seria dni dla nawyku. Liczona po stronie bazy (get_habit_streak), bo
 * wymaga całej historii logów — ściąganie jej na telefon byłoby marnotrawstwem.
 */
export function useHabitStreak(habitId: string | null): UseHabitStreakResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;
  const enabled = userId !== null && habitId !== null;

  const query = useQuery({
    queryKey: habitKeys.streak(userId ?? 'anonymous', habitId ?? 'none', today),
    queryFn: () => fetchHabitStreak(habitId ?? '', today),
    enabled,
    // Seria zmienia się przy każdym odhaczeniu, więc nie trzymamy jej jako świeżej.
    staleTime: STALE_TIME.today,
  });

  return {
    streak: query.data ?? EMPTY_STREAK,
    isLoading: query.isPending && enabled,
    error: query.error === null ? null : toDataError(query.error),
  };
}
