import {
  addDays,
  compareIsoDates,
  computeTargetForDate,
  countScheduledDays,
  dayOfWeek,
  daysBetween,
  formatRelativeDay,
  getLogicalToday,
  isScheduledOn,
  type HabitProgression,
  type HabitSchedule,
} from '@/lib/date';

const WARSAW = 'Europe/Warsaw';
const AUCKLAND = 'Pacific/Auckland';
const LOS_ANGELES = 'America/Los_Angeles';

/** 2026-03-15 to niedziela, 2026-03-16 poniedziałek. */
const SUNDAY = '2026-03-15';
const MONDAY = '2026-03-16';

function schedule(overrides: Partial<HabitSchedule> = {}): HabitSchedule {
  return { scheduleType: 'daily', scheduleDays: null, startedOn: MONDAY, ...overrides };
}

function progression(overrides: Partial<HabitProgression> = {}): HabitProgression {
  return {
    ...schedule(),
    startValue: 10,
    incrementValue: 2,
    targetValue: null,
    progressionMode: 'completion',
    ...overrides,
  };
}

describe('arytmetyka na IsoDate', () => {
  it('numeruje dni tygodnia jak Postgres (0 = niedziela)', () => {
    expect(dayOfWeek(SUNDAY)).toBe(0);
    expect(dayOfWeek(MONDAY)).toBe(1);
    expect(dayOfWeek('2026-03-21')).toBe(6);
  });

  it('przesuwa daty przez granicę miesiąca i roku', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('zna rok przestępny', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });

  it('doba w arytmetyce ma zawsze 24 godziny, także w dniu zmiany czasu', () => {
    // 2026-03-29 ma w Warszawie 23 godziny, 2026-10-25 ma 25.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('porównuje daty', () => {
    expect(compareIsoDates('2026-03-15', '2026-03-16')).toBe(-1);
    expect(compareIsoDates('2026-03-16', '2026-03-16')).toBe(0);
    expect(compareIsoDates('2026-03-17', '2026-03-16')).toBe(1);
  });

  it('odrzuca daty, których nie ma w kalendarzu', () => {
    expect(() => addDays('2026-02-31', 0)).toThrow(RangeError);
    expect(() => addDays('2026-13-01', 0)).toThrow(RangeError);
    expect(() => addDays('15.03.2026', 0)).toThrow(RangeError);
  });
});

describe('getLogicalToday', () => {
  it('przed granicą doby zwraca dzień poprzedni', () => {
    // 2026-03-17 01:30 w Warszawie (UTC+1) = 2026-03-17T00:30Z
    const now = new Date('2026-03-17T00:30:00Z');
    expect(getLogicalToday(WARSAW, 4, now)).toBe('2026-03-16');
  });

  it('dokładnie o granicy zaczyna się nowy dzień', () => {
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-17T02:59:59Z'))).toBe(
      '2026-03-16',
    );
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-17T03:00:00Z'))).toBe(
      '2026-03-17',
    );
  });

  it('tuż przed północą to nadal ten sam dzień', () => {
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-17T22:59:00Z'))).toBe(
      '2026-03-17',
    );
  });

  it('dayStartHour = 0 to zwykła data kalendarzowa', () => {
    expect(getLogicalToday(WARSAW, 0, new Date('2026-03-17T00:30:00Z'))).toBe(
      '2026-03-17',
    );
  });

  it('odrzuca dayStartHour spoza zakresu', () => {
    const now = new Date('2026-03-17T00:30:00Z');
    expect(() => getLogicalToday(WARSAW, -1, now)).toThrow(RangeError);
    expect(() => getLogicalToday(WARSAW, 24, now)).toThrow(RangeError);
    expect(() => getLogicalToday(WARSAW, 4.5, now)).toThrow(RangeError);
  });
});

describe('getLogicalToday — zmiana czasu', () => {
  it('wiosenna zmiana: doba bez godziny 02:00 nie gubi dnia', () => {
    // W Warszawie 2026-03-29 zegar skacze z 02:00 na 03:00.
    // 00:30Z = 01:30 lokalnie, 01:30Z = 03:30 lokalnie — obie przed granicą 4:00.
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-29T00:30:00Z'))).toBe(
      '2026-03-28',
    );
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-29T01:30:00Z'))).toBe(
      '2026-03-28',
    );
    // 03:30Z = 05:30 lokalnie — już po granicy.
    expect(getLogicalToday(WARSAW, 4, new Date('2026-03-29T03:30:00Z'))).toBe(
      '2026-03-29',
    );
  });

  it('jesienna zmiana: powtórzona godzina 02:00 daje ten sam dzień logiczny', () => {
    // 2026-10-25 zegar cofa się z 03:00 na 02:00, więc 02:30 lokalnie występuje dwa razy.
    expect(getLogicalToday(WARSAW, 4, new Date('2026-10-25T00:30:00Z'))).toBe(
      '2026-10-24',
    );
    expect(getLogicalToday(WARSAW, 4, new Date('2026-10-25T01:30:00Z'))).toBe(
      '2026-10-24',
    );
    // Po cofnięciu zegara Warszawa jest na UTC+1: 02:30Z to dopiero 03:30 lokalnie,
    // więc granica 4:00 wypada o 03:00Z — o godzinę później niż dzień wcześniej.
    expect(getLogicalToday(WARSAW, 4, new Date('2026-10-25T02:59:00Z'))).toBe(
      '2026-10-24',
    );
    expect(getLogicalToday(WARSAW, 4, new Date('2026-10-25T03:00:00Z'))).toBe(
      '2026-10-25',
    );
  });

  it.each([
    ['wiosenna (doba 23-godzinna)', '2026-03-28T12:00:00Z', '2026-03-28'],
    ['jesienna (doba 25-godzinna)', '2026-10-24T12:00:00Z', '2026-10-24'],
  ])(
    'dzień logiczny przeskakuje dokładnie raz na dobę: zmiana %s',
    (_label, startIso, startDay) => {
      const start = new Date(startIso).getTime();
      const seen: string[] = [];

      // Doba zmiany czasu ma 23 albo 25 godzin, więc skanujemy 48 godzin
      // co 15 minut i liczymy, ile razy dzień logiczny się zmienił.
      for (let minutes = 0; minutes <= 48 * 60; minutes += 15) {
        const day = getLogicalToday(WARSAW, 4, new Date(start + minutes * 60_000));
        if (seen[seen.length - 1] !== day) seen.push(day);
      }

      expect(seen[0]).toBe(startDay);
      // Kolejne dni muszą iść po sobie bez dziur i bez powtórek.
      for (let index = 1; index < seen.length; index += 1) {
        expect(seen[index]).toBe(addDays(seen[index - 1] ?? '', 1));
      }
    },
  );
});

describe('getLogicalToday — podróż między strefami', () => {
  it('ten sam moment daje różne dni w różnych strefach', () => {
    const instant = new Date('2026-03-15T23:30:00Z');

    // Auckland (UTC+13) jest już w kolejnym dniu, Warszawa dopiero wchodzi
    // w noc, Los Angeles (UTC-7) ma jeszcze popołudnie.
    expect(getLogicalToday(AUCKLAND, 4, instant)).toBe('2026-03-16');
    expect(getLogicalToday(WARSAW, 4, instant)).toBe('2026-03-15');
    expect(getLogicalToday(LOS_ANGELES, 4, instant)).toBe('2026-03-15');
  });

  it('lot na wschód potrafi przesunąć dzień logiczny do przodu bez upływu doby', () => {
    const beforeTakeOff = new Date('2026-03-15T20:00:00Z');
    const afterLanding = new Date('2026-03-16T06:00:00Z');

    expect(getLogicalToday(WARSAW, 4, beforeTakeOff)).toBe('2026-03-15');
    // Dziesięć godzin lotu i zmiana strefy: w Auckland to już 2026-03-16.
    expect(getLogicalToday(AUCKLAND, 4, afterLanding)).toBe('2026-03-16');
  });

  it('lot na zachód potrafi cofnąć dzień logiczny — to zamierzone', () => {
    const instant = new Date('2026-03-16T05:00:00Z');

    // W Warszawie 06:00 dnia 16., w Los Angeles wciąż 22:00 dnia 15.
    expect(getLogicalToday(WARSAW, 4, instant)).toBe('2026-03-16');
    expect(getLogicalToday(LOS_ANGELES, 4, instant)).toBe('2026-03-15');
  });

  it('strefa z przesunięciem o pół godziny liczy się tak samo', () => {
    // Kolkata to UTC+5:30. 22:45Z = 04:15 następnego dnia lokalnie.
    expect(getLogicalToday('Asia/Kolkata', 4, new Date('2026-03-15T22:45:00Z'))).toBe(
      '2026-03-16',
    );
    // 22:15Z = 03:45 lokalnie — jeszcze przed granicą.
    expect(getLogicalToday('Asia/Kolkata', 4, new Date('2026-03-15T22:15:00Z'))).toBe(
      '2026-03-15',
    );
  });
});

describe('isScheduledOn', () => {
  it('nie liczy dni sprzed startu nawyku', () => {
    expect(isScheduledOn(schedule({ startedOn: MONDAY }), '2026-03-15')).toBe(false);
    expect(isScheduledOn(schedule({ startedOn: MONDAY }), MONDAY)).toBe(true);
  });

  it('daily wypada codziennie', () => {
    for (let offset = 0; offset < 7; offset += 1) {
      expect(isScheduledOn(schedule(), addDays(MONDAY, offset))).toBe(true);
    }
  });

  it('weekdays pomija sobotę i niedzielę', () => {
    const weekdays = schedule({ scheduleType: 'weekdays' });
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((n) => isScheduledOn(weekdays, addDays(MONDAY, n))),
    ).toEqual([true, true, true, true, true, false, false]);
  });

  it('custom bierze dni z listy (0 = niedziela)', () => {
    const custom = schedule({ scheduleType: 'custom', scheduleDays: [1, 3, 5] });
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((n) => isScheduledOn(custom, addDays(MONDAY, n))),
    ).toEqual([true, false, true, false, true, false, false]);
  });

  it('custom bez listy dni nie wypada nigdy', () => {
    expect(
      isScheduledOn(schedule({ scheduleType: 'custom', scheduleDays: null }), MONDAY),
    ).toBe(false);
    expect(
      isScheduledOn(schedule({ scheduleType: 'custom', scheduleDays: [] }), MONDAY),
    ).toBe(false);
  });
});

describe('countScheduledDays', () => {
  it('przedział pusty lub odwrócony daje zero', () => {
    expect(countScheduledDays(schedule(), MONDAY, MONDAY)).toBe(0);
    expect(countScheduledDays(schedule(), MONDAY, SUNDAY)).toBe(0);
  });

  it('daily liczy wszystkie dni', () => {
    expect(countScheduledDays(schedule(), MONDAY, addDays(MONDAY, 30))).toBe(30);
  });

  it('weekdays liczy tylko dni robocze', () => {
    const weekdays = schedule({ scheduleType: 'weekdays' });
    expect(countScheduledDays(weekdays, MONDAY, addDays(MONDAY, 4))).toBe(4);
    expect(countScheduledDays(weekdays, MONDAY, addDays(MONDAY, 7))).toBe(5);
    expect(countScheduledDays(weekdays, MONDAY, addDays(MONDAY, 28))).toBe(20);
  });

  it('wzór zgadza się z liczeniem dzień po dniu', () => {
    const variants: HabitSchedule[] = [
      schedule(),
      schedule({ scheduleType: 'weekdays' }),
      schedule({ scheduleType: 'custom', scheduleDays: [0, 6] }),
      schedule({ scheduleType: 'custom', scheduleDays: [2] }),
      schedule({ scheduleType: 'custom', scheduleDays: [1, 3, 5] }),
    ];

    for (const variant of variants) {
      for (let span = 0; span <= 40; span += 1) {
        const naive = Array.from({ length: span }, (_, offset) =>
          isScheduledOn(variant, addDays(variant.startedOn, offset)),
        ).filter(Boolean).length;

        expect(
          countScheduledDays(
            variant,
            variant.startedOn,
            addDays(variant.startedOn, span),
          ),
        ).toBe(naive);
      }
    }
  });
});

describe('computeTargetForDate', () => {
  it('tryb completion: pierwszy dzień to goły startValue', () => {
    expect(computeTargetForDate(progression(), MONDAY, 0)).toBe(10);
  });

  it('tryb completion: rośnie z każdym wykonaniem', () => {
    expect(computeTargetForDate(progression(), MONDAY, 5)).toBe(20);
  });

  it('tryb completion: nie zależy od daty', () => {
    const habit = progression();
    expect(computeTargetForDate(habit, MONDAY, 3)).toBe(
      computeTargetForDate(habit, addDays(MONDAY, 100), 3),
    );
  });

  it('tryb calendar: rośnie z dniami z harmonogramu, nie z wykonaniami', () => {
    const habit = progression({ progressionMode: 'calendar' });
    expect(computeTargetForDate(habit, MONDAY, 99)).toBe(10);
    expect(computeTargetForDate(habit, addDays(MONDAY, 5), 0)).toBe(20);
  });

  it('tryb calendar z weekdays pomija weekendy', () => {
    const habit = progression({ progressionMode: 'calendar', scheduleType: 'weekdays' });
    // Od poniedziałku do kolejnego poniedziałku wypada 5 dni roboczych.
    expect(computeTargetForDate(habit, addDays(MONDAY, 7), 0)).toBe(20);
  });

  it('targetValue jest sufitem', () => {
    const habit = progression({ targetValue: 16 });
    expect(computeTargetForDate(habit, MONDAY, 3)).toBe(16);
    expect(computeTargetForDate(habit, MONDAY, 1000)).toBe(16);
  });

  it('brak targetValue oznacza brak sufitu', () => {
    expect(computeTargetForDate(progression({ targetValue: null }), MONDAY, 1000)).toBe(
      2010,
    );
  });

  it('zerowy przyrost trzyma stały cel', () => {
    expect(computeTargetForDate(progression({ incrementValue: 0 }), MONDAY, 50)).toBe(10);
  });

  it('ujemny licznik wykonań nie cofa celu poniżej startu', () => {
    expect(computeTargetForDate(progression(), MONDAY, -5)).toBe(10);
  });

  it('data sprzed startu daje startValue', () => {
    const habit = progression({ progressionMode: 'calendar' });
    expect(computeTargetForDate(habit, SUNDAY, 0)).toBe(10);
  });
});

describe('formatRelativeDay', () => {
  it('rozpoznaje dziś i wczoraj', () => {
    expect(formatRelativeDay('2026-03-16', 'pl', '2026-03-16')).toBe('dziś');
    expect(formatRelativeDay('2026-03-15', 'pl', '2026-03-16')).toBe('wczoraj');
    expect(formatRelativeDay('2026-03-16', 'en', '2026-03-16')).toBe('today');
    expect(formatRelativeDay('2026-03-15', 'en', '2026-03-16')).toBe('yesterday');
  });

  it('starsze dni pokazuje jako skrót dnia i datę', () => {
    expect(formatRelativeDay('2026-03-02', 'pl', '2026-03-16')).toBe('pon, 2 mar');
    expect(formatRelativeDay('2026-03-02', 'en', '2026-03-16')).toBe('Mon, 2 Mar');
  });

  it('dni przyszłe też formatuje datą, nie „wczoraj"', () => {
    expect(formatRelativeDay('2026-03-17', 'pl', '2026-03-16')).toBe('wt, 17 mar');
  });
});
