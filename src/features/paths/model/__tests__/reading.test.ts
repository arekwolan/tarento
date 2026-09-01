import {
  buildPathContinue,
  findPathReading,
  parsePathRouteParams,
  parseReadingRouteParams,
  readingParagraphs,
  readingsForStage,
} from '@/features/paths/model/reading';
import {
  pathReadingRowSchema,
  type Path,
  type PathReading,
  type PathStage,
  type UserPath,
} from '@/features/paths/model/schemas';

function path(overrides: Partial<Path> = {}): Path {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'spokojna-droga',
    version: 1,
    title: 'Spokojna droga',
    hook: 'Jedna rzecz naraz.',
    honesty: null,
    completionNote: null,
    closingLetter: false,
    repeatCooldownDays: null,
    pathKind: 'tarento',
    sourceType: null,
    sourceTitle: null,
    sourceAuthor: null,
    sourceEdition: null,
    sourceIdentifier: null,
    curatedBy: null,
    reviewStatus: 'not_applicable',
    disclaimer: null,
    ownerId: null,
    originKind: 'curated',
    versionParentId: null,
    archivedAt: null,
    durationDays: 42,
    language: 'pl',
    isPublished: true,
    sortOrder: 1,
    createdAt: '2026-08-28T00:00:00Z',
    ...overrides,
  };
}

function stage(overrides: Partial<PathStage> = {}): PathStage {
  return {
    id: 'stage-1',
    pathId: '00000000-0000-4000-8000-000000000001',
    ordinal: 1,
    name: 'Początek',
    description: 'Pierwszy etap.',
    dailyMinutesP50: 10,
    minDays: 7,
    maxDays: 14,
    completionThreshold: 0.6,
    environmentSetup: null,
    environmentSetupNoteOrdinals: null,
    transitionCriterion: null,
    transitionNoteOrdinals: null,
    ...overrides,
  };
}

function userPath(overrides: Partial<UserPath> = {}): UserPath {
  return {
    id: 'user-path-1',
    userId: 'user-1',
    pathId: '00000000-0000-4000-8000-000000000001',
    state: 'active',
    currentStageId: 'stage-1',
    stageEnteredOn: '2026-08-20',
    startedOn: '2026-08-20',
    pausedAt: null,
    endedAt: null,
    endedReason: null,
    reentryUntil: null,
    fit: null,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

function reading(overrides: Partial<PathReading> = {}): PathReading {
  return {
    id: 'reading-1',
    stageId: 'stage-1',
    week: 1,
    title: 'Krótki tekst',
    author: null,
    sourceKind: 'original',
    attribution: null,
    sourceLocator: null,
    body: 'Treść.',
    framing: 'Rama.',
    quoteText: null,
    quoteSource: null,
    ...overrides,
  };
}

describe('buildPathContinue', () => {
  it('buduje krótkie wejście do dokładnej wersji aktywnej ścieżki', () => {
    const stages = [stage(), stage({ id: 'stage-2', ordinal: 2 })];

    expect(buildPathContinue(userPath(), path(), stages)).toEqual({
      pathId: '00000000-0000-4000-8000-000000000001',
      slug: 'spokojna-droga',
      title: 'Spokojna droga',
      stage: stages[0],
      totalStages: 2,
    });
  });

  it('nie pokazuje Kontynuuj dla ścieżki zakończonej ani wstrzymanej', () => {
    expect(buildPathContinue(userPath({ state: 'ended' }), path(), [stage()])).toBeNull();
    expect(
      buildPathContinue(userPath({ state: 'paused' }), path(), [stage()]),
    ).toBeNull();
  });

  it('nie łączy zapisu z inną wersją ścieżki', () => {
    expect(
      buildPathContinue(
        userPath(),
        path({ id: '00000000-0000-4000-8000-000000000002' }),
        [stage()],
      ),
    ).toBeNull();
  });
});

describe('czytania etapu', () => {
  it('filtruje bieżący etap i porządkuje materiały według tygodnia', () => {
    const result = readingsForStage(
      [
        reading({ id: 'third', week: 3 }),
        reading({ id: 'other', stageId: 'stage-2', week: 1 }),
        reading({ id: 'first', week: 1 }),
      ],
      'stage-1',
    );

    expect(result.map((entry) => entry.id)).toEqual(['first', 'third']);
    expect(findPathReading(result, 'third')?.week).toBe(3);
    expect(findPathReading(result, 'missing')).toBeNull();
  });

  it('zwraca pusty stan dla etapu bez materiałów', () => {
    expect(readingsForStage([reading({ stageId: 'stage-2' })], 'stage-1')).toEqual([]);
  });

  it('pointer nigdy nie przepuszcza body i nie tworzy fikcyjnej treści', () => {
    const pointer = pathReadingRowSchema.parse({
      id: 'pointer-1',
      stage_id: 'stage-1',
      week: 1,
      title: 'Rozdział 2, strony 10–14',
      author: 'Autor',
      source_kind: 'pointer',
      attribution: 'Wydanie 2024, rozdział 2, strony 10–14.',
      source_locator: 'Rozdział 2, strony 10–14',
      body: 'Tekst, którego klient nie może pokazać.',
      framing: 'Bezpieczna rama redakcyjna.',
      quote_text: null,
      quote_source: null,
    });

    expect(pointer.body).toBeNull();
    expect(pointer.sourceLocator).toBe('Rozdział 2, strony 10–14');
    expect(readingParagraphs(pointer.body)).toEqual([]);
    expect(readingParagraphs(pointer.framing)).toEqual(['Bezpieczna rama redakcyjna.']);
  });

  it.each(['public_domain', 'own_translation', 'citation', 'original'] as const)(
    'zachowuje dostępną treść dla source_kind %s',
    (sourceKind) => {
      const parsed = pathReadingRowSchema.parse({
        id: `reading-${sourceKind}`,
        stage_id: 'stage-1',
        week: 1,
        title: 'Materiał',
        author: null,
        source_kind: sourceKind,
        attribution: null,
        source_locator: null,
        body: 'Dostępna treść.',
        framing: 'Rama.',
        quote_text: null,
        quote_source: null,
      });

      expect(parsed.sourceKind).toBe(sourceKind);
      expect(parsed.body).toBe('Dostępna treść.');
    },
  );

  it('dzieli dłuższą treść na akapity, zachowując listę w jednym bloku', () => {
    expect(readingParagraphs('Pierwszy.\nDruga linia.\n\nDrugi akapit.')).toEqual([
      'Pierwszy.\nDruga linia.',
      'Drugi akapit.',
    ]);
  });
});

describe('parametry tras czytań', () => {
  it('waliduje parametry i przyjmuje pierwszy element z deep linku', () => {
    expect(
      parseReadingRouteParams({
        slug: ['spokojna-droga', 'nadmiar'],
        readingId: ['reading-1'],
        pathId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      slug: 'spokojna-droga',
      readingId: 'reading-1',
      pathId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('ignoruje niepoprawne id wersji zamiast wysyłać je do Supabase', () => {
    expect(parsePathRouteParams({ slug: 'spokojna-droga', pathId: 'nie-uuid' })).toEqual({
      slug: 'spokojna-droga',
      pathId: undefined,
    });
  });
});
