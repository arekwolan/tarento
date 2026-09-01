import { useState } from 'react';
import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import {
  fetchHabitRevisions,
  previewHabitRevisionRestore,
  restoreHabitRevision,
  type RestoreHabitRevisionInput,
} from '@/features/habits/api/habit-revisions-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { Habit } from '@/features/habits/model/habit';
import {
  createHabitRevisionRequestId,
  type HabitRevision,
  type HabitRevisionRestorePreview,
  type HabitRevisionSnapshot,
} from '@/features/habits/model/revision';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient, STALE_TIME } from '@/lib/query-client';

const EMPTY_REVISIONS: HabitRevision[] = [];

export type RestoreHabitRevisionVariables = RestoreHabitRevisionInput & {
  userId: string;
  optimisticHabit: Habit;
};

type RestoreContext = {
  previousDetail: Habit | null | undefined;
  previousActive: Habit[] | undefined;
};

function applySnapshot(habit: Habit, snapshot: HabitRevisionSnapshot): Habit {
  return {
    ...habit,
    title: snapshot.title,
    description: snapshot.description,
    icon: snapshot.icon,
    color: snapshot.color,
    unit: snapshot.unit,
    category: snapshot.category,
    startValue: snapshot.start_value,
    incrementValue: snapshot.increment_value,
    targetValue: snapshot.target_value,
    progressionMode: snapshot.progression_mode,
    scheduleType: snapshot.schedule_type,
    scheduleDays: snapshot.schedule_type === 'custom' ? snapshot.schedule_days : null,
    reminderTime: snapshot.reminder_time,
    timeOfDay: snapshot.time_of_day,
    sourceBook: snapshot.source_book,
    sourceAuthor: snapshot.source_author,
  };
}

const writeRestore: MutationFunction<Habit, RestoreHabitRevisionVariables> = (
  variables,
) => restoreHabitRevision(variables);

const restoreMutationDefaults = {
  mutationFn: writeRestore,

  async onMutate(variables: RestoreHabitRevisionVariables): Promise<RestoreContext> {
    const detailKey = habitKeys.detail(variables.userId, variables.habitId);
    const activeKey = habitKeys.active(variables.userId);

    await queryClient.cancelQueries({ queryKey: detailKey });
    await queryClient.cancelQueries({ queryKey: activeKey });

    const previousDetail = queryClient.getQueryData<Habit | null>(detailKey);
    const previousActive = queryClient.getQueryData<Habit[]>(activeKey);

    queryClient.setQueryData(detailKey, variables.optimisticHabit);
    queryClient.setQueryData<Habit[]>(activeKey, (current = []) =>
      current.map((habit) =>
        habit.id === variables.habitId ? variables.optimisticHabit : habit,
      ),
    );

    return { previousDetail, previousActive };
  },

  onError(
    _error: unknown,
    variables: RestoreHabitRevisionVariables,
    context: RestoreContext | undefined,
  ) {
    if (context === undefined) return;
    queryClient.setQueryData(
      habitKeys.detail(variables.userId, variables.habitId),
      context.previousDetail,
    );
    queryClient.setQueryData(habitKeys.active(variables.userId), context.previousActive);
  },

  onSettled() {
    void queryClient.invalidateQueries({ queryKey: habitKeys.all });
  },
};

export function registerHabitRevisionMutationDefaults(): void {
  queryClient.setMutationDefaults(habitKeys.restoreRevision(), restoreMutationDefaults);
}

export type UseHabitRevisionsResult = {
  revisions: HabitRevision[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
  selectedRevision: HabitRevision | null;
  preview: HabitRevisionRestorePreview | null;
  isPreviewLoading: boolean;
  previewError: DataError | null;
  openPreview: (revision: HabitRevision) => void;
  closePreview: () => void;
  restore: () => void;
  isRestoring: boolean;
  isQueued: boolean;
  restoreError: DataError | null;
};

export function useHabitRevisions(habit: Habit | null): UseHabitRevisionsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const habitId = habit?.id ?? null;
  const [selectedRevision, setSelectedRevision] = useState<HabitRevision | null>(null);

  const revisionsQuery = useQuery({
    queryKey: habitKeys.revisions(userId ?? 'anonymous', habitId ?? 'none'),
    queryFn: () => fetchHabitRevisions(habitId ?? ''),
    enabled: userId !== null && habitId !== null,
    staleTime: STALE_TIME.habits,
  });

  const previewQuery = useQuery({
    queryKey: habitKeys.revisionPreview(
      userId ?? 'anonymous',
      habitId ?? 'none',
      selectedRevision?.id ?? 'none',
    ),
    queryFn: () =>
      previewHabitRevisionRestore({
        habitId: habitId ?? '',
        revisionId: selectedRevision?.id ?? '',
        effectiveOn: today,
      }),
    enabled: userId !== null && habitId !== null && selectedRevision !== null,
    staleTime: 0,
  });

  const restoreMutation = useMutation<
    Habit,
    Error,
    RestoreHabitRevisionVariables,
    RestoreContext
  >({
    mutationKey: habitKeys.restoreRevision(),
    onSuccess: () => {
      setSelectedRevision(null);
    },
  });

  const revisions = revisionsQuery.data ?? EMPTY_REVISIONS;
  const preview = previewQuery.data ?? null;

  return {
    revisions,
    isLoading: revisionsQuery.isPending && habit !== null,
    error: revisionsQuery.error === null ? null : toDataError(revisionsQuery.error),
    refetch: () => {
      void revisionsQuery.refetch();
    },
    selectedRevision,
    preview,
    isPreviewLoading: previewQuery.isPending && selectedRevision !== null,
    previewError: previewQuery.error === null ? null : toDataError(previewQuery.error),
    openPreview: (revision) => {
      setSelectedRevision(revision);
    },
    closePreview: () => {
      setSelectedRevision(null);
    },
    restore: () => {
      const latest = revisions[0];
      if (
        habit === null ||
        userId === null ||
        selectedRevision === null ||
        preview === null ||
        latest === undefined ||
        !preview.canRestore
      ) {
        return;
      }

      restoreMutation.mutate({
        userId,
        habitId: habit.id,
        revisionId: selectedRevision.id,
        expectedRevisionId: latest.id,
        acceptPathConflict: preview.pathConflict,
        effectiveOn: today,
        requestId: createHabitRevisionRequestId(),
        optimisticHabit: applySnapshot(habit, preview.targetSnapshot),
      });
    },
    isRestoring: restoreMutation.isPending,
    isQueued: restoreMutation.isPaused,
    restoreError:
      restoreMutation.error === null ? null : toDataError(restoreMutation.error),
  };
}
