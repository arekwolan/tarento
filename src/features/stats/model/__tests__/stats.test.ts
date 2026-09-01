import {
  computeAdherence,
  computeDayStreaks,
  countCompleteDays,
  hasEnoughHistory,
  heatLevel,
  heatmapRange,
  toHeatmapWeeks,
  type DaySummary,
} from '@/features/stats/model/stats';
import { addDays } from '@/lib/date';

/** 2026-03-18 to środa. */
const WEDNESDAY = '2026-03-18';

function day(offsetFromToday: number, scheduled: number, completed: number): DaySummary {
  return { day: addDays(WEDNESDAY, offsetFromToday), scheduled, completed };
}

describe('heatLevel', () => {
  it('dzień bez zadań zostaje pusty', () => {
    expect(heatLevel(undefined)).toBeNull();
    expect(heatLevel({ day: WEDNESDAY, scheduled: 0, completed: 0 })).toBeNull();
  });

  it.each([
    [0, 4, 0],
    [1, 4, 1],
    [2, 4, 2],
    [3, 4, 3],
    [4, 4, 4],
    [0, 3, 0],
    [1, 3, 2],
    [2, 3, 3],
    [3, 3, 4],
    [5, 3, 4],
  ])('%s z %s daje poziom %s', (completed, scheduled, expected) => {
    expect(heatLevel({ day: WEDNESDAY, scheduled, completed })).toBe(expected);
  });
});

describe('heatmapRange', () => {
  it('zaczyna się w poniedziałek', () => {
    const { from, to } = heatmapRange(WEDNESDAY);
    // 12 tygodni wstecz od poniedziałku bieżącego tygodnia (2026-03-16).
    expect(from).toBe('2025-12-29');
    expect(to).toBe(WEDNESDAY);
  });
});

describe('toHeatmapWeeks', () => {
  it('zwraca 12 kolumn po 7 dni', () => {
    const grid = toHeatmapWeeks([], WEDNESDAY);
    expect(grid).toHaveLength(12);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it('ostatnia kolumna zaczyna się w poniedziałek tego tygodnia', () => {
    const grid = toHeatmapWeeks([], WEDNESDAY);
    expect(grid[11]?.[0]?.day).toBe('2026-03-16');
  });

  it('dni po dzisiaj są puste, nie zerowe', () => {
    const grid = toHeatmapWeeks([day(1, 2, 0)], WEDNESDAY);
    const tomorrow = grid[11]?.[3];
    expect(tomorrow?.day).toBe('2026-03-19');
    expect(tomorrow?.level).toBeNull();
  });

  it('przenosi poziomy z danych', () => {
    const grid = toHeatmapWeeks([day(0, 2, 2)], WEDNESDAY);
    expect(grid[11]?.[2]).toEqual({ day: WEDNESDAY, level: 4, isRest: false });
  });
});

describe('computeAdherence', () => {
  it('liczy tylko okno ostatnich N dni', () => {
    const days = [day(-10, 1, 0), day(-2, 2, 1), day(-1, 2, 2), day(0, 2, 1)];
    // Okno 7 dni: 6 zaplanowanych, 4 wykonane.
    expect(computeAdherence(days, 7, WEDNESDAY)).toBeCloseTo(4 / 6);
  });

  it('pomija przyszłość', () => {
    const days = [day(0, 2, 2), day(1, 5, 0)];
    expect(computeAdherence(days, 7, WEDNESDAY)).toBe(1);
  });

  it('brak zaplanowanych daje null, nie zero procent', () => {
    expect(computeAdherence([day(-1, 0, 0)], 7, WEDNESDAY)).toBeNull();
    expect(computeAdherence([], 30, WEDNESDAY)).toBeNull();
  });
});

describe('computeDayStreaks', () => {
  it('liczy dni z kompletem', () => {
    const days = [day(-3, 2, 2), day(-2, 2, 2), day(-1, 2, 2), day(0, 2, 2)];
    expect(computeDayStreaks(days, WEDNESDAY)).toEqual({ current: 4, longest: 4 });
  });

  it('niepełny dzień przerywa serię', () => {
    const days = [
      day(-4, 1, 1),
      day(-3, 1, 1),
      day(-2, 2, 1),
      day(-1, 1, 1),
      day(0, 1, 1),
    ];
    expect(computeDayStreaks(days, WEDNESDAY)).toEqual({ current: 2, longest: 2 });
  });

  it('dzień bez zadań nie przerywa i nie przedłuża', () => {
    const days = [day(-2, 1, 1), day(-1, 0, 0), day(0, 1, 1)];
    expect(computeDayStreaks(days, WEDNESDAY)).toEqual({ current: 2, longest: 2 });
  });

  it('dzisiaj bez kompletu nie zeruje serii', () => {
    const days = [day(-2, 1, 1), day(-1, 1, 1), day(0, 2, 0)];
    expect(computeDayStreaks(days, WEDNESDAY)).toEqual({ current: 2, longest: 2 });
  });

  it('pamięta najdłuższą serię, nawet gdy aktualna jest krótsza', () => {
    const days = [
      day(-6, 1, 1),
      day(-5, 1, 1),
      day(-4, 1, 1),
      day(-3, 1, 0),
      day(-2, 1, 1),
      day(-1, 1, 1),
    ];
    expect(computeDayStreaks(days, WEDNESDAY)).toEqual({ current: 2, longest: 3 });
  });

  it('pusta historia daje zera', () => {
    expect(computeDayStreaks([], WEDNESDAY)).toEqual({ current: 0, longest: 0 });
  });
});

describe('hasEnoughHistory', () => {
  it('wymaga choć jednego dnia z zadaniami', () => {
    expect(hasEnoughHistory([])).toBe(false);
    expect(hasEnoughHistory([day(-1, 0, 0)])).toBe(false);
    expect(hasEnoughHistory([day(-1, 1, 0)])).toBe(true);
  });
});

describe('computeDayStreaks a dzień pusty', () => {
  /** Pięć dni kompletnych, dzień bez wpisu, trzy dni kompletne. */
  const days = [
    day(-8, 2, 2),
    day(-7, 2, 2),
    day(-6, 2, 2),
    day(-5, 2, 2),
    day(-4, 2, 2),
    day(-3, 2, 0),
    day(-2, 2, 2),
    day(-1, 2, 2),
    day(0, 2, 2),
  ];

  const restDay = addDays(WEDNESDAY, -3);
  const isRest = (candidate: string) => candidate === restDay;

  it('dzień pusty łączy serię, zamiast ją przerywać', () => {
    // Bez deklaracji ten dzień zrywa serię i zostają trzy dni.
    expect(computeDayStreaks(days, WEDNESDAY).current).toBe(3);

    // Z deklaracją wypada z rachunku: 5 + 3, a nie 5 + 1 + 3.
    expect(computeDayStreaks(days, WEDNESDAY, isRest).current).toBe(8);
  });

  it('dzień pusty bez żadnego wpisu nie zeruje serii', () => {
    const shorter = [day(-2, 2, 2), day(-1, 3, 0), day(0, 2, 2)];
    const yesterday = addDays(WEDNESDAY, -1);

    expect(
      computeDayStreaks(shorter, WEDNESDAY, (candidate) => candidate === yesterday)
        .current,
    ).toBe(2);
  });

  it('mapa dni rysuje dzień pusty jak dzień bez danych', () => {
    const grid = toHeatmapWeeks(days, WEDNESDAY, 12, isRest);
    const cell = grid.flat().find((entry) => entry.day === restDay);

    expect(cell?.level).toBeNull();
    expect(cell?.isRest).toBe(true);
  });
});

describe('countCompleteDays', () => {
  const days: DaySummary[] = [
    { day: '2026-06-10', scheduled: 2, completed: 2 },
    { day: '2026-06-11', scheduled: 2, completed: 1 },
    { day: '2026-06-12', scheduled: 0, completed: 0 },
    { day: '2026-06-13', scheduled: 2, completed: 2 },
  ];

  it('liczy wyłącznie dni domknięte w całości', () => {
    expect(countCompleteDays(days, 30, '2026-06-13')).toBe(2);
  });

  it('nie liczy dni pustych ani dni spoza okna', () => {
    expect(countCompleteDays(days, 30, '2026-06-13', (day) => day === '2026-06-10')).toBe(
      1,
    );
    expect(countCompleteDays(days, 1, '2026-06-13')).toBe(1);
  });
});

describe('cofnięcie dnia', () => {
  /**
   * Po skasowaniu wpisów z jednego dnia seria liczy się od nowa — dzień
   * zostaje zaplanowany, ale pusty. To jest cała obietnica copy „Seria
   * przeliczy się na nowo".
   */
  const days: DaySummary[] = [
    { day: '2026-06-10', scheduled: 2, completed: 2 },
    { day: '2026-06-11', scheduled: 2, completed: 2 },
    { day: '2026-06-12', scheduled: 2, completed: 2 },
    { day: '2026-06-13', scheduled: 2, completed: 2 },
  ];

  it('seria przelicza się od dnia, z którego zdjęto wpisy', () => {
    expect(computeDayStreaks(days, '2026-06-13')).toEqual({ current: 4, longest: 4 });

    const cleared = days.map((summary) =>
      summary.day === '2026-06-11' ? { ...summary, completed: 0 } : summary,
    );

    expect(computeDayStreaks(cleared, '2026-06-13')).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('odznaczenie dzisiaj nie zrywa serii, bo doba jeszcze trwa', () => {
    const cleared = days.map((summary) =>
      summary.day === '2026-06-13' ? { ...summary, completed: 0 } : summary,
    );

    expect(computeDayStreaks(cleared, '2026-06-13').current).toBe(3);
  });
});
