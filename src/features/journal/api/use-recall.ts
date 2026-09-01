import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchNotesForDates } from '@/features/journal/api/day-notes-api';
import { journalKeys } from '@/features/journal/api/keys';
import { pickRecall, recallDates, type Recall } from '@/features/journal/model/day-note';
import { STALE_TIME } from '@/lib/query-client';

export type UseRecallResult = {
  /** Wpis, który dziś wraca. `null`, gdy żadna z trzech dat go nie ma. */
  recall: Recall | null;
  isLoading: boolean;
};

/**
 * Przywołanie sprzed 30, 90 albo 365 dni.
 *
 * Trzy daty jednym zapytaniem, bo i tak wchodzą razem do jednej decyzji.
 * Wybór należy do czystej funkcji — hook nie zna kolejności priorytetu.
 */
export function useRecall(): UseRecallResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();

  const query = useQuery({
    queryKey: journalKeys.recall(userId ?? 'anonymous', today),
    queryFn: () => fetchNotesForDates(recallDates(today)),
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    recall: pickRecall(query.data ?? [], today),
    isLoading: query.isPending && userId !== null,
  };
}
