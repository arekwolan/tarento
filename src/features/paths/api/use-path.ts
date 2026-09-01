import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPathDetail, fetchPathDetailById } from '@/features/paths/api/paths-api';
import type { Path, PathPractice, PathStage } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const FALLBACK_LANGUAGE = 'pl';

const EMPTY_STAGES: PathStage[] = [];
const EMPTY_PRACTICES: PathPractice[] = [];

export type UsePathResult = {
  /** `null` również wtedy, gdy sluga nie ma albo ścieżka nie jest opublikowana. */
  path: Path | null;
  stages: PathStage[];
  /** Praktyki wszystkich etapów naraz; przypisanie niesie `stageId`. */
  practices: PathPractice[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Pełna treść jednej ścieżki: definicja, etapy i praktyki.
 *
 * `pathId` przypina ekran otwarty z „Kontynuuj" do wersji, na którą użytkownik
 * faktycznie się zapisał. Bez niego katalog nadal wybiera najnowszą wersję po
 * slugu i języku.
 */
export function usePath(slug: string, pathId: string | null = null): UsePathResult {
  const { profile, user } = useAuth();
  const language = profile?.locale ?? FALLBACK_LANGUAGE;
  const userId = user?.id ?? 'anonymous';
  const isEnabled = pathId !== null || slug !== '';

  const query = useQuery({
    queryKey:
      pathId === null
        ? pathKeys.detail(language, slug)
        : pathKeys.detailById(userId, pathId),
    queryFn: () =>
      pathId === null ? fetchPathDetail(slug, language) : fetchPathDetailById(pathId),
    enabled: isEnabled,
    staleTime: STALE_TIME.reference,
  });

  return {
    path: query.data?.path ?? null,
    stages: query.data?.stages ?? EMPTY_STAGES,
    practices: query.data?.practices ?? EMPTY_PRACTICES,
    isLoading: query.isPending && isEnabled,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
