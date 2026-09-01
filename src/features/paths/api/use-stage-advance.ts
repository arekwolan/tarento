import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPathCompletionRatio } from '@/features/paths/api/path-actions-api';
import { useActiveUserPath } from '@/features/paths/api/use-active-user-path';
import { usePathById } from '@/features/paths/api/use-path-by-id';
import {
  usePathTransfer,
  type SubmitTransferInput,
} from '@/features/paths/api/use-path-transfer';
import { optionalPracticeIds } from '@/features/paths/model/fit';
import type { Path, PathPractice, PathStage } from '@/features/paths/model/schemas';
import { practicesForStage, shouldAdvance } from '@/features/paths/model/stage';
import { isTransferSuppressed } from '@/features/paths/model/transfer';
import { daysBetween } from '@/lib/date';
import type { DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const COMPLETION_WINDOW_DAYS = 14;

export type StageTransition = {
  userPathId: string;
  fromStageId: string;
  reason: 'threshold' | 'ceiling';
  nextStage: PathStage;
  adds: PathPractice[];
  removes: PathPractice[];
};

export type StageTransferCheck = {
  userPathId: string;
  path: Path;
  stage: PathStage;
  reason: 'threshold' | 'ceiling';
  transition: StageTransition | null;
  isFinalStage: boolean;
};

export type PathCompletion = {
  userPathId: string;
  path: Path;
};

export type UseStageAdvanceResult = {
  ready: StageTransferCheck | null;
  check: StageTransferCheck | null;
  beginCheck: () => void;
  dismissCheck: () => void;
  submitTransfer: (
    input: Omit<SubmitTransferInput, 'userPathId' | 'stageId' | 'protocolType'>,
  ) => void;
  completion: PathCompletion | null;
  dismissCompletion: () => void;
  lastAdvanceResult: ReturnType<typeof usePathTransfer>['lastResult'];
  clearLastAdvanceResult: () => void;
  isPending: boolean;
  isQueued: boolean;
  error: DataError | null;
};

export function useStageAdvance(): UseStageAdvanceResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const { userPath } = useActiveUserPath();
  const { path, stages, practices } = usePathById(userPath?.pathId ?? null);
  const transfer = usePathTransfer(userPath?.id ?? null);

  const [openedStageId, setOpenedStageId] = useState<string | null>(null);
  const [dismissedCompletion, setDismissedCompletion] = useState<string | null>(null);

  const ratioQuery = useQuery({
    queryKey: pathKeys.completion(userId ?? 'anonymous', userPath?.id ?? 'none', today),
    queryFn: () =>
      fetchPathCompletionRatio(userPath?.id ?? '', today, COMPLETION_WINDOW_DAYS),
    enabled: userId !== null && userPath !== null,
    staleTime: STALE_TIME.today,
  });

  const due = useMemo(() => {
    if (userPath === null || path === null || stages.length === 0) return null;
    if (!ratioQuery.isSuccess || transfer.isLoading) return null;

    const stage = stages.find((candidate) => candidate.id === userPath.currentStageId);
    if (stage === undefined) return null;

    const daysInStage = daysBetween(userPath.stageEnteredOn, today);
    const verdict = shouldAdvance(stage, daysInStage, ratioQuery.data);
    if (verdict === 'no') return null;

    const latest =
      transfer.responses.find((response) => response.stageId === stage.id) ?? null;
    const nextStage =
      stages.find((candidate) => candidate.ordinal > stage.ordinal) ?? null;

    return { stage, verdict, latest, nextStage };
  }, [userPath, path, stages, ratioQuery.isSuccess, ratioQuery.data, transfer, today]);

  const ready = useMemo<StageTransferCheck | null>(() => {
    if (due === null || userPath === null || path === null) return null;
    if (isTransferSuppressed(today, userPath.reentryUntil, due.latest)) return null;

    let transition: StageTransition | null = null;

    if (due.nextStage !== null) {
      const lite = userPath.fit?.lite ?? false;
      const adds = practicesForStage(
        due.nextStage,
        practices,
        lite ? optionalPracticeIds(practices) : [],
      );
      const retiredIds = new Set(
        adds
          .map((practice) => practice.retiresPracticeId)
          .filter((id): id is string => id !== null),
      );

      transition = {
        userPathId: userPath.id,
        fromStageId: due.stage.id,
        reason: due.verdict,
        nextStage: due.nextStage,
        adds,
        removes: practices.filter((practice) => retiredIds.has(practice.id)),
      };
    }

    return {
      userPathId: userPath.id,
      path,
      stage: due.stage,
      reason: due.verdict,
      transition,
      isFinalStage: due.nextStage === null,
    };
  }, [due, userPath, path, practices, today]);

  const completion = useMemo<PathCompletion | null>(() => {
    if (due === null || userPath === null || path === null) return null;
    if (due.nextStage !== null || dismissedCompletion === userPath.id) return null;

    if (due.latest?.decision !== 'advance' || due.latest.id.startsWith('optimistic:')) {
      return null;
    }

    return { userPathId: userPath.id, path };
  }, [due, userPath, path, dismissedCompletion]);

  const check = ready?.stage.id === openedStageId ? ready : null;

  return {
    ready,
    check,
    beginCheck: () => {
      if (ready !== null) setOpenedStageId(ready.stage.id);
    },
    dismissCheck: () => {
      setOpenedStageId(null);
    },
    submitTransfer: (input) => {
      if (check === null) return;
      transfer.submit({
        ...input,
        userPathId: check.userPathId,
        stageId: check.stage.id,
        protocolType: check.path.pathKind,
      });
      setOpenedStageId(null);
    },
    completion,
    dismissCompletion: () => {
      if (completion !== null) setDismissedCompletion(completion.userPathId);
    },
    lastAdvanceResult: transfer.lastResult,
    clearLastAdvanceResult: transfer.clearLastResult,
    isPending: transfer.isPending,
    isQueued: transfer.isQueued,
    error: transfer.error,
  };
}
