import { z } from 'zod';

import type { Habit, TimeOfDay } from '@/features/habits/model/habit';
import { habitRevisionSnapshotSchema } from '@/features/habits/model/revision';
import type { IsoDate } from '@/lib/date';

export const personalExperimentHypothesisSchema = z.enum(['time_of_day', 'target_size']);
export type PersonalExperimentHypothesis = z.infer<
  typeof personalExperimentHypothesisSchema
>;

export const personalExperimentStateSchema = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
]);
export type PersonalExperimentState = z.infer<typeof personalExperimentStateSchema>;

export const personalExperimentBlockSchema = z.enum(['a', 'b']);
export type PersonalExperimentBlock = z.infer<typeof personalExperimentBlockSchema>;

export const personalExperimentDecisionSchema = z.enum(['a', 'b', 'original']);
export type PersonalExperimentDecision = z.infer<typeof personalExperimentDecisionSchema>;

export const personalExperimentActionSchema = z.enum([
  'start',
  'pause',
  'resume',
  'cancel',
  'choose_a',
  'choose_b',
  'choose_original',
]);
export type PersonalExperimentAction = z.infer<typeof personalExperimentActionSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);

export const personalExperimentVariantSchema = z
  .object({
    start_value: z.number().positive().optional(),
    time_of_day: timeOfDaySchema.nullable().optional(),
    reminder_time: z.string().nullable().optional(),
  })
  .strict();
export type PersonalExperimentVariant = z.infer<typeof personalExperimentVariantSchema>;

export type PersonalExperiment = {
  id: string;
  userId: string;
  habitId: string;
  hypothesis: PersonalExperimentHypothesis;
  state: PersonalExperimentState;
  currentBlock: PersonalExperimentBlock | null;
  opportunityTarget: number;
  originalSnapshot: z.infer<typeof habitRevisionSnapshotSchema>;
  variantA: PersonalExperimentVariant;
  variantB: PersonalExperimentVariant;
  reminderOptIn: boolean;
  plannedAStart: IsoDate;
  plannedAEnd: IsoDate;
  plannedBStart: IsoDate;
  plannedBEnd: IsoDate;
  blockStartedOn: IsoDate | null;
  aExpected: number;
  aCompleted: number;
  bExpected: number;
  bCompleted: number;
  pausedOn: IsoDate | null;
  startedOn: IsoDate | null;
  completedOn: IsoDate | null;
  cancelledOn: IsoDate | null;
  decision: PersonalExperimentDecision | null;
  decidedOn: IsoDate | null;
  createdAt: string;
  updatedAt: string;
};

export const personalExperimentRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    habit_id: z.string().uuid(),
    hypothesis: personalExperimentHypothesisSchema,
    state: personalExperimentStateSchema,
    current_block: personalExperimentBlockSchema.nullable(),
    opportunity_target: z.number().int().positive(),
    original_snapshot: habitRevisionSnapshotSchema,
    variant_a: personalExperimentVariantSchema,
    variant_b: personalExperimentVariantSchema,
    reminder_opt_in: z.boolean(),
    planned_a_start: isoDateSchema,
    planned_a_end: isoDateSchema,
    planned_b_start: isoDateSchema,
    planned_b_end: isoDateSchema,
    block_started_on: isoDateSchema.nullable(),
    a_expected: z.number().int().nonnegative(),
    a_completed: z.number().int().nonnegative(),
    b_expected: z.number().int().nonnegative(),
    b_completed: z.number().int().nonnegative(),
    paused_on: isoDateSchema.nullable(),
    started_on: isoDateSchema.nullable(),
    completed_on: isoDateSchema.nullable(),
    cancelled_on: isoDateSchema.nullable(),
    decision: personalExperimentDecisionSchema.nullable(),
    decided_on: isoDateSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): PersonalExperiment => ({
    id: row.id,
    userId: row.user_id,
    habitId: row.habit_id,
    hypothesis: row.hypothesis,
    state: row.state,
    currentBlock: row.current_block,
    opportunityTarget: row.opportunity_target,
    originalSnapshot: row.original_snapshot,
    variantA: row.variant_a,
    variantB: row.variant_b,
    reminderOptIn: row.reminder_opt_in,
    plannedAStart: row.planned_a_start,
    plannedAEnd: row.planned_a_end,
    plannedBStart: row.planned_b_start,
    plannedBEnd: row.planned_b_end,
    blockStartedOn: row.block_started_on,
    aExpected: row.a_expected,
    aCompleted: row.a_completed,
    bExpected: row.b_expected,
    bCompleted: row.b_completed,
    pausedOn: row.paused_on,
    startedOn: row.started_on,
    completedOn: row.completed_on,
    cancelledOn: row.cancelled_on,
    decision: row.decision,
    decidedOn: row.decided_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

const positiveTargetText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0);

export const personalExperimentTimeFormSchema = z
  .object({
    hypothesis: z.literal('time_of_day'),
    aTimeOfDay: timeOfDaySchema,
    bTimeOfDay: timeOfDaySchema,
    reminderOptIn: z.boolean(),
  })
  .refine((values) => values.aTimeOfDay !== values.bTimeOfDay, {
    path: ['bTimeOfDay'],
  });

export const personalExperimentTargetFormSchema = z
  .object({
    hypothesis: z.literal('target_size'),
    aTarget: positiveTargetText,
    bTarget: positiveTargetText,
  })
  .refine((values) => Number(values.aTarget) !== Number(values.bTarget), {
    path: ['bTarget'],
  });

export const personalExperimentFormSchema = z.discriminatedUnion('hypothesis', [
  personalExperimentTimeFormSchema,
  personalExperimentTargetFormSchema,
]);

export type PersonalExperimentFormValues = z.input<typeof personalExperimentFormSchema>;

export type CreatePersonalExperimentDraftInput =
  | {
      hypothesis: 'time_of_day';
      aTimeOfDay: TimeOfDay;
      bTimeOfDay: TimeOfDay;
      reminderOptIn: boolean;
    }
  | {
      hypothesis: 'target_size';
      aTarget: number;
      bTarget: number;
      reminderOptIn: false;
    };

export function toPersonalExperimentDraftInput(
  values: PersonalExperimentFormValues,
): CreatePersonalExperimentDraftInput {
  if (values.hypothesis === 'time_of_day') {
    return {
      hypothesis: values.hypothesis,
      aTimeOfDay: values.aTimeOfDay,
      bTimeOfDay: values.bTimeOfDay,
      reminderOptIn: values.reminderOptIn,
    };
  }

  return {
    hypothesis: values.hypothesis,
    aTarget: Number(values.aTarget),
    bTarget: Number(values.bTarget),
    reminderOptIn: false,
  };
}

export type PersonalExperimentLead = 'a' | 'b' | 'tie' | 'too_early';

export type PersonalExperimentComparison = {
  lead: PersonalExperimentLead;
  aRate: number | null;
  bRate: number | null;
  differencePercentagePoints: number;
  /** Nawet 7 + 7 to mała próba; ta flaga nigdy nie obiecuje pewności. */
  isSmallSample: boolean;
};

export function comparePersonalExperiment(
  experiment: Pick<
    PersonalExperiment,
    'aCompleted' | 'aExpected' | 'bCompleted' | 'bExpected'
  >,
): PersonalExperimentComparison {
  const aRate =
    experiment.aExpected === 0 ? null : experiment.aCompleted / experiment.aExpected;
  const bRate =
    experiment.bExpected === 0 ? null : experiment.bCompleted / experiment.bExpected;

  if (aRate === null || bRate === null) {
    return {
      lead: 'too_early',
      aRate,
      bRate,
      differencePercentagePoints: 0,
      isSmallSample: true,
    };
  }

  const difference = Math.round(Math.abs(bRate - aRate) * 100);
  return {
    lead: aRate === bRate ? 'tie' : bRate > aRate ? 'b' : 'a',
    aRate,
    bRate,
    differencePercentagePoints: difference,
    isSmallSample: experiment.aExpected + experiment.bExpected < 30,
  };
}

function patchHabit(habit: Habit, patch: PersonalExperimentVariant): Habit {
  return {
    ...habit,
    startValue: patch.start_value ?? habit.startValue,
    timeOfDay: patch.time_of_day === undefined ? habit.timeOfDay : patch.time_of_day,
    reminderTime:
      patch.reminder_time === undefined ? habit.reminderTime : patch.reminder_time,
  };
}

export function personalExperimentOriginalVariant(
  experiment: PersonalExperiment,
): PersonalExperimentVariant {
  if (experiment.hypothesis === 'target_size') {
    return { start_value: experiment.originalSnapshot.start_value };
  }

  return {
    time_of_day: experiment.originalSnapshot.time_of_day,
    ...(experiment.reminderOptIn
      ? { reminder_time: experiment.originalSnapshot.reminder_time }
      : {}),
  };
}

export function habitAfterPersonalExperimentAction(
  habit: Habit,
  experiment: PersonalExperiment,
  action: PersonalExperimentAction,
): Habit {
  switch (action) {
    case 'start':
    case 'choose_a':
      return patchHabit(habit, experiment.variantA);
    case 'resume':
      return patchHabit(
        habit,
        experiment.currentBlock === 'b' ? experiment.variantB : experiment.variantA,
      );
    case 'choose_b':
      return patchHabit(habit, experiment.variantB);
    case 'pause':
    case 'cancel':
    case 'choose_original':
      return patchHabit(habit, personalExperimentOriginalVariant(experiment));
  }
}

export function optimisticPersonalExperimentAction(
  experiment: PersonalExperiment,
  action: PersonalExperimentAction,
  today: IsoDate,
): PersonalExperiment {
  switch (action) {
    case 'start':
      return {
        ...experiment,
        state: 'active',
        currentBlock: 'a',
        blockStartedOn: today,
        startedOn: today,
      };
    case 'pause':
      return { ...experiment, state: 'paused', pausedOn: today };
    case 'resume':
      return {
        ...experiment,
        state: 'active',
        pausedOn: null,
        blockStartedOn: today,
      };
    case 'cancel':
      return {
        ...experiment,
        state: 'cancelled',
        pausedOn: null,
        cancelledOn: today,
      };
    case 'choose_a':
    case 'choose_b':
    case 'choose_original':
      return {
        ...experiment,
        decision: action === 'choose_a' ? 'a' : action === 'choose_b' ? 'b' : 'original',
        decidedOn: today,
      };
  }
}
