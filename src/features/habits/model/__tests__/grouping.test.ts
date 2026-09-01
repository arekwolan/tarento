import type { Habit } from '@/features/habits/model/habit';
import {
  countCompleted,
  formatTargetValue,
  greetingBand,
  groupTasksByTimeOfDay,
  isDayComplete,
  targetUnitKey,
} from '@/features/habits/model/grouping';
import type { TodayTask } from '@/features/habits/model/today-task';

function task(
  overrides: Partial<Habit> & { done?: boolean; skipped?: boolean },
): TodayTask {
  const { done = false, skipped = false, ...habitOverrides } = overrides;

  const habit = {
    id: 'h',
    userId: 'u',
    title: 'Nawyk',
    description: null,
    icon: null,
    color: null,
    unit: 'none',
    category: null,
    startValue: 1,
    incrementValue: 0,
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
    startedOn: '2026-03-16',
    archivedAt: null,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    ...habitOverrides,
  } satisfies Habit;

  return {
    habit,
    date: '2026-03-16',
    target: 1,
    targetDelta: 0,
    log: null,
    isCompleted: done,
    isSkipped: skipped,
    planState: 'planned',
    planReason: 'legacy_fallback',
  };
}

describe('groupTasksByTimeOfDay', () => {
  it('układa sekcje od rana do wieczora, bez pory na końcu', () => {
    const groups = groupTasksByTimeOfDay([
      task({ id: 'a', timeOfDay: null }),
      task({ id: 'b', timeOfDay: 'evening' }),
      task({ id: 'c', timeOfDay: 'morning' }),
      task({ id: 'd', timeOfDay: 'afternoon' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'morning',
      'afternoon',
      'evening',
      'anytime',
    ]);
  });

  it('pomija puste sekcje', () => {
    const groups = groupTasksByTimeOfDay([task({ id: 'a', timeOfDay: 'morning' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('morning');
  });

  it('pusta lista daje brak sekcji', () => {
    expect(groupTasksByTimeOfDay([])).toEqual([]);
  });
});

describe('liczniki dnia', () => {
  it('pominięte nie liczą się jako wykonane', () => {
    const tasks = [task({ id: 'a', done: true }), task({ id: 'b', skipped: true })];
    expect(countCompleted(tasks)).toBe(1);
  });

  it('dzień jest domknięty, gdy każda pozycja ma decyzję', () => {
    expect(
      isDayComplete([task({ id: 'a', done: true }), task({ id: 'b', skipped: true })]),
    ).toBe(true);
    expect(isDayComplete([task({ id: 'a', done: true }), task({ id: 'b' })])).toBe(false);
  });

  it('pusty dzień nie jest domknięty', () => {
    expect(isDayComplete([])).toBe(false);
  });
});

describe('greetingBand', () => {
  it.each([
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
    [0, 'evening'],
    [4, 'evening'],
  ])('godzina %s → %s', (hour, expected) => {
    expect(greetingBand(hour)).toBe(expected);
  });
});

describe('formatowanie celu', () => {
  it('jednostki bez skrótu zwracają null', () => {
    expect(targetUnitKey('count')).toBeNull();
    expect(targetUnitKey('none')).toBeNull();
    expect(targetUnitKey('minutes')).toBe('habits.units.minutes');
  });

  it('obcina zbędne zera', () => {
    expect(formatTargetValue(3)).toBe('3');
    expect(formatTargetValue(2.5)).toBe('2.5');
    expect(formatTargetValue(2.004)).toBe('2');
  });
});
