import {
  checkPathFit,
  deterministicPathFit,
  hasFitChanges,
  optionalPracticeIds,
  pathMinutes,
} from '@/features/paths/model/fit';
import type { PathPractice, PathStage } from '@/features/paths/model/schemas';
import { practicesForStage } from '@/features/paths/model/stage';

function stage(overrides: Partial<PathStage> = {}): PathStage {
  return {
    id: 'stage-1',
    pathId: 'path-1',
    ordinal: 1,
    name: 'Porządek',
    description: 'Cztery rzeczy, każda krótka.',
    dailyMinutesP50: 22,
    minDays: 21,
    maxDays: 40,
    completionThreshold: 0.6,
    environmentSetup: null,
    environmentSetupNoteOrdinals: null,
    transitionCriterion: null,
    transitionNoteOrdinals: null,
    ...overrides,
  };
}

/** Trzy etapy „Drogi wojownika": 22 → 35 → 40 minut. */
const WARRIOR = [
  { dailyMinutesP50: 22 },
  { dailyMinutesP50: 35 },
  { dailyMinutesP50: 40 },
];

function practice(overrides: Partial<PathPractice> = {}): PathPractice {
  return {
    id: 'practice-1',
    stageId: 'stage-1',
    title: 'Zimna woda',
    why: 'po co',
    how: 'jak',
    whenHard: null,
    unit: 'seconds',
    startValue: 30,
    incrementValue: 10,
    targetValue: 90,
    progressionMode: 'calendar',
    scheduleType: 'daily',
    scheduleDays: null,
    timeOfDay: 'morning',
    category: null,
    isOptional: false,
    sourceNoteOrdinals: null,
    retiresPracticeId: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('checkPathFit', () => {
  it('mieści się, gdy szczyt wchodzi w sufit propozycji', () => {
    // Sufit z okna 90 minut to 54 — szczyt 40 wchodzi z zapasem.
    expect(checkPathFit(WARRIOR, 90)).toEqual({ verdict: 'fits', peakMinutes: 40 });
  });

  it('jest ciasno, gdy szczyt mieści się w oknie, ale nie w suficie', () => {
    // Okno 50: sufit to 30, więc 40 przekracza sufit, ale nie samo okno.
    expect(checkPathFit(WARRIOR, 50)).toEqual({ verdict: 'tight', peakMinutes: 40 });
  });

  it('proponuje wariant lekki do półtora okna', () => {
    expect(checkPathFit(WARRIOR, 30)).toEqual({ verdict: 'lite', peakMinutes: 40 });
    // Dokładnie półtora okna to jeszcze wariant lekki.
    expect(checkPathFit(WARRIOR, 40 / 1.5).verdict).toBe('lite');
  });

  it('odmawia powyżej półtora okna', () => {
    expect(checkPathFit(WARRIOR, 15)).toEqual({ verdict: 'blocked', peakMinutes: 40 });
  });

  it('bez kształtu dnia nie ma czego przycinać', () => {
    expect(checkPathFit(WARRIOR, Number.POSITIVE_INFINITY).verdict).toBe('fits');
  });

  it('rozstrzyga szczyt, a nie pierwszy etap', () => {
    // Pierwszy etap zmieściłby się w oknie 40; ścieżka jako całość — nie.
    expect(checkPathFit(WARRIOR, 40).peakMinutes).toBe(40);
    expect(checkPathFit(WARRIOR, 40).verdict).toBe('tight');
  });
});

describe('„Wyjście z chaosu" — najkrótsza ścieżka katalogu', () => {
  /** Dwa etapy: 10 i 15 minut dziennie. */
  const OUT_OF_CHAOS = [{ dailyMinutesP50: 10 }, { dailyMinutesP50: 15 }];

  it('okno 15 minut przyjmuje ścieżkę w pełnej wersji', () => {
    // 'tight', nie 'fits': sufit propozycji z okna 15 minut to 9, a samo
    // popołudniowe wyjście trwa 10. Werdykt zostawia przycisk „Zacznij"
    // i mówi wprost, że ścieżka zajmie prawie całe okno.
    expect(checkPathFit(OUT_OF_CHAOS, 15)).toEqual({
      verdict: 'tight',
      peakMinutes: 15,
    });
  });

  it('od okna 25 minut mieści się w suficie propozycji', () => {
    expect(checkPathFit(OUT_OF_CHAOS, 25).verdict).toBe('fits');
  });

  it('w oknie kilkunastominutowym zostaje wariant lekki', () => {
    expect(checkPathFit(OUT_OF_CHAOS, 12).verdict).toBe('lite');
  });

  it('poniżej dziesięciu minut nie ma tu miejsca nawet dla niej', () => {
    expect(checkPathFit(OUT_OF_CHAOS, 9).verdict).toBe('blocked');
  });
});

describe('„Droga wojownika w czasach pokoju" — ścieżka flagowa', () => {
  /** Trzy etapy: 22, 28 i 35 minut dziennie. */
  const WARRIOR_PATH = [
    { dailyMinutesP50: 22 },
    { dailyMinutesP50: 28 },
    { dailyMinutesP50: 35 },
  ];

  it('okno godzinne mieści ją w suficie propozycji', () => {
    // Sufit z okna 60 minut to 36 — szczyt 35 wchodzi.
    expect(checkPathFit(WARRIOR_PATH, 60)).toEqual({
      verdict: 'fits',
      peakMinutes: 35,
    });
  });

  it('w oknie półgodzinnym zostaje wariant lekki', () => {
    expect(checkPathFit(WARRIOR_PATH, 30)).toEqual({
      verdict: 'lite',
      peakMinutes: 35,
    });
  });

  it('pierwszy etap nie jest tym, co rozstrzyga', () => {
    // 22 minuty etapu pierwszego zmieściłyby się w oknie 40; ścieżka jako
    // całość — nie, i to ona jest przedmiotem decyzji.
    expect(checkPathFit(WARRIOR_PATH, 40).verdict).toBe('tight');
  });
});

describe('pathMinutes', () => {
  it('oddaje start, minimum i szczyt', () => {
    expect(pathMinutes(WARRIOR)).toEqual({ start: 22, min: 22, max: 40 });
  });

  it('start bierze z pierwszego etapu, nie z minimum', () => {
    expect(pathMinutes([{ dailyMinutesP50: 30 }, { dailyMinutesP50: 10 }])).toEqual({
      start: 30,
      min: 10,
      max: 30,
    });
  });

  it('ścieżka bez etapów nie potrzebuje nic', () => {
    expect(pathMinutes([])).toEqual({ start: 0, min: 0, max: 0 });
  });
});

describe('optionalPracticeIds', () => {
  it('wskazuje praktyki, które wariant lekki pomija', () => {
    const ids = optionalPracticeIds([
      practice({ id: 'obowiazkowa' }),
      practice({ id: 'wylaczalna', isOptional: true }),
    ]);

    expect(ids).toEqual(['wylaczalna']);
  });
});

describe('deterministicPathFit', () => {
  /**
   * Ścieżka ma działać w całości bez ani jednego wywołania modelu. Ten wariant
   * jest tym, co powstaje, gdy modelu nie ma — i musi być pełnoprawnym `fit`,
   * a nie zaślepką.
   */
  it('przy werdykcie lite prowadzi wariant lekki, przy pozostałych pełny', () => {
    expect(deterministicPathFit('lite')).toEqual({
      lite: true,
      skip: [],
      adjust: [],
      note: '',
    });

    for (const verdict of ['fits', 'tight', 'blocked'] as const) {
      expect(deterministicPathFit(verdict).lite).toBe(false);
    }
  });

  it('nie pomija ani nie zmienia niczego, więc nie ma czego przeglądać', () => {
    for (const verdict of ['fits', 'tight', 'lite', 'blocked'] as const) {
      expect(hasFitChanges(deterministicPathFit(verdict))).toBe(false);
    }
  });

  it('zapis bez dopasowania zakłada komplet praktyk etapu', () => {
    const stageOne = stage();
    const practices = [
      practice({ id: 'a', sortOrder: 1 }),
      practice({ id: 'b', sortOrder: 2 }),
    ];
    const fit = deterministicPathFit('fits');

    expect(
      practicesForStage(stageOne, practices, fit.skip).map((entry) => entry.id),
    ).toEqual(['a', 'b']);
  });
});

describe('hasFitChanges', () => {
  it('widzi każdą z trzech rzeczy, które są warte przeglądu', () => {
    const empty = { lite: false, skip: [], adjust: [], note: '' };

    expect(hasFitChanges(empty)).toBe(false);
    expect(hasFitChanges({ ...empty, skip: ['a'] })).toBe(true);
    expect(
      hasFitChanges({
        ...empty,
        adjust: [{ practiceId: 'a', startValue: 5, timeOfDay: 'evening' }],
      }),
    ).toBe(true);
    expect(hasFitChanges({ ...empty, note: 'Zaczynam mniejszym krokiem.' })).toBe(true);
  });
});
