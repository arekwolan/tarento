import type { Habit, HabitLog } from '@/features/habits/model/habit';
import {
  applyDailyCeiling,
  buildTodayTasks,
  estimateMinutes,
  type TodayTask,
} from '@/features/habits/model/today-task';

const MONDAY = '2026-03-16';
const SATURDAY = '2026-03-21';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    title: 'Czytanie',
    description: null,
    icon: null,
    color: null,
    unit: 'pages',
    category: null,
    startValue: 5,
    incrementValue: 1,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    reminderTime: null,
    timeOfDay: null,
    sourceBook: null,
    sourceAuthor: null,
    sortOrder: 0,
    sourcePathId: null,
    sourceStageId: null,
    retiredAt: null,
    startedOn: MONDAY,
    archivedAt: null,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    ...overrides,
  };
}

function log(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 'log-1',
    habitId: 'habit-1',
    userId: 'user-1',
    logDate: MONDAY,
    status: 'done',
    targetValue: 5,
    valueCompleted: 5,
    note: null,
    completedAt: '2026-03-16T09:00:00Z',
    ...overrides,
  };
}

describe('buildTodayTasks', () => {
  it('pomija nawyki spoza harmonogramu', () => {
    const weekdayHabit = habit({ id: 'weekdays', scheduleType: 'weekdays' });
    expect(buildTodayTasks([weekdayHabit], [], new Map(), SATURDAY)).toHaveLength(0);
    expect(buildTodayTasks([weekdayHabit], [], new Map(), MONDAY)).toHaveLength(1);
  });

  it('pomija nawyki zarchiwizowane', () => {
    const archived = habit({ archivedAt: '2026-03-16T10:00:00Z' });
    expect(buildTodayTasks([archived], [], new Map(), MONDAY)).toHaveLength(0);
  });

  it('liczy cel z progresji, gdy nie ma jeszcze wpisu', () => {
    const tasks = buildTodayTasks([habit()], [], new Map([['habit-1', 3]]), MONDAY);
    expect(tasks[0]?.target).toBe(8);
    expect(tasks[0]?.log).toBeNull();
    expect(tasks[0]?.isCompleted).toBe(false);
  });

  it('bierze cel ze snapshotu w logu, gdy wpis istnieje', () => {
    // Nawyk zmieniony po odhaczeniu nie może przesuwać celu pod gotowym wpisem.
    const tasks = buildTodayTasks(
      [habit({ startValue: 50 })],
      [log({ targetValue: 5 })],
      new Map([['habit-1', 3]]),
      MONDAY,
    );
    expect(tasks[0]?.target).toBe(5);
    expect(tasks[0]?.isCompleted).toBe(true);
  });

  it('partial liczy się jako wykonane, skipped nie', () => {
    const partial = buildTodayTasks(
      [habit()],
      [log({ status: 'partial' })],
      new Map(),
      MONDAY,
    );
    expect(partial[0]?.isCompleted).toBe(true);
    expect(partial[0]?.isSkipped).toBe(false);

    const skipped = buildTodayTasks(
      [habit()],
      [log({ status: 'skipped' })],
      new Map(),
      MONDAY,
    );
    expect(skipped[0]?.isCompleted).toBe(false);
    expect(skipped[0]?.isSkipped).toBe(true);
  });

  it('nie miesza logów między nawykami', () => {
    const tasks = buildTodayTasks(
      [habit({ id: 'a', sortOrder: 0 }), habit({ id: 'b', sortOrder: 1 })],
      [log({ habitId: 'b' })],
      new Map(),
      MONDAY,
    );
    expect(tasks[0]?.isCompleted).toBe(false);
    expect(tasks[1]?.isCompleted).toBe(true);
  });

  it('sortuje po sortOrder, a przy remisie po tytule', () => {
    const tasks = buildTodayTasks(
      [
        habit({ id: 'c', title: 'Zapiski', sortOrder: 1 }),
        habit({ id: 'a', title: 'Bieganie', sortOrder: 0 }),
        habit({ id: 'b', title: 'Ambitne', sortOrder: 0 }),
      ],
      [],
      new Map(),
      MONDAY,
    );
    expect(tasks.map((task) => task.habit.title)).toEqual([
      'Ambitne',
      'Bieganie',
      'Zapiski',
    ]);
  });

  it('brak licznika wykonań traktuje jak zero', () => {
    const tasks = buildTodayTasks([habit()], [], new Map(), MONDAY);
    expect(tasks[0]?.target).toBe(5);
  });
});

// Sufit dnia -----------------------------------------------------------------

function task(
  id: string,
  habitOverrides: Partial<Habit> = {},
  stateOverrides: Partial<TodayTask> = {},
): TodayTask {
  return {
    habit: habit({ id, ...habitOverrides }),
    date: MONDAY,
    target: 10,
    targetDelta: 0,
    log: null,
    isCompleted: false,
    isSkipped: false,
    planState: 'planned',
    planReason: 'legacy_fallback',
    ...stateOverrides,
  };
}

function ids(tasks: readonly TodayTask[]): string[] {
  return tasks.map((entry) => entry.habit.id);
}

describe('estimateMinutes', () => {
  it('minuty biorą cel wprost', () => {
    expect(estimateMinutes(task('a', { unit: 'minutes' }, { target: 20 }))).toBe(20);
  });

  it('sekundy przeliczają się na minuty', () => {
    expect(estimateMinutes(task('a', { unit: 'seconds' }, { target: 120 }))).toBe(2);
  });

  it('pozostałe jednostki dostają ryczałt', () => {
    expect(estimateMinutes(task('a', { unit: 'pages' }, { target: 30 }))).toBe(3);
    expect(estimateMinutes(task('a', { unit: 'none' }, { target: 1 }))).toBe(3);
  });
});

describe('applyDailyCeiling', () => {
  const many = Array.from({ length: 9 }, (_, index) =>
    task(`habit-${index}`, { sortOrder: index }),
  );

  it('sufit 5 przy dziewięciu nawykach zwraca 5 i 4', () => {
    const { visible, overflow } = applyDailyCeiling(many, 5, Number.POSITIVE_INFINITY);

    expect(ids(visible)).toEqual(['habit-0', 'habit-1', 'habit-2', 'habit-3', 'habit-4']);
    expect(overflow).toHaveLength(4);
  });

  it('pozycja wykonana nie wypada nigdy', () => {
    const tasks = [
      task('zrobione', { sortOrder: 0 }, { isCompleted: true }),
      task('a', { sortOrder: 1 }),
      task('b', { sortOrder: 2 }),
    ];

    const { visible, overflow } = applyDailyCeiling(tasks, 1, 0);

    expect(ids(visible)).toEqual(['zrobione']);
    expect(ids(overflow)).toEqual(['a', 'b']);
  });

  it('przy zerze minut zostają wyłącznie pozycje wykonane', () => {
    const tasks = [
      task('a', { sortOrder: 0 }),
      task('zrobione', { sortOrder: 1 }, { isCompleted: true }),
      task('b', { sortOrder: 2 }),
    ];

    const { visible } = applyDailyCeiling(tasks, 5, 0);

    expect(visible.every((entry) => entry.isCompleted)).toBe(true);
  });

  it('odhaczenie nie wypycha innej pozycji z listy', () => {
    const before = applyDailyCeiling(many, 3, Number.POSITIVE_INFINITY);

    const afterToggle = many.map((entry) =>
      entry.habit.id === 'habit-0' ? { ...entry, isCompleted: true } : entry,
    );
    const after = applyDailyCeiling(afterToggle, 3, Number.POSITIVE_INFINITY);

    expect(ids(after.visible)).toEqual(ids(before.visible));
  });

  it('najpierw wypadają pozycje, których pora już minęła', () => {
    const tasks = [
      task('rano', { timeOfDay: 'morning', sortOrder: 0 }),
      task('wieczorem', { timeOfDay: 'evening', sortOrder: 1 }),
    ];

    const { visible } = applyDailyCeiling(tasks, 1, Number.POSITIVE_INFINITY, 'evening');

    expect(ids(visible)).toEqual(['wieczorem']);
  });

  it('bez znanej pory dnia nic nie jest spóźnione', () => {
    const tasks = [
      task('rano', { timeOfDay: 'morning', sortOrder: 0 }),
      task('wieczorem', { timeOfDay: 'evening', sortOrder: 1 }),
    ];

    const { visible } = applyDailyCeiling(tasks, 1, Number.POSITIVE_INFINITY);

    expect(ids(visible)).toEqual(['rano']);
  });

  it('potem wypadają najdłuższe', () => {
    const tasks = [
      task('krotki', { unit: 'minutes', sortOrder: 0 }, { target: 5 }),
      task('dlugi', { unit: 'minutes', sortOrder: 1 }, { target: 40 }),
    ];

    const { visible } = applyDailyCeiling(tasks, 1, Number.POSITIVE_INFINITY);

    expect(ids(visible)).toEqual(['krotki']);
  });

  it('pozycja, która się nie mieści, nie zabiera miejsca krótszym', () => {
    const tasks = [
      task('dlugi', { unit: 'minutes', sortOrder: 0 }, { target: 40 }),
      task('krotki', { unit: 'minutes', sortOrder: 1 }, { target: 10 }),
    ];

    const { visible, overflow } = applyDailyCeiling(tasks, 5, 15);

    expect(ids(visible)).toEqual(['krotki']);
    expect(ids(overflow)).toEqual(['dlugi']);
  });

  it('wynik zachowuje kolejność wejściową', () => {
    const tasks = [
      task('dlugi', { unit: 'minutes', sortOrder: 0 }, { target: 30 }),
      task('sredni', { unit: 'minutes', sortOrder: 1 }, { target: 20 }),
      task('krotki', { unit: 'minutes', sortOrder: 2 }, { target: 10 }),
    ];

    const { visible } = applyDailyCeiling(tasks, 2, Number.POSITIVE_INFINITY);

    expect(ids(visible)).toEqual(['sredni', 'krotki']);
  });
});
