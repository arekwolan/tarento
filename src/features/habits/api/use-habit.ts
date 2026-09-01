import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { fetchHabit } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { Habit } from '@/features/habits/model/habit';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

export type UseHabitResult = {
  habit: Habit | null;
  isLoading: boolean;
  error: DataError | null;
};

/** Pojedynczy nawyk — do ekranu edycji. */
export function useHabit(habitId: string | null): UseHabitResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = userId !== null && habitId !== null;

  const query = useQuery({
    queryKey: habitKeys.detail(userId ?? 'anonymous', habitId ?? 'none'),
    queryFn: () => fetchHabit(habitId ?? ''),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  return {
    habit: query.data ?? null,
    isLoading: query.isPending && enabled,
    error: query.error === null ? null : toDataError(query.error),
  };
}
