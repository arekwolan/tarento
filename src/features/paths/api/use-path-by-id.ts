import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPathDetailById } from '@/features/paths/api/paths-api';
import type { Path, PathPractice, PathStage } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY_STAGES: PathStage[] = [];
const EMPTY_PRACTICES: PathPractice[] = [];

export type UsePathByIdResult = {
  path: Path | null;
  stages: PathStage[];
  practices: PathPractice[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Treść ścieżki, na którą użytkownik jest zapisany.
 *
 * Osobno od `usePath(slug)`, bo `user_paths` wskazuje wersję ścieżki, a nie
 * slug — i musi wskazywać dokładnie tę, którą użytkownik zaczął.
 *
 * @param pathId id wersji ścieżki albo `null`, gdy nie ma zapisu
 */
export function usePathById(pathId: string | null): UsePathByIdResult {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const query = useQuery({
    queryKey: pathKeys.detailById(userId, pathId ?? 'none'),
    queryFn: () => fetchPathDetailById(pathId ?? ''),
    enabled: pathId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    path: query.data?.path ?? null,
    stages: query.data?.stages ?? EMPTY_STAGES,
    practices: query.data?.practices ?? EMPTY_PRACTICES,
    isLoading: query.isPending && pathId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
