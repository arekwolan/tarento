import type {
  DayBlock,
  DayRotation,
  DayTemplate,
} from '@/features/day-budget/model/schemas';
import {
  allocatedWindow,
  budgetCeiling,
  freeWindows,
  remainingSelfMinutes,
  templateForDate,
} from '@/features/day-budget/model/windows';
import { addDays } from '@/lib/date';

/** 2026-03-16 to poniedziałek. */
const MONDAY = '2026-03-16';
const TIMESTAMP = '2026-03-01T08:00:00.000Z';

function template(overrides: Partial<DayTemplate> = {}): DayTemplate {
  return {
    id: 'template-1',
    userId: 'user-1',
    name: 'Dzień roboczy',
    kind: 'workday',
    wakeTime: '06:30',
    sleepTime: '23:00',
    selfMinutes: 30,
    sortOrder: 0,
    archivedAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function block(
  startTime: string,
  endTime: string,
  overrides: Partial<DayBlock> = {},
): DayBlock {
  return {
    id: `block-${startTime}-${endTime}`,
    templateId: 'template-1',
    userId: 'user-1',
    label: null,
    kind: 'work',
    startTime,
    endTime,
    archivedAt: null,
    ...overrides,
  };
}

function rotation(templateIds: string[], anchorDate = MONDAY): DayRotation {
  return {
    id: 'rotation-1',
    userId: 'user-1',
    anchorDate,
    templateIds,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

describe('templateForDate', () => {
  const week = ['pon', 'wt', 'sr', 'czw', 'pt', 'sob', 'nd'];

  it('rotacja 7-dniowa mapuje się na dni tygodnia', () => {
    const weekly = rotation(week);
    const found = week.map((_, offset) =>
      templateForDate(weekly, addDays(MONDAY, offset)),
    );

    expect(found).toEqual(week);
  });

  it('rotacja 7-dniowa powtarza się co tydzień, także wstecz', () => {
    const weekly = rotation(week);

    expect(templateForDate(weekly, addDays(MONDAY, 7))).toBe('pon');
    expect(templateForDate(weekly, addDays(MONDAY, 70))).toBe('pon');
    expect(templateForDate(weekly, addDays(MONDAY, -1))).toBe('nd');
    expect(templateForDate(weekly, addDays(MONDAY, -7))).toBe('pon');
  });

  it('rotacja D-D-N-N wskazuje właściwy szablon 10 dni po kotwicy', () => {
    const shifts = rotation(['dzien-1', 'dzien-2', 'noc-1', 'noc-2']);

    // 10 mod 4 = 2.
    expect(templateForDate(shifts, addDays(MONDAY, 10))).toBe('noc-1');
  });

  it('rotacja D-D-N-N wskazuje właściwy szablon 3 dni przed kotwicą', () => {
    const shifts = rotation(['dzien-1', 'dzien-2', 'noc-1', 'noc-2']);

    // -3 mod 4 = 1, a nie -3: JS-owe % oddałoby tu indeks ujemny.
    expect(templateForDate(shifts, addDays(MONDAY, -3))).toBe('dzien-2');
  });

  it('rotacja jednoelementowa daje ten sam szablon każdego dnia', () => {
    const single = rotation(['jedyny']);

    expect(templateForDate(single, MONDAY)).toBe('jedyny');
    expect(templateForDate(single, addDays(MONDAY, 365))).toBe('jedyny');
    expect(templateForDate(single, addDays(MONDAY, -365))).toBe('jedyny');
  });
});

describe('freeWindows', () => {
  it('doba bez bloków to jedno okno od pobudki do snu', () => {
    expect(freeWindows(template(), [])).toEqual([
      { start: '06:30', end: '23:00', minutes: 990 },
    ]);
  });

  it('bloki nakładające się scalają się w jedno', () => {
    const windows = freeWindows(template(), [
      block('09:00', '12:00'),
      block('11:00', '13:00'),
    ]);

    expect(windows).toEqual([
      { start: '06:30', end: '09:00', minutes: 150 },
      { start: '13:00', end: '23:00', minutes: 600 },
    ]);
  });

  it('bloki stykające się też są jednym pasem', () => {
    const windows = freeWindows(template(), [
      block('09:00', '12:00'),
      block('12:00', '13:00'),
    ]);

    expect(windows).toEqual([
      { start: '06:30', end: '09:00', minutes: 150 },
      { start: '13:00', end: '23:00', minutes: 600 },
    ]);
  });

  it('kolejność bloków na wejściu nie ma znaczenia', () => {
    const blocks = [block('09:00', '12:00'), block('14:00', '15:00')];

    expect(freeWindows(template(), [...blocks].reverse())).toEqual(
      freeWindows(template(), blocks),
    );
  });

  it('okno 8-minutowe wypada z wyniku', () => {
    const windows = freeWindows(template(), [
      block('09:00', '12:00'),
      block('12:08', '18:00'),
    ]);

    expect(windows).toEqual([
      { start: '06:30', end: '09:00', minutes: 150 },
      { start: '18:00', end: '23:00', minutes: 300 },
    ]);
  });

  it('okno równe 10 minut zostaje', () => {
    const windows = freeWindows(template(), [
      block('09:00', '12:00'),
      block('12:10', '18:00'),
    ]);

    expect(windows.map((window) => window.start)).toEqual(['06:30', '12:00', '18:00']);
  });

  it('blok wychodzący poza dobę czuwania nie tworzy ujemnego okna', () => {
    expect(freeWindows(template(), [block('05:00', '08:00')])).toEqual([
      { start: '08:00', end: '23:00', minutes: 900 },
    ]);
  });

  it('zarchiwizowany blok nie zajmuje już czasu', () => {
    const windows = freeWindows(template(), [
      block('09:00', '17:00', { archivedAt: TIMESTAMP }),
    ]);

    expect(windows).toEqual([{ start: '06:30', end: '23:00', minutes: 990 }]);
  });

  it('dyżur nocny liczy czuwanie przez północ', () => {
    const nightShift = template({
      kind: 'night_shift',
      wakeTime: '14:00',
      sleepTime: '07:00',
    });

    // Blok 22:00-06:00 jest w bazie dwoma wierszami: CHECK day_blocks_order
    // nie dopuszcza przekroczenia północy w jednym.
    const windows = freeWindows(nightShift, [
      block('22:00', '24:00'),
      block('00:00', '06:00'),
    ]);

    expect(windows).toEqual([
      { start: '14:00', end: '22:00', minutes: 480 },
      { start: '06:00', end: '07:00', minutes: 60 },
    ]);
  });

  it('okno domykające dobę kończy się o 24:00, nie o 00:00', () => {
    const nightShift = template({ wakeTime: '22:00', sleepTime: '06:00' });

    expect(freeWindows(nightShift, [])).toEqual([
      { start: '22:00', end: '24:00', minutes: 120 },
      { start: '00:00', end: '06:00', minutes: 360 },
    ]);
  });
});

describe('allocatedWindow', () => {
  it('dosuwa okno do początku najdłuższej dziury', () => {
    const window = allocatedWindow(template({ selfMinutes: 45 }), [
      block('09:00', '17:00'),
    ]);

    expect(window).toEqual({ start: '17:00', end: '17:45', minutes: 45 });
  });

  it('przy remisie wybiera okno wcześniejsze w dobie', () => {
    // 08:00-12:00 i 14:00-18:00 mają po 240 minut.
    const window = allocatedWindow(template({ wakeTime: '08:00', sleepTime: '18:00' }), [
      block('12:00', '14:00'),
    ]);

    expect(window).toEqual({ start: '08:00', end: '08:30', minutes: 30 });
  });

  it('gdy deklaracja się nie mieści, zwraca najdłuższe dostępne okno', () => {
    const window = allocatedWindow(template({ selfMinutes: 240 }), [
      block('09:00', '12:00'),
      block('12:30', '23:00'),
    ]);

    expect(window).toEqual({ start: '06:30', end: '09:00', minutes: 150 });
  });

  it('przy zerze wolnego czasu zwraca null', () => {
    expect(allocatedWindow(template(), [block('06:30', '23:00')])).toBeNull();
  });

  it('zwraca null, gdy zostaje tylko okruch krótszy niż 10 minut', () => {
    const window = allocatedWindow(template(), [
      block('06:30', '09:00'),
      block('09:08', '23:00'),
    ]);

    expect(window).toBeNull();
  });
});

describe('budgetCeiling', () => {
  it('reguła 60%: z 30 minut zostaje 18', () => {
    expect(budgetCeiling(template({ selfMinutes: 30 }))).toBe(18);
  });

  it.each([
    [0, 0],
    [15, 9],
    [25, 15],
    [45, 27],
    [60, 36],
  ])('z %s minut zostaje %s', (selfMinutes, expected) => {
    expect(budgetCeiling(template({ selfMinutes }))).toBe(expected);
  });
});

describe('remainingSelfMinutes', () => {
  const workday = [block('09:00', '17:00')];

  it('przed oknem zostaje całe okno', () => {
    expect(remainingSelfMinutes(template(), workday, 8 * 60)).toBe(30);
  });

  it('po sugerowanej porze okno nie przepada', () => {
    // 20:00 — wolny pas trwa do 23:00, więc deklaracja nadal się mieści.
    expect(remainingSelfMinutes(template(), workday, 20 * 60)).toBe(30);
  });

  it('pod koniec wolnego pasa zostaje tylko tyle, ile do niego zostało', () => {
    expect(remainingSelfMinutes(template(), workday, 22 * 60 + 45)).toBe(15);
  });

  it('po zamknięciu doby nie zostaje nic', () => {
    expect(remainingSelfMinutes(template(), workday, 23 * 60 + 30)).toBe(0);
  });

  it('doba bez wolnego okna daje zero o każdej porze', () => {
    const full = [block('06:30', '23:00')];

    expect(remainingSelfMinutes(template(), full, 8 * 60)).toBe(0);
  });
});
