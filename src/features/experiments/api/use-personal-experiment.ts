import { useEffect } from 'react';
import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import {
  createPersonalExperimentDraft,
  fetchPersonalExperiment,
  runPersonalExperimentAction,
  type RunPersonalExperimentActionInput,
} from '@/features/experiments/api/personal-experiments-api';
import { personalExperimentKeys } from '@/features/experiments/api/keys';
import {
  habitAfterPersonalExperimentAction,
  optimisticPersonalExperimentAction,
  type CreatePersonalExperimentDraftInput,
  type PersonalExperiment,
  type PersonalExperimentAction,
} from '@/features/experiments/model/personal-experiment';
import { useAuth, useLogicalToday } from '@/features/auth';
import { createHabitRevisionRequestId, habitKeys, type Habit } from '@/features/habits';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type PersonalExperimentActionVariables = RunPersonalExperimentActionInput & {
  userId: string;
  habitId: string;
  experiment: PersonalExperiment;
  optimisticExperiment: PersonalExperiment;
  optimisticHabit: Habit;
};

type PersonalExperimentActionContext = {
  previousExperiment: PersonalExperiment | null | undefined;
  previousHabit: Habit | null | undefined;
  previousActiveHabits: Habit[] | undefined;
};

const writeAction: MutationFunction<
  PersonalExperiment,
  PersonalExperimentActionVariables
> = (variables) => runPersonalExperimentAction(variables);

const actionMutationDefaults = {
  mutationFn: writeAction,

  async onMutate(
    variables: PersonalExperimentActionVariables,
  ): Promise<PersonalExperimentActionContext> {
    const experimentKey = personalExperimentKeys.detail(
      variables.userId,
      variables.habitId,
    );
    const habitKey = habitKeys.detail(variables.userId, variables.habitId);
    const activeKey = habitKeys.active(variables.userId);

    await queryClient.cancelQueries({ queryKey: experimentKey });
    await queryClient.cancelQueries({ queryKey: habitKey });
    await queryClient.cancelQueries({ queryKey: activeKey });

    const previousExperiment = queryClient.getQueryData<PersonalExperiment | null>(
      experimentKey,
    );
    const previousHabit = queryClient.getQueryData<Habit | null>(habitKey);
    const previousActiveHabits = queryClient.getQueryData<Habit[]>(activeKey);

    queryClient.setQueryData(experimentKey, variables.optimisticExperiment);
    queryClient.setQueryData(habitKey, variables.optimisticHabit);
    queryClient.setQueryData<Habit[]>(activeKey, (current = []) =>
      current.map((habit) =>
        habit.id === variables.habitId ? variables.optimisticHabit : habit,
      ),
    );

    return { previousExperiment, previousHabit, previousActiveHabits };
  },

  onSuccess(result: PersonalExperiment, variables: PersonalExperimentActionVariables) {
    queryClient.setQueryData(
      personalExperimentKeys.detail(variables.userId, variables.habitId),
      result,
    );
  },

  onError(
    _error: unknown,
    variables: PersonalExperimentActionVariables,
    context: PersonalExperimentActionContext | undefined,
  ) {
    if (context === undefined) return;

    queryClient.setQueryData(
      personalExperimentKeys.detail(variables.userId, variables.habitId),
      context.previousExperiment,
    );
    queryClient.setQueryData(
      habitKeys.detail(variables.userId, variables.habitId),
      context.previousHabit,
    );
    queryClient.setQueryData(
      habitKeys.active(variables.userId),
      context.previousActiveHabits,
    );
  },

  onSettled() {
    void queryClient.invalidateQueries({ queryKey: personalExperimentKeys.all });
    void queryClient.invalidateQueries({ queryKey: habitKeys.all });
  },
};

export function registerPersonalExperimentMutationDefaults(): void {
  queryClient.setMutationDefaults(
    personalExperimentKeys.action(),
    actionMutationDefaults,
  );
}

export type UsePersonalExperimentResult = {
  experiment: PersonalExperiment | null;
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
  createDraft: (
    values: CreatePersonalExperimentDraftInput,
  ) => Promise<PersonalExperiment | null>;
  runAction: (action: PersonalExperimentAction) => Promise<boolean>;
  isCreating: boolean;
  isActing: boolean;
  isQueued: boolean;
  mutationError: DataError | null;
};

export function usePersonalExperiment(habit: Habit | null): UsePersonalExperimentResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const habitId = habit?.id ?? null;

  const query = useQuery({
    queryKey: personalExperimentKeys.detail(userId ?? 'anonymous', habitId ?? 'none'),
    queryFn: () => fetchPersonalExperiment(habitId ?? '', today),
    enabled: userId !== null && habitId !== null,
    staleTime: STALE_TIME.today,
  });

  const createMutation = useMutation({
    mutationFn: (variables: {
      habitId: string;
      values: CreatePersonalExperimentDraftInput;
      today: IsoDate;
      requestId: string;
    }) => createPersonalExperimentDraft(variables),
    onSuccess: (result) => {
      if (userId === null || habitId === null) return;
      queryClient.setQueryData(personalExperimentKeys.detail(userId, habitId), result);
    },
  });

  const actionMutation = useMutation<
    PersonalExperiment,
    Error,
    PersonalExperimentActionVariables,
    PersonalExperimentActionContext
  >({ mutationKey: personalExperimentKeys.action() });

  const experiment = query.data ?? null;
  const firstMutationError = createMutation.error ?? actionMutation.error;
  const hasLoadedExperiment = query.data !== undefined;
  const experimentUpdatedAt = query.data?.updatedAt;

  useEffect(() => {
    if (userId === null || habitId === null || !hasLoadedExperiment) return;
    void queryClient.invalidateQueries({ queryKey: habitKeys.detail(userId, habitId) });
    void queryClient.invalidateQueries({ queryKey: habitKeys.active(userId) });
  }, [userId, habitId, hasLoadedExperiment, experimentUpdatedAt]);

  return {
    experiment,
    isLoading: query.isPending && habit !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
    createDraft: async (values) => {
      if (habitId === null) return null;
      try {
        return await createMutation.mutateAsync({
          habitId,
          values,
          today,
          requestId: createHabitRevisionRequestId(),
        });
      } catch {
        return null;
      }
    },
    runAction: async (action) => {
      if (userId === null || habit === null || experiment === null) return false;

      try {
        await actionMutation.mutateAsync({
          userId,
          habitId: habit.id,
          experimentId: experiment.id,
          experiment,
          action,
          today,
          requestId: createHabitRevisionRequestId(),
          optimisticExperiment: optimisticPersonalExperimentAction(
            experiment,
            action,
            today,
          ),
          optimisticHabit: habitAfterPersonalExperimentAction(habit, experiment, action),
        });
        return true;
      } catch {
        return false;
      }
    },
    isCreating: createMutation.isPending,
    isActing: actionMutation.isPending,
    isQueued: actionMutation.isPaused,
    mutationError:
      firstMutationError === null || firstMutationError === undefined
        ? null
        : toDataError(firstMutationError),
  };
}
