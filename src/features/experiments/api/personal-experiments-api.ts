import {
  personalExperimentRowSchema,
  type CreatePersonalExperimentDraftInput,
  type PersonalExperiment,
  type PersonalExperimentAction,
} from '@/features/experiments/model/personal-experiment';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

export async function fetchPersonalExperiment(
  habitId: string,
  today: IsoDate,
): Promise<PersonalExperiment | null> {
  const { data, error } = await supabase.rpc('get_personal_experiment', {
    p_habit_id: habitId,
    p_today: today,
  });

  if (error !== null) throw toDataError(error);
  return data === null ? null : personalExperimentRowSchema.parse(data);
}

export async function createPersonalExperimentDraft(input: {
  habitId: string;
  values: CreatePersonalExperimentDraftInput;
  today: IsoDate;
  requestId: string;
}): Promise<PersonalExperiment> {
  const timeValues =
    input.values.hypothesis === 'time_of_day'
      ? {
          p_a_time_of_day: input.values.aTimeOfDay,
          p_b_time_of_day: input.values.bTimeOfDay,
        }
      : {
          p_a_target: input.values.aTarget,
          p_b_target: input.values.bTarget,
        };

  const { data, error } = await supabase.rpc('create_personal_experiment_draft', {
    p_habit_id: input.habitId,
    p_hypothesis: input.values.hypothesis,
    p_reminder_opt_in: input.values.reminderOptIn,
    p_today: input.today,
    p_idempotency_key: input.requestId,
    ...timeValues,
  });

  if (error !== null) throw toDataError(error);
  return personalExperimentRowSchema.parse(data);
}

export type RunPersonalExperimentActionInput = {
  experimentId: string;
  action: PersonalExperimentAction;
  today: IsoDate;
  requestId: string;
};

export async function runPersonalExperimentAction(
  input: RunPersonalExperimentActionInput,
): Promise<PersonalExperiment> {
  const { data, error } = await supabase.rpc('run_personal_experiment_action', {
    p_experiment_id: input.experimentId,
    p_action: input.action,
    p_today: input.today,
    p_idempotency_key: input.requestId,
  });

  if (error !== null) throw toDataError(error);
  return personalExperimentRowSchema.parse(data);
}
