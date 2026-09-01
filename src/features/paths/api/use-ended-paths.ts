import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchEndedPaths } from '@/features/paths/api/user-paths-api';
import type { EndedPath } from '@/features/paths/model/repeat';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: EndedPath[] = [];

export type UseEndedPathsResult = {
  /** Zakończone ścieżki użytkownika, od najnowszej. */
  endedPaths: EndedPath[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Historia zakończeń — jedyne wejście do reguły karencji.
 *
 * Przy regule karencji brak danych nadal oznacza brak blokady. Biblioteka
 * korzysta jednak z jawnego stanu błędu, żeby nie udawać pustej historii.
 */
export function useEndedPaths(): UseEndedPathsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: pathKeys.ended(userId ?? 'anonymous'),
    queryFn: fetchEndedPaths,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  return {
    endedPaths: query.data ?? EMPTY,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
