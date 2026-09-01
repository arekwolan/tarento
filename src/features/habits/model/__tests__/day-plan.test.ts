import type { Habit, HabitLog } from '@/features/habits/model/habit';
import {
  createDayPlanAssignments,
  isExpectedPlanOutcome,
  reconcileDayPlanAssignments,
  visiblePlanTasks,
} from '@/features/habits/model/day-plan';
import type { TodayTask } from '@/features/habits/model/today-task';
import { getLogicalToday, zonedDateTimeToInstant } from '@/lib/date';

const DAY = '2026-03-16';

function habit(id: string, sortOrder: number): Habit {
  return {
    id,
    userId: 'user-1',
    title: id,
    description: null,
    icon: null,
    color: null,
    unit: 'minutes',
    category: null,
    startValue: 5,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    reminderTime: null,
    timeOfDay: null,
    sourceBook: null,
    sourceAuthor: null,
    sortOrder,
    sourcePathId: null,
    sourceStageId: null,
    retiredAt: null,
    startedOn: DAY,
    archivedAt: null,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
  };
}

function completedLog(id: string): HabitLog {
  return {
    id: `log-${id}`,
    habitId: id,
    userId: 'user-1',
    logDate: DAY,
    status: 'done',
    targetValue: 5,
    valueCompleted: 5,
    note: null,
    completedAt: '2026-03-16T09:00:00Z',
  };
}

function task(id: string, sortOrder: number, log: HabitLog | null = null): TodayTask {
  return {
    habit: habit(id, sortOrder),
    date: DAY,
    target: 5,
    targetDelta: 0,
    log,
    isCompleted: log?.status === 'done',
    isSkipped: log?.status === 'skipped',
    planState: 'planned',
    planReason: 'legacy_fallback',
  };
}

const unlimited = {
  dailyCeiling: 3,
  minuteBudget: null,
  isRest: false,
  isQuietWeek: false,
};

describe('trwały plan dnia', () => {
  it('pięć nawyków przy limicie 3 daje trzy planned i dwa neutralne overflow', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(`h-${index}`, index));
    const plan = createDayPlanAssignments(tasks, unlimited);

    expect(plan.filter((item) => item.state === 'planned')).toHaveLength(3);
    expect(plan.filter((item) => item.state === 'overflow')).toHaveLength(2);
    expect(
      plan
        .filter((item) => item.state === 'overflow')
        .every((item) => !isExpectedPlanOutcome(item.state, null)),
    ).toBe(true);
  });

  it('wykonane overflow liczy się pozytywnie bez zmiany w obowiązek', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(`h-${index}`, index));
    const initial = createDayPlanAssignments(tasks, unlimited);
    const overflow = initial.find((item) => item.state === 'overflow');
    expect(overflow).toBeDefined();
    if (overflow === undefined) return;

    const withCompletion = tasks.map((entry) =>
      entry.habit.id === overflow.habitId
        ? task(entry.habit.id, entry.habit.sortOrder, completedLog(entry.habit.id))
        : entry,
    );
    const replayed = reconcileDayPlanAssignments(initial, withCompletion, unlimited);
    const completed = replayed.find((item) => item.habitId === overflow.habitId);

    expect(completed?.state).toBe('overflow');
    expect(isExpectedPlanOutcome('overflow', 'done')).toBe(true);
  });

  it('rekoncyliuje limit 3→2 i 2→4 w tym samym dniu', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(`h-${index}`, index));
    const atThree = createDayPlanAssignments(tasks, unlimited);
    const atTwo = reconcileDayPlanAssignments(atThree, tasks, {
      ...unlimited,
      dailyCeiling: 2,
    });
    const atFour = reconcileDayPlanAssignments(atTwo, tasks, {
      ...unlimited,
      dailyCeiling: 4,
    });

    expect(atTwo.filter((item) => item.state === 'planned')).toHaveLength(2);
    expect(atFour.filter((item) => item.state === 'planned')).toHaveLength(4);
  });

  it('ukończona pozycja planned nie znika po obniżeniu limitu', () => {
    const before = [task('a', 0), task('b', 1), task('c', 2)];
    const initial = createDayPlanAssignments(before, unlimited);
    const after = [task('a', 0, completedLog('a')), task('b', 1), task('c', 2)];
    const reconciled = reconcileDayPlanAssignments(initial, after, {
      ...unlimited,
      dailyCeiling: 1,
    });
    const tasksWithState = after.map((entry) => ({
      ...entry,
      planState:
        reconciled.find((item) => item.habitId === entry.habit.id)?.state ??
        entry.planState,
    }));

    expect(reconciled.find((item) => item.habitId === 'a')?.state).toBe('planned');
    expect(
      visiblePlanTasks(tasksWithState).visible.map((entry) => entry.habit.id),
    ).toContain('a');
  });

  it('powtórzony replay offline jest idempotentny', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(`h-${index}`, index));
    const initial = createDayPlanAssignments(tasks, unlimited);
    const firstReplay = reconcileDayPlanAssignments(initial, tasks, unlimited);
    const secondReplay = reconcileDayPlanAssignments(firstReplay, tasks, unlimited);

    expect(secondReplay).toEqual(firstReplay);
  });

  it.each([
    [{ isRest: true, isQuietWeek: false }, 'rest'],
    [{ isRest: false, isQuietWeek: true }, 'quiet_week'],
  ] as const)('%s jest neutralne', (mode, reason) => {
    const plan = createDayPlanAssignments([task('a', 0), task('b', 1)], {
      ...unlimited,
      ...mode,
    });

    expect(plan.every((item) => item.state === 'overflow')).toBe(true);
    expect(plan.every((item) => item.reason === reason)).toBe(true);
  });

  it('klucz snapshotu podąża za granicą dnia logicznego i zmianą strefy', () => {
    const beforeBoundary = zonedDateTimeToInstant('2026-03-16', '03:30', 'Europe/Berlin');
    const timezoneShift = zonedDateTimeToInstant('2026-03-16', '23:00', 'Europe/Berlin');
    expect(beforeBoundary).not.toBeNull();
    expect(timezoneShift).not.toBeNull();
    if (beforeBoundary === null || timezoneShift === null) return;

    expect(getLogicalToday('Europe/Berlin', 4, beforeBoundary)).toBe('2026-03-15');
    expect(getLogicalToday('Europe/Berlin', 4, timezoneShift)).toBe('2026-03-16');
    expect(getLogicalToday('Pacific/Auckland', 4, timezoneShift)).toBe('2026-03-17');
  });

  it('stary dzień bez snapshotu zachowuje planned jako fallback harmonogramu', () => {
    expect(isExpectedPlanOutcome('planned', null)).toBe(true);
    expect(isExpectedPlanOutcome('planned', 'skipped')).toBe(true);
    expect(isExpectedPlanOutcome('overflow', null)).toBe(false);
  });
});
