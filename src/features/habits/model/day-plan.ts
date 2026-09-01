import { z } from 'zod';

import {
  habitRowSchema,
  type Habit,
  type HabitLogStatus,
} from '@/features/habits/model/habit';
import { estimateMinutes, type TodayTask } from '@/features/habits/model/today-task';
import type { IsoDate } from '@/lib/date';

export const dayPlanStateSchema = z.enum(['planned', 'overflow']);
export type DayPlanState = z.infer<typeof dayPlanStateSchema>;

export const dayPlanReasonSchema = z.enum([
  'within_limit',
  'daily_ceiling',
  'minute_budget',
  'rest',
  'quiet_week',
  'retired',
  'archived',
  'schedule_changed',
  'legacy_fallback',
]);
export type DayPlanReason = z.infer<typeof dayPlanReasonSchema>;

export type DayPlanAssignment = {
  habitId: string;
  state: DayPlanState;
  reason: DayPlanReason;
  sortOrder: number;
  target: number;
  estimatedMinutes: number;
};

export type DayPlanItem = DayPlanAssignment & {
  id: string;
  habit: Habit;
};

export type DayPlan = {
  /** `local:*` oznacza snapshot z cache'u utworzony przed synchronizacją. */
  id: string;
  userId: string;
  date: IsoDate;
  dailyCeiling: number;
  /** `null` oznacza brak skonfigurowanego budżetu minut. */
  minuteBudget: number | null;
  timezone: string;
  dayStartHour: number;
  isRest: boolean;
  isQuietWeek: boolean;
  source: 'server' | 'local';
  items: DayPlanItem[];
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dayPlanItemSchema = z
  .object({
    id: z.string(),
    habit_id: z.string(),
    plan_state: dayPlanStateSchema,
    reason: dayPlanReasonSchema,
    sort_order: z.number().int(),
    target_value: z.number().nonnegative(),
    estimated_minutes: z.number().nonnegative(),
    habit: habitRowSchema,
  })
  .transform((row): DayPlanItem => ({
    id: row.id,
    habitId: row.habit_id,
    state: row.plan_state,
    reason: row.reason,
    sortOrder: row.sort_order,
    target: row.target_value,
    estimatedMinutes: row.estimated_minutes,
    habit: row.habit,
  }));

/** Walidacja JSON-u zwracanego przez ensure_day_plan(). */
export const dayPlanSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    plan_date: isoDateSchema,
    daily_ceiling: z.number().int().min(1).max(12),
    minute_budget: z.number().int().nonnegative().nullable(),
    timezone: z.string(),
    day_start_hour: z.number().int().min(0).max(23),
    is_rest: z.boolean(),
    is_quiet_week: z.boolean(),
    items: dayPlanItemSchema.array(),
  })
  .transform((row): DayPlan => ({
    id: row.id,
    userId: row.user_id,
    date: row.plan_date,
    dailyCeiling: row.daily_ceiling,
    minuteBudget: row.minute_budget,
    timezone: row.timezone,
    dayStartHour: row.day_start_hour,
    isRest: row.is_rest,
    isQuietWeek: row.is_quiet_week,
    source: 'server',
    items: row.items,
  }));

function ranked(tasks: readonly TodayTask[]): TodayTask[] {
  return [...tasks].sort((left, right) => {
    const minutes = estimateMinutes(left) - estimateMinutes(right);
    if (minutes !== 0) return minutes;

    const order = left.habit.sortOrder - right.habit.sortOrder;
    if (order !== 0) return order;

    return left.habit.id.localeCompare(right.habit.id);
  });
}

function neutralReason(input: {
  isRest: boolean;
  isQuietWeek: boolean;
}): DayPlanReason | null {
  if (input.isRest) return 'rest';
  if (input.isQuietWeek) return 'quiet_week';
  return null;
}

function assignment(
  task: TodayTask,
  state: DayPlanState,
  reason: DayPlanReason,
): DayPlanAssignment {
  return {
    habitId: task.habit.id,
    state,
    reason,
    sortOrder: task.habit.sortOrder,
    target: task.target,
    estimatedMinutes: estimateMinutes(task),
  };
}

export type PlanCapacity = {
  dailyCeiling: number;
  minuteBudget: number | null;
  isRest: boolean;
  isQuietWeek: boolean;
};

/**
 * Deterministyczny pierwszy snapshot. Stan logu nie wpływa na wybór — dzięki
 * temu replay wykonanego offline overflow nie zamienia go po synchronizacji
 * w obowiązek.
 */
export function createDayPlanAssignments(
  tasks: readonly TodayTask[],
  capacity: PlanCapacity,
): DayPlanAssignment[] {
  const neutral = neutralReason(capacity);
  if (neutral !== null) {
    return tasks.map((task) => assignment(task, 'overflow', neutral));
  }

  const byHabit = new Map<string, DayPlanAssignment>();
  let planned = 0;
  let usedMinutes = 0;

  for (const task of ranked(tasks)) {
    const minutes = estimateMinutes(task);
    const overCount = planned >= Math.max(0, Math.trunc(capacity.dailyCeiling));
    const overMinutes =
      capacity.minuteBudget !== null && usedMinutes + minutes > capacity.minuteBudget;

    if (overCount || overMinutes) {
      byHabit.set(
        task.habit.id,
        assignment(task, 'overflow', overCount ? 'daily_ceiling' : 'minute_budget'),
      );
      continue;
    }

    planned += 1;
    usedMinutes += minutes;
    byHabit.set(task.habit.id, assignment(task, 'planned', 'within_limit'));
  }

  return tasks.flatMap((task) => {
    const item = byHabit.get(task.habit.id);
    return item === undefined ? [] : [item];
  });
}

/**
 * Rekoncyliacja 3→2 / 2→4. Pozycja z logiem zachowuje dotychczasową klasę;
 * w szczególności wykonane overflow daje plus, ale nie zostaje obowiązkiem.
 */
export function reconcileDayPlanAssignments(
  previous: readonly DayPlanAssignment[],
  tasks: readonly TodayTask[],
  capacity: PlanCapacity,
): DayPlanAssignment[] {
  const neutral = neutralReason(capacity);
  if (neutral !== null) {
    return tasks.map((task) => assignment(task, 'overflow', neutral));
  }

  const previousByHabit = new Map(previous.map((item) => [item.habitId, item]));
  const next = new Map<string, DayPlanAssignment>();
  let planned = 0;
  let usedMinutes = 0;

  for (const task of tasks) {
    const old = previousByHabit.get(task.habit.id);
    if (old === undefined || task.log === null) continue;

    const pinned = { ...old, target: old.target };
    next.set(task.habit.id, pinned);
    if (pinned.state === 'planned') {
      planned += 1;
      usedMinutes += pinned.estimatedMinutes;
    }
  }

  for (const task of ranked(tasks.filter((candidate) => candidate.log === null))) {
    const old = previousByHabit.get(task.habit.id);
    const snapshot = old ?? assignment(task, 'overflow', 'daily_ceiling');
    const overCount = planned >= Math.max(0, Math.trunc(capacity.dailyCeiling));
    const overMinutes =
      capacity.minuteBudget !== null &&
      usedMinutes + snapshot.estimatedMinutes > capacity.minuteBudget;

    if (overCount || overMinutes) {
      next.set(task.habit.id, {
        ...snapshot,
        state: 'overflow',
        reason: overCount ? 'daily_ceiling' : 'minute_budget',
      });
      continue;
    }

    planned += 1;
    usedMinutes += snapshot.estimatedMinutes;
    next.set(task.habit.id, {
      ...snapshot,
      state: 'planned',
      reason: 'within_limit',
    });
  }

  return tasks.flatMap((task) => {
    const item = next.get(task.habit.id);
    return item === undefined ? [] : [item];
  });
}

export function assignmentMap(
  items: readonly DayPlanAssignment[],
): ReadonlyMap<string, DayPlanAssignment> {
  return new Map(items.map((item) => [item.habitId, item]));
}

/** Overflow bez wykonania jest neutralny; wykonanie zawsze jest pozytywną okazją. */
export function isExpectedPlanOutcome(
  state: DayPlanState,
  logStatus: HabitLogStatus | null,
): boolean {
  return state === 'planned' || logStatus === 'done' || logStatus === 'partial';
}

export function visiblePlanTasks(tasks: readonly TodayTask[]): {
  visible: TodayTask[];
  overflow: TodayTask[];
} {
  return {
    visible: tasks.filter(
      (task) => task.planState === 'planned' || task.isCompleted || task.isSkipped,
    ),
    overflow: tasks.filter(
      (task) => task.planState === 'overflow' && !task.isCompleted && !task.isSkipped,
    ),
  };
}
