import { useMutation } from '@tanstack/react-query';

import { trackEvent } from '@/features/analytics';
import { useAuth, useLogicalToday } from '@/features/auth';
import {
  archiveHabit,
  createHabit,
  unarchiveHabit,
  updateHabit,
} from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import type { Habit } from '@/features/habits/model/habit';
import {
  toHabitWriteInput,
  type HabitFormValues,
} from '@/features/habits/model/habit-form';
import { createHabitRevisionRequestId } from '@/features/habits/model/revision';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient } from '@/lib/query-client';

/** Nawyk zmienia listy, cele i serie naraz — czyścimy cały feature. */
function invalidateHabits(): void {
  void queryClient.invalidateQueries({ queryKey: habitKeys.all });
}

export type UseSaveHabitResult = {
  /** Zapisuje nowy nawyk. Zwraca zapisany rekord albo null przy błędzie. */
  create: (
    values: HabitFormValues,
    options?: { fromTemplate?: boolean },
  ) => Promise<Habit | null>;
  /** Zapisuje zmiany. Nie dotyka istniejących wpisów w habit_logs. */
  update: (
    habit: Habit,
    values: HabitFormValues,
    provenance?: HabitEditProvenance,
  ) => Promise<Habit | null>;
  isPending: boolean;
  error: DataError | null;
};

export type HabitEditProvenance =
  | { source: 'user'; reason: 'user_edit' }
  | { source: 'calibration'; reason: 'time_calibration' }
  | { source: 'day_fit'; reason: 'day_fit' };

const DEFAULT_EDIT_PROVENANCE: HabitEditProvenance = {
  source: 'user',
  reason: 'user_edit',
};

export function useSaveHabit(): UseSaveHabitResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const createMutation = useMutation({
    mutationFn: (values: HabitFormValues) =>
      createHabit(userId ?? '', toHabitWriteInput(values)),
    onSuccess: invalidateHabits,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      habit,
      values,
      requestId,
      provenance,
    }: {
      habit: Habit;
      values: HabitFormValues;
      requestId: string;
      provenance: HabitEditProvenance;
    }) =>
      updateHabit(habit.id, toHabitWriteInput(values), {
        source: provenance.source,
        reason: provenance.reason,
        effectiveOn: today,
        requestId,
        expectedUpdatedAt: habit.updatedAt,
      }),
    onSuccess: invalidateHabits,
  });

  const firstError = createMutation.error ?? updateMutation.error;

  return {
    create: async (values, options) => {
      if (userId === null) return null;
      try {
        const habit = await createMutation.mutateAsync(values);

        // Same metadane ustawień — bez tytułu i opisu, które bywają osobiste.
        trackEvent('habit_created', {
          unit: habit.unit,
          schedule_type: habit.scheduleType,
          progression_mode: habit.progressionMode,
          category: habit.category,
          has_reminder: habit.reminderTime !== null,
          from_template: options?.fromTemplate ?? false,
        });

        return habit;
      } catch {
        return null;
      }
    },
    update: async (habit, values, provenance = DEFAULT_EDIT_PROVENANCE) => {
      try {
        return await updateMutation.mutateAsync({
          habit,
          values,
          requestId: createHabitRevisionRequestId(),
          provenance,
        });
      } catch {
        return null;
      }
    },
    isPending: createMutation.isPending || updateMutation.isPending,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
  };
}

export type UseArchiveHabitResult = {
  archive: (habit: Habit) => Promise<Habit | null>;
  /** Cofa archiwizację — pod akcję „Cofnij" w toaście. */
  unarchive: (habit: Habit) => Promise<Habit | null>;
  isPending: boolean;
  error: DataError | null;
};

/** Archiwizacja zamiast usunięcia — historia i serie zostają w bazie. */
export function useArchiveHabit(): UseArchiveHabitResult {
  const today = useLogicalToday();

  const archiveMutation = useMutation({
    mutationFn: ({ habit, requestId }: { habit: Habit; requestId: string }) =>
      archiveHabit(habit.id, {
        effectiveOn: today,
        requestId,
        expectedUpdatedAt: habit.updatedAt,
      }),
    onSuccess: invalidateHabits,
  });

  const unarchiveMutation = useMutation({
    mutationFn: ({ habit, requestId }: { habit: Habit; requestId: string }) =>
      unarchiveHabit(habit.id, {
        effectiveOn: today,
        requestId,
        expectedUpdatedAt: habit.updatedAt,
      }),
    onSuccess: invalidateHabits,
  });

  const run = async (
    mutation: {
      mutateAsync: (input: { habit: Habit; requestId: string }) => Promise<Habit>;
    },
    habit: Habit,
  ) => {
    try {
      return await mutation.mutateAsync({
        habit,
        requestId: createHabitRevisionRequestId(),
      });
    } catch {
      return null;
    }
  };

  const firstError = archiveMutation.error ?? unarchiveMutation.error;

  return {
    archive: (habit) => run(archiveMutation, habit),
    unarchive: (habit) => run(unarchiveMutation, habit),
    isPending: archiveMutation.isPending || unarchiveMutation.isPending,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
  };
}
