import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import {
  archivePathTransferData,
  fetchPathImplementationConfirmations,
  fetchPathTransferResponses,
} from '@/features/paths/api/path-transfer-api';
import type {
  PathImplementationConfirmation,
  PathTransferResponse,
} from '@/features/paths/model/transfer';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient, STALE_TIME } from '@/lib/query-client';

type ConfirmationData = {
  confirmations: PathImplementationConfirmation[];
  responses: PathTransferResponse[];
};

const EMPTY_CONFIRMATIONS: PathImplementationConfirmation[] = [];
const EMPTY_RESPONSES: PathTransferResponse[] = [];

export type UseImplementationConfirmationsResult = ConfirmationData & {
  isLoading: boolean;
  isArchiving: boolean;
  error: DataError | null;
  archiveAnswers: (userPathId: string) => Promise<boolean>;
};

export function useImplementationConfirmations(): UseImplementationConfirmationsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: pathKeys.confirmations(userId ?? 'anonymous'),
    queryFn: async (): Promise<ConfirmationData> => {
      const [confirmations, responses] = await Promise.all([
        fetchPathImplementationConfirmations(),
        fetchPathTransferResponses(),
      ]);
      return { confirmations, responses };
    },
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  const archiveMutation = useMutation({
    mutationFn: archivePathTransferData,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pathKeys.all });
    },
  });

  return {
    confirmations: query.data?.confirmations ?? EMPTY_CONFIRMATIONS,
    responses: query.data?.responses ?? EMPTY_RESPONSES,
    isLoading: query.isPending && userId !== null,
    isArchiving: archiveMutation.isPending,
    error:
      query.error === null && archiveMutation.error === null
        ? null
        : toDataError(query.error ?? archiveMutation.error),
    archiveAnswers: async (userPathId) => {
      try {
        await archiveMutation.mutateAsync(userPathId);
        return true;
      } catch {
        return false;
      }
    },
  };
}
