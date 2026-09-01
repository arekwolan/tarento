import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import {
  deleteLogsForDate,
  fetchLogsForDate,
  habitKeys,
  restoreHabitLogs,
  type HabitLog,
} from '@/features/habits';
import { statsKeys } from '@/features/stats/api/keys';
import type { IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

/**
 * Cofnięcie dnia.
 *
 * Ludzie okłamują serię, potem czują się źle z tym kłamstwem, a potem
 * rezygnują. Czysty sposób na korektę utrzymuje dane prawdziwymi i relację
 * uczciwą — dlatego to jedyne miejsce, gdzie kasujemy wpisy hurtem, i jedyne
 * w tym przepływie, gdzie wolno użyć koloru `danger`.
 *
 * Hook mieszka w statystykach, bo stamtąd wychodzi gest: długie przytrzymanie
 * na dniu w mapie. Wpisy zmienia przez publiczne API nawyków.
 */

const EMPTY: HabitLog[] = [];

/** Cofnięcie dnia rusza i listę nawyków, i agregaty mapy dni. */
function invalidateEverything(): void {
  void queryClient.invalidateQueries({ queryKey: habitKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

export type UseDayUndoResult = {
  logs: HabitLog[];
  isLoading: boolean;
  isClearing: boolean;
  /** Kasuje wpisy z dnia. Zwraca cofnięcie albo null, gdy zapis się nie udał. */
  clear: () => Promise<(() => void) | null>;
};

export function useDayUndo(date: IsoDate | null): UseDayUndoResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = userId !== null && date !== null;

  const query = useQuery({
    queryKey: habitKeys.dayLogs(userId ?? 'anonymous', date ?? 'none'),
    queryFn: () => fetchLogsForDate(date ?? ''),
    enabled,
    staleTime: STALE_TIME.today,
  });

  const clearMutation = useMutation({
    mutationFn: (day: IsoDate) => deleteLogsForDate(day),
    onSuccess: invalidateEverything,
  });

  const restoreMutation = useMutation({
    mutationFn: (logs: readonly HabitLog[]) => restoreHabitLogs(logs),
    onSuccess: invalidateEverything,
  });

  const logs = query.data ?? EMPTY;

  const clear = useCallback(async () => {
    if (date === null || logs.length === 0) return null;

    const removed = [...logs];

    try {
      await clearMutation.mutateAsync(date);
    } catch {
      return null;
    }

    return () => {
      restoreMutation.mutate(removed);
    };
  }, [date, logs, clearMutation, restoreMutation]);

  return {
    logs,
    isLoading: query.isPending && enabled,
    isClearing: clearMutation.isPending,
    clear,
  };
}
