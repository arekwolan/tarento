import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { fetchDeliveredLetters } from '@/features/letters/api/letters-api';
import { letterKeys } from '@/features/letters/api/keys';
import type { Letter } from '@/features/letters/model/letter';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const EMPTY: Letter[] = [];

export type UseDeliveredLettersResult = {
  letters: Letter[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/** Prywatne listy, które już wróciły do użytkownika. */
export function useDeliveredLetters(): UseDeliveredLettersResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: letterKeys.delivered(userId ?? 'anonymous'),
    queryFn: fetchDeliveredLetters,
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    letters: query.data ?? EMPTY,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
