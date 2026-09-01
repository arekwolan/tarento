import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchUserPathPractices } from '@/features/paths/api/user-paths-api';
import type { UserPathPractice } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: UserPathPractice[] = [];

export type UseUserPathPracticesResult = {
  /** Wszystkie przypisania, także wycofane (`retiredOn` niepuste). */
  practices: UserPathPractice[];
  isLoading: boolean;
  error: DataError | null;
};

/**
 * Które nawyki użytkownika pochodzą z tej ścieżki.
 *
 * To jedyne miejsce, po którym da się to poznać: sam nawyk jest zwykłym
 * nawykiem i ekran „Dziś" nie odróżnia go od dodanego ręcznie.
 *
 * @param userPathId id zapisu albo `null`, gdy użytkownik nie jest na ścieżce
 */
export function useUserPathPractices(
  userPathId: string | null,
): UseUserPathPracticesResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = userId !== null && userPathId !== null;

  const query = useQuery({
    queryKey: pathKeys.practices(userId ?? 'anonymous', userPathId ?? 'none'),
    queryFn: () => fetchUserPathPractices(userPathId ?? ''),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  return {
    practices: query.data ?? EMPTY,
    isLoading: query.isPending && enabled,
    error: query.error === null ? null : toDataError(query.error),
  };
}
