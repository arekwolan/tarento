import { useState } from 'react';
import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { habitKeys } from '@/features/habits';
import { pathKeys } from '@/features/paths/api/keys';
import {
  fetchPathTransferResponses,
  submitPathTransfer,
} from '@/features/paths/api/path-transfer-api';
import type { PathKind } from '@/features/paths/model/schemas';
import {
  createPathTransferRequestId,
  TRANSFER_DEFER_DAYS,
  type PathTransferResponse,
  type PathTransferSubmitResult,
  type TransferDecision,
  type TransferResponse,
} from '@/features/paths/model/transfer';
import { toDataError, type DataError } from '@/lib/data-error';
import { addDays, nowIso, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type PathTransferMutationVariables = {
  userId: string;
  userPathId: string;
  stageId: string;
  requestId: string;
  response: TransferResponse;
  decision: TransferDecision;
  evidence: string | null;
  protocolType: PathKind;
  today: IsoDate;
};

type TransferMutationContext = {
  previousForPath: PathTransferResponse[] | undefined;
  previousAll: PathTransferResponse[] | undefined;
};

function optimisticResponse(
  variables: PathTransferMutationVariables,
): PathTransferResponse {
  return {
    id: `optimistic:${variables.requestId}`,
    userId: variables.userId,
    userPathId: variables.userPathId,
    stageId: variables.stageId,
    clientRequestId: variables.requestId,
    response: variables.response,
    decision: variables.decision,
    evidence: variables.evidence,
    protocolType: variables.protocolType,
    answeredOn: variables.today,
    deferUntil:
      variables.decision === 'advance'
        ? null
        : addDays(variables.today, TRANSFER_DEFER_DAYS),
    advancedToStageId: null,
    retiredHabitIds: [],
    retiredTitles: [],
    archivedAt: null,
    createdAt: nowIso(),
  };
}

const writeTransfer: MutationFunction<
  PathTransferSubmitResult,
  PathTransferMutationVariables
> = (variables) =>
  submitPathTransfer({
    userPathId: variables.userPathId,
    stageId: variables.stageId,
    clientRequestId: variables.requestId,
    response: variables.response,
    decision: variables.decision,
    evidence: variables.evidence,
    today: variables.today,
  });

const transferMutationDefaults = {
  mutationFn: writeTransfer,

  async onMutate(
    variables: PathTransferMutationVariables,
  ): Promise<TransferMutationContext> {
    const pathKey = pathKeys.transfers(variables.userId, variables.userPathId);
    const allKey = pathKeys.allTransfers(variables.userId);

    await queryClient.cancelQueries({ queryKey: pathKey });
    await queryClient.cancelQueries({ queryKey: allKey });

    const previousForPath = queryClient.getQueryData<PathTransferResponse[]>(pathKey);
    const previousAll = queryClient.getQueryData<PathTransferResponse[]>(allKey);
    const optimistic = optimisticResponse(variables);

    queryClient.setQueryData<PathTransferResponse[]>(pathKey, (current = []) => [
      optimistic,
      ...current,
    ]);
    queryClient.setQueryData<PathTransferResponse[]>(allKey, (current = []) => [
      optimistic,
      ...current,
    ]);

    return { previousForPath, previousAll };
  },

  onError(
    _error: unknown,
    variables: PathTransferMutationVariables,
    context: TransferMutationContext | undefined,
  ) {
    if (context === undefined) return;
    queryClient.setQueryData(
      pathKeys.transfers(variables.userId, variables.userPathId),
      context.previousForPath,
    );
    queryClient.setQueryData(
      pathKeys.allTransfers(variables.userId),
      context.previousAll,
    );
  },

  onSettled() {
    void queryClient.invalidateQueries({ queryKey: pathKeys.all });
    void queryClient.invalidateQueries({ queryKey: habitKeys.all });
  },
};

export function registerPathTransferMutationDefaults(): void {
  queryClient.setMutationDefaults(pathKeys.submitTransfer(), transferMutationDefaults);
}

export type SubmitTransferInput = {
  userPathId: string;
  stageId: string;
  response: TransferResponse;
  decision: TransferDecision;
  evidence: string;
  protocolType: PathKind;
};

export type UsePathTransferResult = {
  responses: PathTransferResponse[];
  submit: (input: SubmitTransferInput) => void;
  lastResult: PathTransferSubmitResult | null;
  clearLastResult: () => void;
  isLoading: boolean;
  isPending: boolean;
  isQueued: boolean;
  error: DataError | null;
};

const EMPTY: PathTransferResponse[] = [];

export function usePathTransfer(userPathId: string | null): UsePathTransferResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;
  const [lastResult, setLastResult] = useState<PathTransferSubmitResult | null>(null);

  const query = useQuery({
    queryKey: pathKeys.transfers(userId ?? 'anonymous', userPathId ?? 'none'),
    queryFn: () => fetchPathTransferResponses(userPathId ?? ''),
    enabled: userId !== null && userPathId !== null,
    staleTime: STALE_TIME.today,
  });

  const mutation = useMutation<
    PathTransferSubmitResult,
    Error,
    PathTransferMutationVariables,
    TransferMutationContext
  >({
    mutationKey: pathKeys.submitTransfer(),
    onSuccess: setLastResult,
  });

  return {
    responses: query.data ?? EMPTY,
    submit: ({
      userPathId: submittedUserPathId,
      stageId,
      response,
      decision,
      evidence,
      protocolType,
    }) => {
      if (userId === null) return;
      const trimmed = evidence.trim();

      mutation.mutate({
        userId,
        userPathId: submittedUserPathId,
        stageId,
        requestId: createPathTransferRequestId(),
        response,
        decision,
        evidence: trimmed === '' ? null : trimmed,
        protocolType,
        today,
      });
    },
    lastResult,
    clearLastResult: () => {
      setLastResult(null);
    },
    isLoading: query.isPending && userId !== null && userPathId !== null,
    isPending: mutation.isPending,
    isQueued: mutation.isPaused,
    error:
      query.error === null && mutation.error === null
        ? null
        : toDataError(query.error ?? mutation.error),
  };
}
