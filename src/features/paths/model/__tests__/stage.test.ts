import type { PathPractice, PathStage } from '@/features/paths/model/schemas';
import {
  practiceToHabitInsert,
  practicesForStage,
  shouldAdvance,
} from '@/features/paths/model/stage';

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

function practice(overrides: Partial<PathPractice> = {}): PathPractice {
  return {
    id: 'practice-1',
    stageId: 'stage-1',
    title: 'Jedno miejsce',
    why: 'Jedna uprzątnięta powierzchnia domyka dzień.',
    how: 'Wybierz jedno miejsce i doprowadź je do zera.',
    whenHard: 'Nie masz pięciu minut? Uprzątnij pięć rzeczy.',
    unit: 'minutes',
    startValue: 5,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    timeOfDay: 'evening',
    category: 'focus',
    isOptional: false,
    sourceNoteOrdinals: null,
    retiresPracticeId: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('shouldAdvance', () => {
  it('nie przechodzi przed min_days, choćby wykonanie było pełne', () => {
    expect(shouldAdvance(stage(), 20, 1)).toBe('no');
  });

  it('przechodzi progiem, gdy min_days i próg są spełnione', () => {
    expect(shouldAdvance(stage(), 21, 0.6)).toBe('threshold');
  });

  it('przechodzi sufitem po max_days, nawet przy wykonaniu 0,1', () => {
    // Sedno kryterium: ścieżka nie może uwięzić użytkownika w etapie.
    expect(shouldAdvance(stage(), 41, 0.1)).toBe('ceiling');
    expect(shouldAdvance(stage(), 40, 0)).toBe('ceiling');
  });

  it('w dniu sufitu wygrywa próg, gdy oba warunki są spełnione', () => {
    // Copy przy 'ceiling' mówi „nie domknęło się w całości" — nieprawda,
    // gdy użytkownik dowiózł próg.
    expect(shouldAdvance(stage(), 40, 0.9)).toBe('threshold');
  });

  it('brak danych o wykonaniu liczy się jak zero, nie jak przejście', () => {
    expect(shouldAdvance(stage(), 25, Number.NaN)).toBe('no');
  });

  it('etap bez progu przechodzi po min_days', () => {
    expect(shouldAdvance(stage({ completionThreshold: 0 }), 21, 0)).toBe('threshold');
  });
});

describe('practicesForStage', () => {
  it('bierze wyłącznie praktyki tego etapu, w kolejności sort_order', () => {
    const result = practicesForStage(
      stage(),
      [
        practice({ id: 'b', sortOrder: 2 }),
        practice({ id: 'inny-etap', stageId: 'stage-2', sortOrder: 0 }),
        practice({ id: 'a', sortOrder: 1 }),
      ],
      [],
    );

    expect(result.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('pomija praktykę opcjonalną wskazaną na liście', () => {
    const result = practicesForStage(
      stage(),
      [
        practice({ id: 'zimna-woda', isOptional: true, sortOrder: 1 }),
        practice({ id: 'czytanie', sortOrder: 2 }),
      ],
      ['zimna-woda'],
    );

    expect(result.map((entry) => entry.id)).toEqual(['czytanie']);
  });

  it('pomija praktykę obowiązkową wskazaną przez dopasowanie', () => {
    const result = practicesForStage(
      stage(),
      [
        practice({ id: 'czytanie', isOptional: false, sortOrder: 1 }),
        practice({ id: 'porzadek', isOptional: false, sortOrder: 2 }),
        practice({ id: 'zapis', isOptional: false, sortOrder: 3 }),
      ],
      ['czytanie'],
    );

    expect(result.map((entry) => entry.id)).toEqual(['porzadek', 'zapis']);
  });

  it('powyżej połowy etapu zostawia wyłącznie pominięcia praktyk wyłączalnych', () => {
    const practices = [
      practice({ id: 'czytanie', isOptional: false, sortOrder: 1 }),
      practice({ id: 'porzadek', isOptional: false, sortOrder: 2 }),
      practice({ id: 'zimna-woda', isOptional: true, sortOrder: 3 }),
    ];

    const result = practicesForStage(stage(), practices, [
      'czytanie',
      'porzadek',
      'zimna-woda',
    ]);

    expect(result.map((entry) => entry.id)).toEqual(['czytanie', 'porzadek']);
  });
});

describe('practiceToHabitInsert', () => {
  it('przepisuje parametry praktyki i dokłada pochodzenie', () => {
    const insert = practiceToHabitInsert(
      practice({ startValue: 30, incrementValue: 10, targetValue: 90 }),
      'user-1',
      {
        id: 'path-1',
        pathKind: 'book_protocol',
        sourceTitle: 'Książka testowa',
        sourceAuthor: 'Autor testowy',
      },
      'stage-1',
      '2026-03-16',
    );

    expect(insert).toEqual({
      userId: 'user-1',
      title: 'Jedno miejsce',
      description: 'Wybierz jedno miejsce i doprowadź je do zera.',
      unit: 'minutes',
      category: 'focus',
      startValue: 30,
      incrementValue: 10,
      targetValue: 90,
      progressionMode: 'completion',
      scheduleType: 'daily',
      scheduleDays: null,
      timeOfDay: 'evening',
      sourceBook: 'Książka testowa',
      sourceAuthor: 'Autor testowy',
      sortOrder: 0,
      startedOn: '2026-03-16',
      sourcePathId: 'path-1',
      sourceStageId: 'stage-1',
    });
  });

  it('dni tygodnia przechodzą tylko przy harmonogramie custom', () => {
    const custom = practiceToHabitInsert(
      practice({ scheduleType: 'custom', scheduleDays: [1, 3, 5] }),
      'user-1',
      {
        id: 'path-1',
        pathKind: 'tarento',
        sourceTitle: null,
        sourceAuthor: null,
      },
      'stage-1',
      '2026-03-16',
    );
    const daily = practiceToHabitInsert(
      practice({ scheduleType: 'daily', scheduleDays: [1, 3, 5] }),
      'user-1',
      {
        id: 'path-1',
        pathKind: 'tarento',
        sourceTitle: null,
        sourceAuthor: null,
      },
      'stage-1',
      '2026-03-16',
    );

    expect(custom.scheduleDays).toEqual([1, 3, 5]);
    expect(daily.scheduleDays).toBeNull();
  });
});
