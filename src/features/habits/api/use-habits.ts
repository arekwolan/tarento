import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { fetchActiveHabits } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { Habit } from '@/features/habits/model/habit';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

export type UseHabitsResult = {
  habits: Habit[];
  /** Pierwsze ładowanie, nie ma jeszcze czego pokazać. */
  isLoading: boolean;
  /** Dane są, ale lecą w tle świeże. */
  isRefreshing: boolean;
  error: DataError | null;
  refetch: () => void;
};

/** Aktywne (niezarchiwizowane) nawyki zalogowanego użytkownika. */
export function useHabits(): UseHabitsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: habitKeys.active(userId ?? 'anonymous'),
    queryFn: fetchActiveHabits,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  return {
    habits: query.data ?? [],
    isLoading: query.isPending && userId !== null,
    isRefreshing: query.isFetching && !query.isPending,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
