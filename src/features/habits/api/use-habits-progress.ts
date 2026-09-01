import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchHabitsProgress } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

export type UseHabitsProgressResult = {
  /** habitId → liczba wykonań sprzed dzisiaj. */
  completedCounts: ReadonlyMap<string, number>;
  isLoading: boolean;
  error: DataError | null;
};

const EMPTY: ReadonlyMap<string, number> = new Map();

/**
 * Liczniki wykonań pod wyliczanie celu.
 *
 * Ten sam klucz zapytania co w useTodayTasks, więc oba hooki korzystają
 * z jednej odpowiedzi.
 */
export function useHabitsProgress(): UseHabitsProgressResult {
  const { user } = useAuth();
  const date = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: habitKeys.progress(userId ?? 'anonymous', date),
    queryFn: () => fetchHabitsProgress(date),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });

  return {
    completedCounts: query.data ?? EMPTY,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
  };
}
