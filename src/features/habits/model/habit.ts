import { z } from 'zod';

import type { HabitProgression, IsoDate } from '@/lib/date';

export type HabitUnit = 'minutes' | 'seconds' | 'reps' | 'pages' | 'count' | 'none';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';
export type HabitLogStatus = 'done' | 'partial' | 'skipped';
export type HabitCategory =
  'mindfulness' | 'health' | 'focus' | 'learning' | 'relationships';

/**
 * Nawyk w postaci używanej przez aplikację (camelCase).
 *
 * Rozszerza HabitProgression z @/lib/date, więc można go podać wprost do
 * isScheduledOn() i computeTargetForDate() bez przepakowywania.
 */
export type Habit = HabitProgression & {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  unit: HabitUnit;
  category: HabitCategory | null;
  reminderTime: string | null;
  timeOfDay: TimeOfDay | null;
  sourceBook: string | null;
  sourceAuthor: string | null;
  sortOrder: number;
  /** Ścieżka, która wygenerowała ten nawyk. `null` dla dodanych ręcznie. */
  sourcePathId: string | null;
  sourceStageId: string | null;
  /** Ścieżka zdjęła nawyk z listy. Co innego niż `archivedAt`. */
  retiredAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HabitLog = {
  id: string;
  habitId: string;
  userId: string;
  logDate: IsoDate;
  status: HabitLogStatus;
  /** Snapshot celu z dnia wpisu — nie przelicza się wstecz. */
  targetValue: number;
  valueCompleted: number | null;
  note: string | null;
  completedAt: string;
};

export type HabitStreak = {
  currentStreak: number;
  longestStreak: number;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

const habitUnit = z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']);
const progressionMode = z.enum(['completion', 'calendar']);
const scheduleType = z.enum(['daily', 'weekdays', 'custom']);
const timeOfDay = z.enum(['morning', 'afternoon', 'evening']);
const logStatus = z.enum(['done', 'partial', 'skipped']);
const habitCategory = z.enum([
  'mindfulness',
  'health',
  'focus',
  'learning',
  'relationships',
]);

/**
 * Wiersz z Postgresa → Habit.
 *
 * Walidujemy zodem, bo to dane z zewnątrz (CLAUDE.md, sekcja TypeScript).
 * Kolumny tekstowe mają w bazie CHECK-i, ale generator typów widzi w nich
 * zwykły `string` — bez tego zawężenia trzeba by rzutować.
 */
export const habitRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    unit: habitUnit,
    category: habitCategory.nullable(),
    start_value: z.number(),
    increment_value: z.number(),
    target_value: z.number().nullable(),
    progression_mode: progressionMode,
    schedule_type: scheduleType,
    schedule_days: z.array(z.number().int()).nullable(),
    reminder_time: z.string().nullable(),
    time_of_day: timeOfDay.nullable(),
    source_book: z.string().nullable(),
    source_author: z.string().nullable(),
    sort_order: z.number(),
    source_path_id: z.string().nullable(),
    source_stage_id: z.string().nullable(),
    started_on: isoDate,
    retired_at: z.string().nullable(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): Habit => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    color: row.color,
    unit: row.unit,
    category: row.category,
    startValue: row.start_value,
    incrementValue: row.increment_value,
    targetValue: row.target_value,
    progressionMode: row.progression_mode,
    scheduleType: row.schedule_type,
    scheduleDays: row.schedule_days,
    reminderTime: row.reminder_time,
    timeOfDay: row.time_of_day,
    sourceBook: row.source_book,
    sourceAuthor: row.source_author,
    sortOrder: row.sort_order,
    sourcePathId: row.source_path_id,
    sourceStageId: row.source_stage_id,
    startedOn: row.started_on,
    retiredAt: row.retired_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export const habitLogRowSchema = z
  .object({
    id: z.string(),
    habit_id: z.string(),
    user_id: z.string(),
    log_date: isoDate,
    status: logStatus,
    target_value: z.number(),
    value_completed: z.number().nullable(),
    note: z.string().nullable(),
    completed_at: z.string(),
  })
  .transform((row): HabitLog => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    logDate: row.log_date,
    status: row.status,
    targetValue: row.target_value,
    valueCompleted: row.value_completed,
    note: row.note,
    completedAt: row.completed_at,
  }));
