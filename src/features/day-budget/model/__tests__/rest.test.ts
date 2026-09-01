import {
  findRestDate,
  findRestWeekday,
  isRestDay,
  restWeekdays,
  type RestDay,
} from '@/features/day-budget/model/rest';

/** 2026-03-16 to poniedziałek, 2026-03-21 sobota, 2026-03-22 niedziela. */
const MONDAY = '2026-03-16';
const SATURDAY = '2026-03-21';
const SUNDAY = '2026-03-22';

function weekdayRest(weekday: number, id = `weekday-${weekday}`): RestDay {
  return {
    id,
    userId: 'user-1',
    weekday,
    restDate: null,
    createdAt: '2026-03-01T08:00:00.000Z',
  };
}

function dateRest(restDate: string, id = `date-${restDate}`): RestDay {
  return {
    id,
    userId: 'user-1',
    weekday: null,
    restDate,
    createdAt: '2026-03-01T08:00:00.000Z',
  };
}

describe('isRestDay', () => {
  it('bez deklaracji żaden dzień nie jest pusty', () => {
    expect(isRestDay(MONDAY, [])).toBe(false);
  });

  it('cykliczny dzień tygodnia wypada co tydzień', () => {
    const sundays = [weekdayRest(0)];

    expect(isRestDay(SUNDAY, sundays)).toBe(true);
    expect(isRestDay(SATURDAY, sundays)).toBe(false);
    expect(isRestDay(MONDAY, sundays)).toBe(false);
  });

  it('pojedyncza data dotyczy wyłącznie siebie', () => {
    const single = [dateRest(MONDAY)];

    expect(isRestDay(MONDAY, single)).toBe(true);
    expect(isRestDay('2026-03-23', single)).toBe(false);
  });

  it('obie deklaracje działają obok siebie', () => {
    const mixed = [weekdayRest(6), dateRest(MONDAY)];

    expect(isRestDay(SATURDAY, mixed)).toBe(true);
    expect(isRestDay(MONDAY, mixed)).toBe(true);
    expect(isRestDay(SUNDAY, mixed)).toBe(false);
  });
});

describe('restWeekdays', () => {
  it('zwraca same dni tygodnia, bez pojedynczych dat', () => {
    expect(restWeekdays([weekdayRest(0), dateRest(MONDAY), weekdayRest(6)])).toEqual([
      0, 6,
    ]);
  });
});

describe('findRestDate i findRestWeekday', () => {
  const days = [weekdayRest(1), dateRest(MONDAY)];

  it('cofnięcie sięga po deklarację dotyczącą tej daty, nie po cykliczną', () => {
    expect(findRestDate(MONDAY, days)?.id).toBe(`date-${MONDAY}`);
    expect(findRestWeekday(1, days)?.id).toBe('weekday-1');
  });

  it('brak deklaracji daje null', () => {
    expect(findRestDate(SUNDAY, days)).toBeNull();
    expect(findRestWeekday(3, days)).toBeNull();
  });
});
