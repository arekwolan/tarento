import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchOpenUserPaths } from '@/features/paths/api/user-paths-api';
import type { UserPath } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: UserPath[] = [];

export type UseActiveUserPathResult = {
  /** Ścieżka aktywna. `null`, gdy użytkownik nie prowadzi żadnej. */
  userPath: UserPath | null;
  /**
   * Wszystko, co się jeszcze nie skończyło: aktywna i wstrzymane. Wstrzymana
   * ścieżka nie jest aktywna, ale ekran musi ją znaleźć, żeby dało się ją
   * wznowić.
   */
  openPaths: UserPath[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Zapisy użytkownika, które jeszcze trwają.
 *
 * Aktywna jest najwyżej jedna — pilnuje tego indeks częściowy w bazie,
 * a decyzja jest produktowa: dwie równoległe ścieżki gwarantują przekroczenie
 * budżetu doby. Wstrzymanych może być więcej, bo pauza nie blokuje niczego.
 */
export function useActiveUserPath(): UseActiveUserPathResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: pathKeys.active(userId ?? 'anonymous'),
    queryFn: fetchOpenUserPaths,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  const openPaths = query.data ?? EMPTY;

  return {
    userPath: openPaths.find((path) => path.state === 'active') ?? null,
    openPaths,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
