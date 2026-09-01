import {
  buildObservation,
  forecastDate,
  type ObservationHabit,
  type ObservationInput,
} from '@/features/stats/model/observation';
import type { DaySummary, HabitStat } from '@/features/stats/model/stats';
import { addDays, type HabitProgression, type IsoDate } from '@/lib/date';

/**
 * Obserwacja ma być jedna i ma być prawdziwa. Każda gałąź priorytetu dostaje
 * tu test, bo kolejność jest tu decyzją produktową — a nie szczegółem
 * implementacji, który wolno po cichu przestawić.
 */

/** Poniedziałek, żeby dni tygodnia w testach dało się policzyć w głowie. */
const TODAY: IsoDate = '2026-06-15';

function days(entries: readonly { offset: number; ratio: number }[]): DaySummary[] {
  return entries.map(({ offset, ratio }) => ({
    day: addDays(TODAY, -offset),
    scheduled: 4,
    completed: Math.round(4 * ratio),
  }));
}

function habit(overrides: Partial<ObservationHabit> = {}): ObservationHabit {
  return {
    id: 'habit-1',
    title: 'Czytanie',
    startedOn: addDays(TODAY, -30),
    timeOfDay: null,
    ...overrides,
  };
}

function stat(overrides: Partial<HabitStat> = {}): HabitStat {
  return {
    habitId: 'habit-1',
    scheduled7: 7,
    completed7: 7,
    scheduled30: 30,
    completed30: 30,
    currentStreak: 0,
    longestStreak: 0,
    recentDays: [],
    ...overrides,
  };
}

function input(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return { days: [], habits: [], habitStats: [], today: TODAY, ...overrides };
}

describe('buildObservation', () => {
  it('bez danych mówi wprost, że jest za wcześnie', () => {
    expect(buildObservation(input())).toEqual({ key: 'stats.observation.tooEarly' });
  });

  it('wskazuje najlepszy i najgorszy dzień tygodnia', () => {
    // 28 dni: poniedziałki w komplecie, niedziele puste, reszta po połowie.
    const entries = Array.from({ length: 28 }, (_, offset) => {
      const weekday = (offset + 1) % 7;
      const ratio = weekday === 0 ? 1 : weekday === 1 ? 0 : 0.5;
      return { offset: offset + 1, ratio };
    });

    expect(buildObservation(input({ days: days(entries) }))).toEqual({
      key: 'stats.observation.weekday',
      keys: { best: expect.stringContaining('dayPlural.'), worst: expect.any(String) },
    });
  });

  it('nie wyciąga wniosku o dniach tygodnia z dziesięciu dni', () => {
    const entries = Array.from({ length: 10 }, (_, offset) => ({
      offset: offset + 1,
      ratio: offset % 7 === 0 ? 1 : 0,
    }));

    expect(buildObservation(input({ days: days(entries) })).key).not.toBe(
      'stats.observation.weekday',
    );
  });

  it('nie wyciąga wniosku, gdy różnica między dniami jest za mała', () => {
    const flat = Array.from({ length: 28 }, (_, offset) => ({
      offset: offset + 1,
      ratio: 0.5,
    }));

    expect(buildObservation(input({ days: days(flat) })).key).not.toBe(
      'stats.observation.weekday',
    );
  });

  it('schodzi na najdłużej prowadzony nawyk', () => {
    const observation = buildObservation(
      input({
        habits: [
          habit({ id: 'a', title: 'Spacer', startedOn: addDays(TODAY, -40) }),
          habit({ id: 'b', title: 'Czytanie', startedOn: addDays(TODAY, -90) }),
        ],
      }),
    );

    expect(observation).toEqual({
      key: 'stats.observation.longestHabit',
      values: { title: 'Czytanie', days: 90 },
    });
  });

  it('nie mówi o nawyku młodszym niż dwa tygodnie', () => {
    const observation = buildObservation(
      input({ habits: [habit({ startedOn: addDays(TODAY, -13) })] }),
    );

    expect(observation.key).not.toBe('stats.observation.longestHabit');
  });

  it('wskazuje porę dnia, gdy jest co z czym porównać', () => {
    const observation = buildObservation(
      input({
        habits: [
          habit({ id: 'a', timeOfDay: 'morning', startedOn: addDays(TODAY, -5) }),
          habit({ id: 'b', timeOfDay: 'evening', startedOn: addDays(TODAY, -5) }),
        ],
        habitStats: [
          stat({ habitId: 'a', scheduled30: 30, completed30: 27 }),
          stat({ habitId: 'b', scheduled30: 30, completed30: 6 }),
        ],
      }),
    );

    expect(observation).toEqual({
      key: 'stats.observation.timeOfDay',
      keys: { band: 'stats.observation.bands.morning' },
    });
  });

  it('nie wskazuje pory dnia, gdy istnieje tylko jedna', () => {
    const observation = buildObservation(
      input({
        habits: [habit({ id: 'a', timeOfDay: 'morning', startedOn: addDays(TODAY, -5) })],
        habitStats: [stat({ habitId: 'a' })],
      }),
    );

    expect(observation.key).not.toBe('stats.observation.timeOfDay');
  });

  it('na końcu liczy dni domknięte w tym miesiącu', () => {
    const observation = buildObservation(
      input({
        days: [
          { day: '2026-06-02', scheduled: 2, completed: 2 },
          { day: '2026-06-03', scheduled: 2, completed: 1 },
          { day: '2026-06-04', scheduled: 2, completed: 2 },
          { day: '2026-05-30', scheduled: 2, completed: 2 },
        ],
      }),
    );

    expect(observation).toEqual({
      key: 'stats.observation.fullDays',
      values: { count: 2 },
    });
  });

  it('pomija dni puste przy wyciąganiu wniosków', () => {
    const isRestDay = (day: IsoDate) => day === '2026-06-04';

    const observation = buildObservation(
      input({
        days: [
          { day: '2026-06-02', scheduled: 2, completed: 2 },
          { day: '2026-06-04', scheduled: 2, completed: 2 },
        ],
        isRestDay,
      }),
    );

    expect(observation).toEqual({
      key: 'stats.observation.fullDays',
      values: { count: 1 },
    });
  });
});

describe('forecastDate', () => {
  function progression(overrides: Partial<HabitProgression> = {}): HabitProgression {
    return {
      scheduleType: 'daily',
      scheduleDays: null,
      startedOn: addDays(TODAY, -10),
      startValue: 10,
      incrementValue: 1,
      targetValue: 30,
      progressionMode: 'calendar',
      ...overrides,
    };
  }

  it('liczy dzień dobicia do sufitu po dniach z harmonogramu', () => {
    // Start 10, dziesięć dni po jednym: dziś cel wynosi 20, brakuje dziesięciu.
    expect(forecastDate(progression(), TODAY)).toBe(addDays(TODAY, 10));
  });

  it('liczy tylko dni z harmonogramu, więc rzadszy nawyk dobija później', () => {
    const daily = forecastDate(progression(), TODAY);
    const weekdays = forecastDate(progression({ scheduleType: 'weekdays' }), TODAY);

    expect(daily).not.toBeNull();
    expect(weekdays).not.toBeNull();
    // Ten sam sufit i to samo tempo — różni się wyłącznie liczba dni,
    // w które nawyk w ogóle wypada.
    expect(weekdays === null || daily === null ? '' : weekdays > daily).toBe(true);
  });

  it('nie prognozuje bez tempa, bez sufitu i przy progresji po wykonaniu', () => {
    expect(forecastDate(progression({ incrementValue: 0 }), TODAY)).toBeNull();
    expect(forecastDate(progression({ targetValue: null }), TODAY)).toBeNull();
    expect(
      forecastDate(progression({ progressionMode: 'completion' }), TODAY),
    ).toBeNull();
  });

  it('nie prognozuje nawyku, który jest już przy suficie', () => {
    expect(forecastDate(progression({ targetValue: 15 }), TODAY)).toBeNull();
  });
});
