import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchCatalog, type PathCatalogEntry } from '@/features/paths/api/paths-api';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const FALLBACK_LANGUAGE = 'pl';
const EMPTY: PathCatalogEntry[] = [];

export type UsePathsResult = {
  /** Ścieżki w kolejności `sortOrder`, każda ze swoimi etapami. */
  entries: PathCatalogEntry[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Katalog ścieżek w języku użytkownika.
 *
 * Treść jest wspólna i zmienia się tylko przy wydaniu, więc trzymamy ją
 * z czasem świeżości danych referencyjnych — katalog ma się otwierać
 * natychmiast, także bez sieci.
 */
export function usePaths(): UsePathsResult {
  const { profile } = useAuth();
  const language = profile?.locale ?? FALLBACK_LANGUAGE;

  const query = useQuery({
    queryKey: pathKeys.catalog(language),
    queryFn: () => fetchCatalog(language),
    staleTime: STALE_TIME.reference,
  });

  return {
    entries: query.data ?? EMPTY,
    isLoading: query.isPending,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
