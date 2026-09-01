import { z } from 'zod';

import type { IsoDate } from '@/lib/date';

export const habitRevisionSourceSchema = z.enum([
  'user',
  'downshift',
  'path',
  'calibration',
  'reentry',
  'restore',
  'day_fit',
  'experiment',
]);
export type HabitRevisionSource = z.infer<typeof habitRevisionSourceSchema>;

export const habitRevisionReasonSchema = z.enum([
  'initial_snapshot',
  'created',
  'user_edit',
  'difficult_period',
  'path_materialized',
  'path_stage',
  'path_pause',
  'path_end',
  'time_calibration',
  'reentry',
  'reentry_complete',
  'retired',
  'restored',
  'archived',
  'rollback',
  'day_fit',
  'experiment_a',
  'experiment_b',
  'experiment_pause',
  'experiment_resume',
  'experiment_cancel',
  'experiment_choice',
]);
export type HabitRevisionReason = z.infer<typeof habitRevisionReasonSchema>;

const habitUnitSchema = z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']);
const scheduleTypeSchema = z.enum(['daily', 'weekdays', 'custom']);
const timeOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);

export const habitRevisionSnapshotSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  unit: habitUnitSchema,
  category: z
    .enum(['mindfulness', 'health', 'focus', 'learning', 'relationships'])
    .nullable(),
  start_value: z.number(),
  increment_value: z.number(),
  target_value: z.number().nullable(),
  progression_mode: z.enum(['completion', 'calendar']),
  schedule_type: scheduleTypeSchema,
  schedule_days: z.array(z.number().int().min(0).max(6)).nullable(),
  reminder_time: z.string().nullable(),
  time_of_day: timeOfDaySchema.nullable(),
  source_book: z.string().nullable(),
  source_author: z.string().nullable(),
  source_path_id: z.string().nullable(),
  source_stage_id: z.string().nullable(),
  retired: z.boolean(),
  archived: z.boolean(),
});
export type HabitRevisionSnapshot = z.infer<typeof habitRevisionSnapshotSchema>;

export type HabitRevision = {
  id: string;
  habitId: string;
  userId: string;
  revisionNumber: number;
  source: HabitRevisionSource;
  reason: HabitRevisionReason;
  effectiveOn: IsoDate;
  idempotencyKey: string;
  beforeSnapshot: HabitRevisionSnapshot | null;
  afterSnapshot: HabitRevisionSnapshot;
  restoresRevisionId: string | null;
  createdAt: string;
};

export const habitRevisionRowSchema = z
  .object({
    id: z.string().uuid(),
    habit_id: z.string().uuid(),
    user_id: z.string().uuid(),
    revision_number: z.number().int().positive(),
    source: habitRevisionSourceSchema,
    reason: habitRevisionReasonSchema,
    effective_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    idempotency_key: z.string().uuid(),
    before_snapshot: habitRevisionSnapshotSchema.nullable(),
    after_snapshot: habitRevisionSnapshotSchema,
    restores_revision_id: z.string().uuid().nullable(),
    created_at: z.string(),
  })
  .transform((row): HabitRevision => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    revisionNumber: row.revision_number,
    source: row.source,
    reason: row.reason,
    effectiveOn: row.effective_on,
    idempotencyKey: row.idempotency_key,
    beforeSnapshot: row.before_snapshot,
    afterSnapshot: row.after_snapshot,
    restoresRevisionId: row.restores_revision_id,
    createdAt: row.created_at,
  }));

export const habitRevisionRestorePreviewSchema = z
  .object({
    habit_id: z.string().uuid(),
    revision_id: z.string().uuid(),
    current_snapshot: habitRevisionSnapshotSchema,
    target_snapshot: habitRevisionSnapshotSchema,
    current_minutes: z.number().nonnegative(),
    restored_minutes: z.number().nonnegative(),
    used_other_minutes: z.number().nonnegative(),
    budget_minutes: z.number().int().nonnegative().nullable(),
    fits_budget: z.boolean(),
    fits_daily_ceiling: z.boolean(),
    path_conflict: z.boolean(),
    can_restore: z.boolean(),
  })
  .transform((row) => ({
    habitId: row.habit_id,
    revisionId: row.revision_id,
    currentSnapshot: row.current_snapshot,
    targetSnapshot: row.target_snapshot,
    currentMinutes: row.current_minutes,
    restoredMinutes: row.restored_minutes,
    usedOtherMinutes: row.used_other_minutes,
    budgetMinutes: row.budget_minutes,
    fitsBudget: row.fits_budget,
    fitsDailyCeiling: row.fits_daily_ceiling,
    pathConflict: row.path_conflict,
    canRestore: row.can_restore,
  }));

export type HabitRevisionRestorePreview = z.infer<
  typeof habitRevisionRestorePreviewSchema
>;

export type HabitRevisionChange =
  | {
      kind: 'amount' | 'increment' | 'target';
      before: { value: number | null; unit: HabitRevisionSnapshot['unit'] };
      after: { value: number | null; unit: HabitRevisionSnapshot['unit'] };
    }
  | { kind: 'title'; before: string; after: string }
  | {
      kind: 'schedule';
      before: Pick<HabitRevisionSnapshot, 'schedule_type' | 'schedule_days'>;
      after: Pick<HabitRevisionSnapshot, 'schedule_type' | 'schedule_days'>;
    }
  | {
      kind: 'time_of_day';
      before: HabitRevisionSnapshot['time_of_day'];
      after: HabitRevisionSnapshot['time_of_day'];
    }
  | { kind: 'reminder'; before: string | null; after: string | null }
  | {
      kind: 'status';
      before: 'active' | 'retired' | 'archived';
      after: 'active' | 'retired' | 'archived';
    }
  | { kind: 'details' }
  | { kind: 'created' };

function snapshotStatus(
  snapshot: HabitRevisionSnapshot,
): 'active' | 'retired' | 'archived' {
  if (snapshot.archived) return 'archived';
  return snapshot.retired ? 'retired' : 'active';
}

function sameDays(left: readonly number[] | null, right: readonly number[] | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Czytelne różnice domenowe; komponent nigdy nie renderuje surowego JSON. */
export function habitRevisionChanges(
  before: HabitRevisionSnapshot | null,
  after: HabitRevisionSnapshot,
): HabitRevisionChange[] {
  if (before === null) return [{ kind: 'created' }];

  const changes: HabitRevisionChange[] = [];

  if (before.title !== after.title) {
    changes.push({ kind: 'title', before: before.title, after: after.title });
  }
  if (before.start_value !== after.start_value || before.unit !== after.unit) {
    changes.push({
      kind: 'amount',
      before: { value: before.start_value, unit: before.unit },
      after: { value: after.start_value, unit: after.unit },
    });
  }
  if (before.increment_value !== after.increment_value || before.unit !== after.unit) {
    changes.push({
      kind: 'increment',
      before: { value: before.increment_value, unit: before.unit },
      after: { value: after.increment_value, unit: after.unit },
    });
  }
  if (before.target_value !== after.target_value || before.unit !== after.unit) {
    changes.push({
      kind: 'target',
      before: { value: before.target_value, unit: before.unit },
      after: { value: after.target_value, unit: after.unit },
    });
  }
  if (
    before.schedule_type !== after.schedule_type ||
    !sameDays(before.schedule_days, after.schedule_days)
  ) {
    changes.push({
      kind: 'schedule',
      before: {
        schedule_type: before.schedule_type,
        schedule_days: before.schedule_days,
      },
      after: {
        schedule_type: after.schedule_type,
        schedule_days: after.schedule_days,
      },
    });
  }
  if (before.time_of_day !== after.time_of_day) {
    changes.push({
      kind: 'time_of_day',
      before: before.time_of_day,
      after: after.time_of_day,
    });
  }
  if (before.reminder_time !== after.reminder_time) {
    changes.push({
      kind: 'reminder',
      before: before.reminder_time,
      after: after.reminder_time,
    });
  }

  const beforeStatus = snapshotStatus(before);
  const afterStatus = snapshotStatus(after);
  if (beforeStatus !== afterStatus) {
    changes.push({ kind: 'status', before: beforeStatus, after: afterStatus });
  }

  if (
    before.description !== after.description ||
    before.icon !== after.icon ||
    before.category !== after.category ||
    before.progression_mode !== after.progression_mode ||
    before.source_book !== after.source_book ||
    before.source_author !== after.source_author ||
    before.source_path_id !== after.source_path_id ||
    before.source_stage_id !== after.source_stage_id
  ) {
    changes.push({ kind: 'details' });
  }

  return changes;
}

/** UUID v4 do retry offline; nie zawiera danych użytkownika. */
export function createHabitRevisionRequestId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(random() * 16);
    const nibble = token === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
