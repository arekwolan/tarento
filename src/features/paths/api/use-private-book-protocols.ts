import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPrivateBookProtocols } from '@/features/paths/api/paths-api';
import type { Path } from '@/features/paths/model/schemas';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: Path[] = [];

export type UsePrivateBookProtocolsResult = {
  paths: Path[];
  isLoading: boolean;
  error: DataError | null;
};

export function usePrivateBookProtocols(): UsePrivateBookProtocolsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: pathKeys.privateProtocols(userId ?? 'anonymous'),
    queryFn: fetchPrivateBookProtocols,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  return {
    paths: query.data ?? EMPTY,
    isLoading: query.isPending,
    error: query.error === null ? null : toDataError(query.error),
  };
}
