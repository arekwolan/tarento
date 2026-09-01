import {
  isQuietWeekActive,
  nextQuietWeek,
  quietWeekEndsOn,
  shouldEnterQuietWeek,
  type QuietDay,
  type QuietWeekContext,
} from '@/features/notifications/model/quiet';
import { addDays, type IsoDate } from '@/lib/date';

/**
 * Cichy tydzień ma wejść rzadko i wyłącznie wtedy, gdy naprawdę było ciężko.
 * Wyciszenie wywołane tygodniem odpoczynku byłoby karą za odpoczynek — stąd
 * warunek o liczbie dni z harmonogramu i jego test.
 */

const TODAY: IsoDate = '2026-06-15';

/** Siedem dni przed dzisiaj, każdy z dwoma pozycjami. */
function week(completedPerDay: readonly number[]): QuietDay[] {
  return completedPerDay.map((completed, index) => ({
    day: addDays(TODAY, -(index + 1)),
    scheduled: 2,
    completed,
  }));
}

const CONTEXT: QuietWeekContext = { lastQuietWeekOn: null };

describe('shouldEnterQuietWeek', () => {
  it('wchodzi po siedmiu dniach poniżej trzydziestu procent', () => {
    // 3 z 14 pozycji to 21%.
    expect(shouldEnterQuietWeek(week([1, 1, 1, 0, 0, 0, 0]), TODAY, CONTEXT)).toBe(true);
  });

  it('nie wchodzi, gdy wykonanie sięga progu', () => {
    // 5 z 14 to 36%.
    expect(shouldEnterQuietWeek(week([1, 1, 1, 1, 1, 0, 0]), TODAY, CONTEXT)).toBe(false);
  });

  it('tydzień z czterema dniami pustymi nie wyzwala wyciszenia', () => {
    const restDays = new Set([
      addDays(TODAY, -1),
      addDays(TODAY, -2),
      addDays(TODAY, -3),
      addDays(TODAY, -4),
    ]);

    expect(
      shouldEnterQuietWeek(week([0, 0, 0, 0, 0, 0, 0]), TODAY, {
        ...CONTEXT,
        isRestDay: (day) => restDays.has(day),
      }),
    ).toBe(false);
  });

  it('nie wyzwala się przy mniej niż pięciu dniach z harmonogramu', () => {
    const sparse = week([0, 0, 0, 0, 0, 0, 0]).slice(0, 4);

    expect(shouldEnterQuietWeek(sparse, TODAY, CONTEXT)).toBe(false);
  });

  it('nie wycisza dwa razy w ciągu trzech tygodni', () => {
    const bad = week([0, 0, 0, 0, 0, 0, 0]);

    expect(
      shouldEnterQuietWeek(bad, TODAY, { lastQuietWeekOn: addDays(TODAY, -20) }),
    ).toBe(false);
    expect(
      shouldEnterQuietWeek(bad, TODAY, { lastQuietWeekOn: addDays(TODAY, -21) }),
    ).toBe(true);
  });

  it('nie liczy dzisiaj — doba jeszcze trwa', () => {
    const withToday: QuietDay[] = [
      { day: TODAY, scheduled: 2, completed: 0 },
      ...week([1, 1, 1, 1, 1, 1, 1]),
    ];

    expect(shouldEnterQuietWeek(withToday, TODAY, CONTEXT)).toBe(false);
  });
});

describe('isQuietWeekActive', () => {
  const active = {
    id: 'quiet-1',
    startedOn: addDays(TODAY, -3),
    endsOn: addDays(TODAY, 3),
    endedEarlyAt: null,
  };

  it('obowiązuje między datą wejścia a datą końca', () => {
    expect(isQuietWeekActive(active, TODAY)).toBe(true);
    expect(isQuietWeekActive(active, addDays(TODAY, 4))).toBe(false);
    expect(isQuietWeekActive(active, addDays(TODAY, -4))).toBe(false);
  });

  it('kończy się od razu po włączeniu przypomnień ręcznie', () => {
    expect(
      isQuietWeekActive({ ...active, endedEarlyAt: '2026-06-14T10:00:00Z' }, TODAY),
    ).toBe(false);
  });

  it('bez wyciszenia nie ma daty do pokazania', () => {
    expect(quietWeekEndsOn(null, TODAY)).toBeNull();
    expect(quietWeekEndsOn(active, TODAY)).toBe(active.endsOn);
  });
});

describe('nextQuietWeek', () => {
  it('trwa siedem dni, licząc z dniem wejścia', () => {
    expect(nextQuietWeek(TODAY)).toEqual({
      startedOn: TODAY,
      endsOn: addDays(TODAY, 6),
    });
  });
});
