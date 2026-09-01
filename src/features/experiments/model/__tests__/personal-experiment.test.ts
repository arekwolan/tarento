import {
  comparePersonalExperiment,
  habitAfterPersonalExperimentAction,
  optimisticPersonalExperimentAction,
  personalExperimentFormSchema,
  type PersonalExperiment,
} from '@/features/experiments/model/personal-experiment';
import type { Habit } from '@/features/habits';
import { addDays } from '@/lib/date';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    title: 'Czytanie',
    description: null,
    icon: null,
    color: null,
    unit: 'minutes',
    category: 'learning',
    startValue: 5,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    reminderTime: '08:00:00',
    timeOfDay: 'morning',
    sourceBook: null,
    sourceAuthor: null,
    sortOrder: 0,
    sourcePathId: null,
    sourceStageId: null,
    startedOn: '2026-03-20',
    retiredAt: null,
    archivedAt: null,
    createdAt: '2026-03-20T08:00:00Z',
    updatedAt: '2026-03-20T08:00:00Z',
    ...overrides,
  };
}

function experiment(overrides: Partial<PersonalExperiment> = {}): PersonalExperiment {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    userId: '10000000-0000-4000-8000-000000000002',
    habitId: '10000000-0000-4000-8000-000000000003',
    hypothesis: 'target_size',
    state: 'draft',
    currentBlock: null,
    opportunityTarget: 7,
    originalSnapshot: {
      title: 'Czytanie',
      description: null,
      icon: null,
      color: null,
      unit: 'minutes',
      category: 'learning',
      start_value: 5,
      increment_value: 0,
      target_value: null,
      progression_mode: 'completion',
      schedule_type: 'daily',
      schedule_days: null,
      reminder_time: '08:00:00',
      time_of_day: 'morning',
      source_book: null,
      source_author: null,
      source_path_id: null,
      source_stage_id: null,
      retired: false,
      archived: false,
    },
    variantA: { start_value: 5 },
    variantB: { start_value: 2 },
    reminderOptIn: false,
    plannedAStart: '2026-03-28',
    plannedAEnd: '2026-04-03',
    plannedBStart: '2026-04-04',
    plannedBEnd: '2026-04-10',
    blockStartedOn: null,
    aExpected: 0,
    aCompleted: 0,
    bExpected: 0,
    bCompleted: 0,
    pausedOn: null,
    startedOn: null,
    completedOn: null,
    cancelledOn: null,
    decision: null,
    decidedOn: null,
    createdAt: '2026-03-28T08:00:00Z',
    updatedAt: '2026-03-28T08:00:00Z',
    ...overrides,
  };
}

describe('personal experiment', () => {
  it('przyjmuje tylko jedną zamkniętą hipotezę i dwa różne warianty', () => {
    expect(
      personalExperimentFormSchema.safeParse({
        hypothesis: 'time_of_day',
        aTimeOfDay: 'morning',
        bTimeOfDay: 'evening',
        reminderOptIn: false,
      }).success,
    ).toBe(true);
    expect(
      personalExperimentFormSchema.safeParse({
        hypothesis: 'time_of_day',
        aTimeOfDay: 'morning',
        bTimeOfDay: 'morning',
        reminderOptIn: false,
      }).success,
    ).toBe(false);
    expect(
      personalExperimentFormSchema.safeParse({
        hypothesis: 'target_size',
        aTarget: '5',
        bTarget: '5',
      }).success,
    ).toBe(false);
  });

  it('prowadzi pełny przepływ draft, start, pauza, wznowienie i wybór B', () => {
    const source = experiment();
    const started = optimisticPersonalExperimentAction(source, 'start', '2026-03-28');
    const paused = optimisticPersonalExperimentAction(started, 'pause', '2026-03-30');
    const resumed = optimisticPersonalExperimentAction(paused, 'resume', '2026-04-01');
    const completed = {
      ...resumed,
      state: 'completed' as const,
      currentBlock: 'b' as const,
      aExpected: 7,
      aCompleted: 4,
      bExpected: 7,
      bCompleted: 6,
      completedOn: '2026-04-12',
    };
    const decided = optimisticPersonalExperimentAction(
      completed,
      'choose_b',
      '2026-04-13',
    );

    expect(started).toMatchObject({ state: 'active', currentBlock: 'a' });
    expect(paused).toMatchObject({ state: 'paused', pausedOn: '2026-03-30' });
    expect(resumed).toMatchObject({ state: 'active', blockStartedOn: '2026-04-01' });
    expect(decided).toMatchObject({ decision: 'b', decidedOn: '2026-04-13' });
    expect(
      habitAfterPersonalExperimentAction(habit(), completed, 'choose_b').startValue,
    ).toBe(2);
  });

  it('przerwanie przywraca badaną wcześniejszą wartość', () => {
    const source = experiment({ state: 'active', currentBlock: 'b' });
    const currentHabit = habit({ startValue: 2 });

    expect(
      habitAfterPersonalExperimentAction(currentHabit, source, 'cancel'),
    ).toMatchObject({
      startValue: 5,
      reminderTime: '08:00:00',
    });
  });

  it('nie zmienia przypomnienia bez opt-in i zmienia istniejące po opt-in', () => {
    const currentHabit = habit();
    const withoutOptIn = experiment({
      hypothesis: 'time_of_day',
      variantA: { time_of_day: 'evening' },
      variantB: { time_of_day: 'morning' },
      reminderOptIn: false,
    });
    const withOptIn = experiment({
      hypothesis: 'time_of_day',
      variantA: { time_of_day: 'evening', reminder_time: '20:00:00' },
      variantB: { time_of_day: 'morning', reminder_time: '08:00:00' },
      reminderOptIn: true,
    });

    expect(
      habitAfterPersonalExperimentAction(currentHabit, withoutOptIn, 'start'),
    ).toMatchObject({ timeOfDay: 'evening', reminderTime: '08:00:00' });
    expect(
      habitAfterPersonalExperimentAction(currentHabit, withOptIn, 'start'),
    ).toMatchObject({ timeOfDay: 'evening', reminderTime: '20:00:00' });
  });

  it('opisuje B jako częstsze bez wniosku przyczynowego i oznacza małą próbę', () => {
    const result = comparePersonalExperiment({
      aExpected: 7,
      aCompleted: 3,
      bExpected: 7,
      bCompleted: 5,
    });

    expect(result).toEqual({
      lead: 'b',
      aRate: 3 / 7,
      bRate: 5 / 7,
      differencePercentagePoints: 29,
      isSmallSample: true,
    });
  });

  it('nie formułuje różnicy, gdy jeden blok nie ma okazji', () => {
    expect(
      comparePersonalExperiment({
        aExpected: 2,
        aCompleted: 2,
        bExpected: 0,
        bCompleted: 0,
      }).lead,
    ).toBe('too_early');
  });

  it('planuje dni jako IsoDate bez przesunięcia na granicy DST', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});
