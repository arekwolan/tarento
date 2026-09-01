import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPathReadings } from '@/features/paths/api/paths-api';
import type { PathReading } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: PathReading[] = [];

export type UsePathReadingsResult = {
  readings: PathReading[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Lektury ścieżki, wszystkie tygodnie naraz.
 *
 * Osobne zapytanie od `usePath()`, bo katalog i ekran ścieżki ich nie
 * pokazują, a to najcięższa część treści — nie ma powodu wozić jej przy
 * każdym otwarciu karty.
 *
 * @param pathId id ścieżki albo `null`, gdy jeszcze nie wiadomo, której
 */
export function usePathReadings(pathId: string | null): UsePathReadingsResult {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const query = useQuery({
    queryKey: pathKeys.readings(userId, pathId ?? 'none'),
    queryFn: () => fetchPathReadings(pathId ?? ''),
    enabled: pathId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    readings: query.data ?? EMPTY,
    isLoading: query.isPending && pathId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      if (pathId !== null) void query.refetch();
    },
  };
}
