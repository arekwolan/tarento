import {
  axisTimeLabel,
  blockRows,
  clampBlockEnd,
  clampBlockStart,
  clampDraftBlocks,
  dayAxis,
  defaultDayShape,
  draftWindow,
  nextBlockDraft,
  stepTime,
  weeklyRotation,
  windowMessage,
  type DayShapeDraft,
} from '@/features/day-budget/model/day-shape';
import { templateForDate } from '@/features/day-budget/model/windows';
import { addDays } from '@/lib/date';

/** 2026-03-16 to poniedziałek, 2026-03-21 to sobota. */
const MONDAY = '2026-03-16';
const SATURDAY = '2026-03-21';

function draft(overrides: Partial<DayShapeDraft> = {}): DayShapeDraft {
  return { ...defaultDayShape(), ...overrides };
}

describe('dayAxis', () => {
  it('zwykła doba idzie od pobudki do snu', () => {
    expect(dayAxis({ wakeTime: '06:30', sleepTime: '23:00' })).toEqual({
      start: 390,
      end: 1380,
    });
  });

  it('sen przed pobudką przenosi koniec osi za północ', () => {
    expect(dayAxis({ wakeTime: '14:00', sleepTime: '07:00' })).toEqual({
      start: 840,
      end: 1860,
    });
  });
});

describe('clampBlockStart / clampBlockEnd', () => {
  const axis = { start: 390, end: 1380 };
  const block = { id: 'block-1', start: 540, end: 1020 };

  it('trzyma pas w granicach osi', () => {
    expect(clampBlockStart(block, axis, 0)).toBe(390);
    expect(clampBlockEnd(block, axis, 2000)).toBe(1380);
  });

  it('nie pozwala zejść poniżej 30 minut', () => {
    expect(clampBlockStart(block, axis, 1015)).toBe(990);
    expect(clampBlockEnd(block, axis, 545)).toBe(570);
  });

  it('zaokrągla do skoku 15 minut', () => {
    expect(clampBlockStart(block, axis, 611)).toBe(615);
    expect(clampBlockEnd(block, axis, 1049)).toBe(1050);
  });
});

describe('stepTime', () => {
  it('przesuwa o skok w obie strony', () => {
    expect(stepTime('06:30', 1)).toBe('06:45');
    expect(stepTime('06:30', -1)).toBe('06:15');
  });

  it('zawija w obrębie doby', () => {
    expect(stepTime('23:45', 1)).toBe('00:00');
    expect(stepTime('00:00', -1)).toBe('23:45');
  });

  it('niepoprawny zapis zostaje bez zmian', () => {
    expect(stepTime('bez sensu', 1)).toBe('bez sensu');
  });
});

describe('blockRows', () => {
  it('pas w obrębie doby daje jeden wiersz', () => {
    expect(blockRows({ id: 'block-1', start: 540, end: 1020 })).toEqual([
      { startTime: '09:00', endTime: '17:00' },
    ]);
  });

  it('pas przez północ rozbija się na dwa wiersze', () => {
    // 22:00 → 06:00 następnego dnia.
    expect(blockRows({ id: 'block-1', start: 1320, end: 1800 })).toEqual([
      { startTime: '22:00', endTime: '24:00' },
      { startTime: '00:00', endTime: '06:00' },
    ]);
  });

  it('pas kończący się dokładnie o północy zostaje jednym wierszem', () => {
    expect(blockRows({ id: 'block-1', start: 1320, end: 1440 })).toEqual([
      { startTime: '22:00', endTime: '24:00' },
    ]);
  });

  it('pas zerowej długości nie daje wiersza', () => {
    expect(blockRows({ id: 'block-1', start: 540, end: 540 })).toEqual([]);
  });
});

describe('axisTimeLabel', () => {
  it('minuty za północą pokazuje jako godzinę następnej doby', () => {
    expect(axisTimeLabel(540)).toBe('09:00');
    expect(axisTimeLabel(1440)).toBe('00:00');
    expect(axisTimeLabel(1800)).toBe('06:00');
  });
});

describe('draftWindow', () => {
  it('domyślny kształt dnia daje 30 minut po pracy', () => {
    expect(draftWindow(draft())).toEqual({
      start: '17:00',
      end: '17:30',
      minutes: 30,
    });
  });

  it('gdy deklaracja się nie mieści, zwraca najdłuższe wolne okno', () => {
    const tight = draft({
      selfMinutes: 60,
      blocks: [{ id: 'block-1', start: 420, end: 1350 }],
    });

    // Zostaje 06:30–07:00 i 22:30–23:00, czyli 30 minut.
    expect(draftWindow(tight)?.minutes).toBe(30);
  });

  it('doba wypełniona po brzegi nie ma okna', () => {
    const full = draft({ blocks: [{ id: 'block-1', start: 390, end: 1380 }] });

    expect(draftWindow(full)).toBeNull();
  });
});

describe('nextBlockDraft', () => {
  it('dokłada godzinny pas za ostatnim', () => {
    expect(nextBlockDraft(draft(), 'block-2')).toEqual({
      id: 'block-2',
      start: 1035,
      end: 1095,
    });
  });

  it('zwraca null, gdy do snu nie zostaje godzina', () => {
    const late = draft({ blocks: [{ id: 'block-1', start: 540, end: 1350 }] });

    expect(nextBlockDraft(late, 'block-2')).toBeNull();
  });
});

describe('weeklyRotation', () => {
  it('od poniedziałku: pięć dni roboczych, potem weekend', () => {
    expect(weeklyRotation(MONDAY, 'workday', 'free')).toEqual([
      'workday',
      'workday',
      'workday',
      'workday',
      'workday',
      'free',
      'free',
    ]);
  });

  it('kotwicą może być dowolny dzień, nie tylko poniedziałek', () => {
    expect(weeklyRotation(SATURDAY, 'workday', 'free')).toEqual([
      'free',
      'free',
      'workday',
      'workday',
      'workday',
      'workday',
      'workday',
    ]);
  });

  it('templateForDate odczytuje z niej te same dni', () => {
    const rotation = {
      id: 'rotation-1',
      userId: 'user-1',
      anchorDate: SATURDAY,
      templateIds: weeklyRotation(SATURDAY, 'workday', 'free'),
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-03-01T08:00:00.000Z',
    };

    // Sobota i niedziela wolne, poniedziałek roboczy — także za trzy tygodnie.
    expect(templateForDate(rotation, SATURDAY)).toBe('free');
    expect(templateForDate(rotation, addDays(SATURDAY, 1))).toBe('free');
    expect(templateForDate(rotation, addDays(SATURDAY, 2))).toBe('workday');
    expect(templateForDate(rotation, addDays(SATURDAY, 21))).toBe('free');
    expect(templateForDate(rotation, addDays(SATURDAY, -1))).toBe('workday');
  });
});

describe('clampDraftBlocks', () => {
  it('przycina pas do nowej doby czuwania', () => {
    const shorter = clampDraftBlocks(draft({ wakeTime: '10:00', sleepTime: '16:00' }));

    // Pas 09:00-17:00 mieści się teraz tylko w 10:00-16:00.
    expect(shorter.blocks).toEqual([{ id: 'block-1', start: 600, end: 960 }]);
  });

  it('pas, który nie mieści już 30 minut, znika', () => {
    const squeezed = clampDraftBlocks(draft({ wakeTime: '22:45', sleepTime: '23:00' }));

    expect(squeezed.blocks).toEqual([]);
  });
});

describe('windowMessage', () => {
  it('gdy deklaracja się mieści, mówi o przydzielonym oknie', () => {
    const values = draft();

    expect(windowMessage(values, draftWindow(values))).toEqual({
      key: 'onboarding.dayShape.step3.window',
      minutes: 30,
    });
  });

  it('gdy się nie mieści, mówi o dniu roboczym i weekendzie', () => {
    const tight = draft({
      selfMinutes: 60,
      blocks: [{ id: 'block-1', start: 420, end: 1350 }],
    });

    expect(windowMessage(tight, draftWindow(tight))).toEqual({
      key: 'onboarding.dayShape.step3.windowTight',
      minutes: 30,
    });
  });

  it('gdy nie ma żadnego okna, nie podaje liczby', () => {
    const full = draft({ blocks: [{ id: 'block-1', start: 390, end: 1380 }] });

    expect(windowMessage(full, draftWindow(full))).toEqual({
      key: 'onboarding.dayShape.step3.windowNone',
      minutes: 0,
    });
  });
});
