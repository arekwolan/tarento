import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchHabitPlanProgress } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: ReadonlyMap<string, number> = new Map();

/** Historyczne okazje oczekiwane, używane przez progresję calendar. */
export function useHabitPlanProgress(): ReadonlyMap<string, number> {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: habitKeys.planProgress(userId ?? 'anonymous', today),
    queryFn: () => fetchHabitPlanProgress(today),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });

  return query.data ?? EMPTY;
}
