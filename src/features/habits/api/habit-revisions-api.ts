import {
  habitRevisionRestorePreviewSchema,
  habitRevisionRowSchema,
  type HabitRevision,
  type HabitRevisionRestorePreview,
} from '@/features/habits/model/revision';
import { habitRowSchema, type Habit } from '@/features/habits/model/habit';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const REVISION_COLUMNS =
  'id, habit_id, user_id, revision_number, source, reason, effective_on, ' +
  'idempotency_key, before_snapshot, after_snapshot, restores_revision_id, created_at';

export async function fetchHabitRevisions(habitId: string): Promise<HabitRevision[]> {
  const { data, error } = await supabase
    .from('habit_revisions')
    .select(REVISION_COLUMNS)
    .eq('habit_id', habitId)
    .order('revision_number', { ascending: false });

  if (error !== null) throw toDataError(error);
  return habitRevisionRowSchema.array().parse(data);
}

export async function previewHabitRevisionRestore(input: {
  habitId: string;
  revisionId: string;
  effectiveOn: IsoDate;
}): Promise<HabitRevisionRestorePreview> {
  const { data, error } = await supabase.rpc('preview_habit_revision_restore', {
    p_habit_id: input.habitId,
    p_revision_id: input.revisionId,
    p_effective_on: input.effectiveOn,
  });

  if (error !== null) throw toDataError(error);
  return habitRevisionRestorePreviewSchema.parse(data);
}

export type RestoreHabitRevisionInput = {
  habitId: string;
  revisionId: string;
  expectedRevisionId: string;
  acceptPathConflict: boolean;
  effectiveOn: IsoDate;
  requestId: string;
};

export async function restoreHabitRevision(
  input: RestoreHabitRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('restore_habit_revision', {
    p_habit_id: input.habitId,
    p_revision_id: input.revisionId,
    p_expected_revision_id: input.expectedRevisionId,
    p_accept_path_conflict: input.acceptPathConflict,
    p_effective_on: input.effectiveOn,
    p_idempotency_key: input.requestId,
  });

  if (error !== null) throw toDataError(error);
  return habitRowSchema.parse(data);
}
