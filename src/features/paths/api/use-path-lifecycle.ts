import { useMutation } from '@tanstack/react-query';

import { useLogicalToday } from '@/features/auth';
import { habitKeys } from '@/features/habits';
import { pathKeys } from '@/features/paths/api/keys';
import {
  endPath,
  pausePath,
  resumePath,
  type PracticesDecision,
} from '@/features/paths/api/path-actions-api';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient } from '@/lib/query-client';

/** Pauza i powrót zmieniają listę na dziś, cele i serie naraz. */
function invalidateLifecycle(): void {
  void queryClient.invalidateQueries({ queryKey: habitKeys.all });
  void queryClient.invalidateQueries({ queryKey: pathKeys.all });
}

export type UsePathLifecycleResult = {
  /** Wstrzymuje ścieżkę. Bez dialogu — akcja jest odwracalna. */
  pause: (userPathId: string) => Promise<boolean>;
  /** Wznawia z tygodniem wejściowym. */
  resume: (userPathId: string) => Promise<boolean>;
  /** Cofa pauzę: ścieżka wraca dokładnie taka, jaka była, bez tygodnia ulgi. */
  undoPause: (userPathId: string) => void;
  /** Zamyka ścieżkę i rozstrzyga los praktyk. */
  end: (
    userPathId: string,
    reason: 'completed' | 'abandoned',
    decision: PracticesDecision,
  ) => Promise<boolean>;
  isPending: boolean;
  error: DataError | null;
};

/**
 * Cykl życia ścieżki poza stanem aktywnym.
 *
 * Trzy operacje, jedna zasada: żadna z nich nie pyta „czy na pewno".
 * Wstrzymanie i wznowienie są odwracalne, więc idą od razu i dostają toast
 * z „Cofnij". Zakończenie jest nieodwracalne, więc nie ma osobnego pytania
 * o zgodę — jest jedno pytanie o praktyki, i to ono jest decyzją.
 */
export function usePathLifecycle(): UsePathLifecycleResult {
  const today = useLogicalToday();

  const pauseMutation = useMutation({
    mutationFn: (userPathId: string) => pausePath(userPathId),
    onSuccess: invalidateLifecycle,
  });

  const resumeMutation = useMutation({
    mutationFn: ({
      userPathId,
      withReentry,
    }: {
      userPathId: string;
      withReentry: boolean;
    }) => resumePath(userPathId, today, withReentry),
    onSuccess: invalidateLifecycle,
  });

  const endMutation = useMutation({
    mutationFn: ({
      userPathId,
      reason,
      decision,
    }: {
      userPathId: string;
      reason: 'completed' | 'abandoned';
      decision: PracticesDecision;
    }) => endPath(userPathId, reason, decision),
    onSuccess: invalidateLifecycle,
  });

  const firstError = pauseMutation.error ?? resumeMutation.error ?? endMutation.error;

  return {
    pause: async (userPathId) => {
      try {
        await pauseMutation.mutateAsync(userPathId);
        return true;
      } catch {
        return false;
      }
    },
    resume: async (userPathId) => {
      try {
        await resumeMutation.mutateAsync({ userPathId, withReentry: true });
        return true;
      } catch {
        return false;
      }
    },
    undoPause: (userPathId) => {
      resumeMutation.mutate({ userPathId, withReentry: false });
    },
    end: async (userPathId, reason, decision) => {
      try {
        await endMutation.mutateAsync({ userPathId, reason, decision });
        return true;
      } catch {
        return false;
      }
    },
    isPending:
      pauseMutation.isPending || resumeMutation.isPending || endMutation.isPending,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
  };
}
