import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchRetiredHabits, setHabitRetired } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { Habit } from '@/features/habits/model/habit';
import { createHabitRevisionRequestId } from '@/features/habits/model/revision';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient, STALE_TIME } from '@/lib/query-client';

const EMPTY: Habit[] = [];

export type UseRetiredHabitsResult = {
  /** Nawyki zdjęte z listy, od najnowszego. */
  habits: Habit[];
  /**
   * Ile nawyków użytkownik zbudował.
   *
   * Jedyna liczba w aplikacji, która ma rosnąć bez końca — i dlatego jedyna,
   * która nie jest miarą tego, ile dziś odhaczono.
   */
  builtCount: number;
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
  /** Przywraca nawyk na listę. */
  restore: (habitId: string) => void;
  isRestoring: boolean;
};

export function useRetiredHabits(): UseRetiredHabitsResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: habitKeys.retired(userId ?? 'anonymous'),
    queryFn: fetchRetiredHabits,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  const restoreMutation = useMutation({
    mutationFn: (habit: Habit) =>
      setHabitRetired(habit.id, false, {
        effectiveOn: today,
        requestId: createHabitRevisionRequestId(),
        expectedUpdatedAt: habit.updatedAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });

  const habits = query.data ?? EMPTY;

  return {
    habits,
    builtCount: habits.length,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
    restore: (habitId) => {
      const habit = habits.find((candidate) => candidate.id === habitId);
      if (habit !== undefined) restoreMutation.mutate(habit);
    },
    isRestoring: restoreMutation.isPending,
  };
}
