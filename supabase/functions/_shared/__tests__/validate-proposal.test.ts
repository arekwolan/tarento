import {
  budgetCeiling,
  DEFAULT_WINDOW_MINUTES,
  isDuplicateTitle,
  itemMinutes,
  MAX_ITEM_MINUTES,
  validateDownshift,
  validatePathFit,
  validateProposal,
  type FitContext,
  type ProposalContext,
  type ProposalItem,
} from '../validate-proposal.ts';

/**
 * Walidator jest jedyną rzeczą, która stoi między odpowiedzią modelu
 * a formularzem użytkownika. Każda z pięciu reguł ma tu test odrzucający
 * i test przepuszczający — reguła bez testu odrzucającego jest komentarzem,
 * a nie regułą.
 */

const CONTEXT: ProposalContext = {
  allocatedMinutes: 60,
  existingTitles: ['Czytanie', 'Ćwiczenia poranne'],
};

function item(overrides: Partial<ProposalItem> = {}): ProposalItem {
  return {
    title: 'Spacer',
    unit: 'minutes',
    start_value: 10,
    increment_value: 0,
    ...overrides,
  };
}

describe('budgetCeiling', () => {
  it('daje 60% okna, zaokrąglone w dół', () => {
    expect(budgetCeiling(60)).toBe(36);
    expect(budgetCeiling(35)).toBe(21);
    expect(budgetCeiling(0)).toBe(0);
  });
});

describe('itemMinutes', () => {
  it('liczy minuty wprost, sekundy przez 60, resztę ryczałtem', () => {
    expect(itemMinutes(item({ unit: 'minutes', start_value: 12 }))).toBe(12);
    expect(itemMinutes(item({ unit: 'seconds', start_value: 120 }))).toBe(2);
    expect(itemMinutes(item({ unit: 'reps', start_value: 20 }))).toBe(3);
  });
});

describe('reguła budżetu', () => {
  it('odrzuca sumę powyżej 60% okna', () => {
    const items = [item({ start_value: 20 }), item({ title: 'Joga', start_value: 20 })];

    expect(validateProposal(items, CONTEXT)).toEqual({
      rule: 'budget',
      message: expect.stringContaining('limit'),
    });
  });

  it('przepuszcza sumę równą suflowi', () => {
    const items = [item({ start_value: 20 }), item({ title: 'Joga', start_value: 16 })];

    expect(validateProposal(items, CONTEXT)).toBeNull();
  });

  it('bez kształtu dnia liczy sufit z okna domyślnego', () => {
    const context = { ...CONTEXT, allocatedMinutes: DEFAULT_WINDOW_MINUTES };

    expect(validateProposal([item({ start_value: 19 })], context)).toEqual({
      rule: 'budget',
      message: expect.any(String),
    });
    expect(validateProposal([item({ start_value: 10 })], context)).toBeNull();
  });
});

describe('reguła długości pozycji', () => {
  it('odrzuca pozycję dłuższą niż 45 minut', () => {
    // Okno szerokie, żeby o odrzuceniu zdecydowała długość pozycji, nie suma.
    const context: ProposalContext = { ...CONTEXT, allocatedMinutes: 600 };
    const items = [item({ unit: 'seconds', start_value: (MAX_ITEM_MINUTES + 1) * 60 })];

    expect(validateProposal(items, context)?.rule).toBe('item_length');
  });

  it('przepuszcza pozycję krótszą niż limit', () => {
    const context: ProposalContext = { ...CONTEXT, allocatedMinutes: 600 };
    const items = [item({ unit: 'seconds', start_value: 120 })];

    expect(validateProposal(items, context)).toBeNull();
  });
});

describe('reguła wartości startowej', () => {
  it.each([
    ['minutes' as const, 21],
    ['seconds' as const, 121],
    ['reps' as const, 21],
    ['pages' as const, 16],
    ['count' as const, 6],
    ['none' as const, 2],
  ])('odrzuca %s powyżej limitu', (unit, startValue) => {
    const context: ProposalContext = { ...CONTEXT, allocatedMinutes: 600 };

    expect(
      validateProposal([item({ unit, start_value: startValue })], context)?.rule,
    ).toBe('start_value');
  });

  it.each([
    ['minutes' as const, 20],
    ['seconds' as const, 120],
    ['reps' as const, 20],
    ['pages' as const, 15],
    ['count' as const, 5],
    ['none' as const, 1],
  ])('przepuszcza %s na granicy limitu', (unit, startValue) => {
    const context: ProposalContext = { ...CONTEXT, allocatedMinutes: 600 };

    expect(
      validateProposal([item({ unit, start_value: startValue })], context),
    ).toBeNull();
  });
});

describe('reguła duplikatu', () => {
  it('odrzuca tytuł powtarzający istniejący nawyk mimo diakrytyki i wielkości liter', () => {
    const items = [item({ title: 'cwiczenia poranne' })];

    expect(validateProposal(items, CONTEXT)?.rule).toBe('duplicate');
  });

  it('przepuszcza tytuł odległy od wszystkiego, co użytkownik prowadzi', () => {
    expect(validateProposal([item({ title: 'Spacer po pracy' })], CONTEXT)).toBeNull();
  });

  it('normalizuje przed porównaniem, ale nie skleja różnych nawyków', () => {
    expect(isDuplicateTitle('Czytanie!', ['czytanie'])).toBe(true);
    expect(isDuplicateTitle('Bieganie', ['Czytanie'])).toBe(false);
  });
});

describe('reguła przyrostu', () => {
  it('odrzuca przyrost powyżej jednej piątej startu', () => {
    const items = [item({ start_value: 10, increment_value: 2.5 })];

    expect(validateProposal(items, CONTEXT)?.rule).toBe('increment');
  });

  it('przepuszcza przyrost równy jednej piątej startu', () => {
    const items = [item({ start_value: 10, increment_value: 2 })];

    expect(validateProposal(items, CONTEXT)).toBeNull();
  });
});

describe('validateDownshift', () => {
  const original = {
    unit: 'minutes' as const,
    start_value: 30,
    increment_value: 2,
    days_per_week: 7,
  };

  it('odrzuca propozycję większą od oryginału', () => {
    expect(validateDownshift(original, { ...original, start_value: 40 })?.rule).toBe(
      'not_smaller',
    );
    expect(validateDownshift(original, { ...original, increment_value: 3 })?.rule).toBe(
      'not_smaller',
    );
  });

  it('odrzuca propozycję mniejszą na jednym wymiarze, ale większą na innym', () => {
    expect(
      validateDownshift(original, {
        ...original,
        start_value: 10,
        days_per_week: 8,
      })?.rule,
    ).toBe('not_smaller');
  });

  it('odrzuca propozycję identyczną i propozycję ze zmienioną jednostką', () => {
    expect(validateDownshift(original, { ...original })?.rule).toBe('not_smaller');
    expect(
      validateDownshift(original, { ...original, unit: 'seconds', start_value: 600 })
        ?.rule,
    ).toBe('not_smaller');
  });

  it('przepuszcza propozycję mniejszą na wartości albo na harmonogramie', () => {
    expect(validateDownshift(original, { ...original, start_value: 10 })).toBeNull();
    expect(validateDownshift(original, { ...original, days_per_week: 3 })).toBeNull();
  });
});

describe('validatePathFit', () => {
  const context: FitContext = {
    allocatedMinutes: 60,
    stages: [
      { id: 'stage-1', ordinal: 1, dailyMinutesP50: 30 },
      { id: 'stage-2', ordinal: 2, dailyMinutesP50: 40 },
    ],
    practices: [
      { id: 'a', stageId: 'stage-1', startValue: 10 },
      { id: 'b', stageId: 'stage-1', startValue: 20 },
      { id: 'c', stageId: 'stage-2', startValue: 15 },
      { id: 'd', stageId: 'stage-2', startValue: 15 },
    ],
  };

  const empty = { skip: [], adjust: [], note: '' };

  it('przepuszcza dopasowanie puste i dopasowanie w dół', () => {
    expect(validatePathFit(empty, context)).toBeNull();
    expect(
      validatePathFit(
        { ...empty, adjust: [{ practiceId: 'b', startValue: 5 }] },
        context,
      ),
    ).toBeNull();
  });

  it('odrzuca pominięcie więcej niż połowy etapu', () => {
    expect(validatePathFit({ ...empty, skip: ['a'] }, context)).toBeNull();
    expect(validatePathFit({ ...empty, skip: ['a', 'b'] }, context)?.rule).toBe(
      'fit_skip',
    );
  });

  it('odrzuca podniesienie wartości startowej i praktykę spoza ścieżki', () => {
    expect(
      validatePathFit(
        { ...empty, adjust: [{ practiceId: 'a', startValue: 11 }] },
        context,
      )?.rule,
    ).toBe('fit_adjust');
    expect(
      validatePathFit(
        { ...empty, adjust: [{ practiceId: 'zzz', startValue: 1 }] },
        context,
      )?.rule,
    ).toBe('fit_adjust');
  });

  it('odrzuca zdanie za długie i zdanie z wykrzyknikiem', () => {
    expect(validatePathFit({ ...empty, note: 'a'.repeat(161) }, context)?.rule).toBe(
      'fit_note',
    );
    expect(validatePathFit({ ...empty, note: 'Zaczynamy!' }, context)?.rule).toBe(
      'fit_note',
    );
  });

  it('odrzuca pierwszy etap powyżej sufitu i przepuszcza go po pominięciu praktyki', () => {
    // Okno 30 minut daje sufit 18; etap deklaruje 30 minut na dwie praktyki.
    const tight: FitContext = { ...context, allocatedMinutes: 30 };

    expect(validatePathFit(empty, tight)?.rule).toBe('fit_budget');
    expect(validatePathFit({ ...empty, skip: ['a'] }, tight)).toBeNull();
  });
});
