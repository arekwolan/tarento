import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { trackEvent } from '@/features/analytics';
import {
  resolveProtocolConflict,
  scanProtocolConflicts,
  type ResolveProtocolConflictInput,
} from '@/features/conflict-radar/api/conflict-radar-api';
import type { ProtocolConflictReview } from '@/features/conflict-radar/model/schemas';
import { toDataError } from '@/lib/data-error';

type ScanInput = { requestId: string; pathId: string; locale: 'pl' | 'en' };

export function useProtocolConflictRadar() {
  const [review, setReview] = useState<ProtocolConflictReview | null>(null);
  const scanMutation = useMutation({
    mutationFn: (input: ScanInput) =>
      scanProtocolConflicts(input.requestId, input.pathId, input.locale),
    onSuccess: setReview,
  });
  const resolveMutation = useMutation({
    mutationFn: resolveProtocolConflict,
    onSuccess: (_, input) => {
      setReview((current) =>
        current === null
          ? null
          : {
              ...current,
              conflicts: current.conflicts.map((conflict) =>
                conflict.id === input.conflictId
                  ? {
                      ...conflict,
                      decision: input.decision,
                      contextA: input.contextA ?? null,
                      contextB: input.contextB ?? null,
                    }
                  : conflict,
              ),
            },
      );
      trackEvent('protocol_conflict_answered', {
        conflict_type: input.conflictType,
        decision: input.decision,
      });
    },
  });
  const caught = scanMutation.error ?? resolveMutation.error;

  return {
    review,
    scan: (input: ScanInput) => scanMutation.mutate(input),
    resolve: (input: ResolveProtocolConflictInput) => resolveMutation.mutate(input),
    reset: () => {
      setReview(null);
      scanMutation.reset();
      resolveMutation.reset();
    },
    isScanning: scanMutation.isPending,
    isResolving: resolveMutation.isPending,
    error: caught === null ? null : toDataError(caught),
  };
}
