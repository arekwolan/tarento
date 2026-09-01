import {
  buildBookProtocolStartPreview,
  groupPathCatalog,
} from '@/features/paths/model/book-protocol';
import {
  pathReadingRowSchema,
  pathRowSchema,
  type Path,
  type PathPractice,
  type PathStage,
} from '@/features/paths/model/schemas';

function pathRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1000000-0000-4000-8000-000000000001',
    slug: 'test-protocol',
    version: 1,
    title: 'Protokół testowy',
    hook: 'Jedna rzecz naraz.',
    honesty: null,
    completion_note: null,
    closing_letter: false,
    repeat_cooldown_days: null,
    path_kind: 'book_protocol',
    source_type: 'book',
    source_title: 'Książka testowa',
    source_author: 'Autor testowy',
    source_edition: 'Wydanie 1',
    source_identifier: 'TEST-001',
    curated_by: 'Tarento',
    review_status: 'editorial_reviewed',
    disclaimer: 'Autorski fixture bez chronionej treści.',
    owner_id: null,
    origin_kind: 'curated',
    version_parent_id: null,
    archived_at: null,
    duration_days: 21,
    language: 'pl',
    is_published: true,
    sort_order: 2,
    created_at: '2026-08-28T00:00:00Z',
    ...overrides,
  };
}

function stage(ordinal: number): PathStage {
  return {
    id: `stage-${ordinal}`,
    pathId: 'path-1',
    ordinal,
    name: `Etap ${ordinal}`,
    description: 'Krótki etap.',
    dailyMinutesP50: ordinal + 1,
    minDays: 5,
    maxDays: 7,
    completionThreshold: 0.5,
    environmentSetup: null,
    environmentSetupNoteOrdinals: null,
    transitionCriterion: null,
    transitionNoteOrdinals: null,
  };
}

function practice(
  ordinal: number,
  retiresPracticeId: string | null,
  overrides: Partial<PathPractice> = {},
): PathPractice {
  return {
    id: `practice-${ordinal}`,
    stageId: `stage-${ordinal}`,
    title: `Praktyka ${ordinal}`,
    why: 'Po co.',
    how: 'Jak.',
    whenHard: null,
    unit: 'minutes',
    startValue: ordinal + 1,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: ordinal === 2 ? 'weekdays' : 'daily',
    scheduleDays: null,
    timeOfDay: 'evening',
    category: 'learning',
    isOptional: false,
    retiresPracticeId,
    sourceNoteOrdinals: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('provenance Protokołu książkowego', () => {
  it('mapuje komplet jawnych pól źródła i review', () => {
    const parsed = pathRowSchema.parse(pathRow());

    expect(parsed).toMatchObject({
      pathKind: 'book_protocol',
      sourceType: 'book',
      sourceTitle: 'Książka testowa',
      sourceAuthor: 'Autor testowy',
      sourceEdition: 'Wydanie 1',
      sourceIdentifier: 'TEST-001',
      curatedBy: 'Tarento',
      reviewStatus: 'editorial_reviewed',
      disclaimer: 'Autorski fixture bez chronionej treści.',
    });
  });

  it('odrzuca protokół bez autora źródła', () => {
    expect(() => pathRowSchema.parse(pathRow({ source_author: null }))).toThrow();
  });

  it('zachowuje zgodność zwykłej ścieżki z pustym provenance', () => {
    const parsed = pathRowSchema.parse(
      pathRow({
        path_kind: 'tarento',
        source_type: null,
        source_title: null,
        source_author: null,
        source_edition: null,
        source_identifier: null,
        curated_by: null,
        review_status: 'not_applicable',
        disclaimer: null,
      }),
    );

    expect(parsed.pathKind).toBe('tarento');
    expect(parsed.sourceTitle).toBeNull();
  });
});

describe('bezpieczne czytanie typu pointer', () => {
  it('trzyma locator i autorską ramę osobno, bez body i cytatu', () => {
    const reading = pathReadingRowSchema.parse({
      id: 'reading-1',
      stage_id: 'stage-1',
      week: 1,
      title: 'Książka testowa',
      author: 'Autor testowy',
      source_kind: 'pointer',
      attribution: 'Wydanie 1',
      source_locator: 'Rozdział 1 · sekcja A · s. 10–12',
      body: null,
      framing: 'Krótka, oryginalna wskazówka Tarento.',
      quote_text: null,
      quote_source: null,
    });

    expect(reading.body).toBeNull();
    expect(reading.sourceLocator).toContain('Rozdział 1');
    expect(reading.framing).toBe('Krótka, oryginalna wskazówka Tarento.');
  });

  it('wymaga locatora i pełnej pary cytat + źródło', () => {
    const base = {
      id: 'reading-1',
      stage_id: 'stage-1',
      week: 1,
      title: 'Książka testowa',
      author: 'Autor testowy',
      source_kind: 'pointer',
      attribution: null,
      source_locator: null,
      body: null,
      framing: 'Rama.',
      quote_text: 'Krótki cytat.',
      quote_source: null,
    };

    expect(() => pathReadingRowSchema.parse(base)).toThrow();
    expect(() =>
      pathReadingRowSchema.parse({
        ...base,
        source_locator: 'Rozdział 1',
        quote_text: 'x'.repeat(241),
        quote_source: 's. 10',
      }),
    ).toThrow();
  });
});

describe('preview startu i lifecycle protokołu', () => {
  const stages = [stage(1), stage(2), stage(3)];
  const practices = [
    practice(1, null),
    practice(2, 'practice-1'),
    practice(3, 'practice-2'),
  ];

  it('pokazuje po jednej praktyce i kontrolowane zastąpienia etapów', () => {
    const preview = buildBookProtocolStartPreview(stages, practices, [], false, 30);

    expect(preview.stages.map((entry) => entry.additions.length)).toEqual([1, 1, 1]);
    expect(
      preview.stages.map((entry) => entry.retirements.map((item) => item.id)),
    ).toEqual([[], ['practice-1'], ['practice-2']]);
    expect(preview).toMatchObject({
      startMinutes: 2,
      peakMinutes: 4,
      availableMinutes: 30,
      remainingAtPeak: 26,
    });
  });

  it('wariant lekki ma ten sam lifecycle i niższy wpływ na budżet', () => {
    const preview = buildBookProtocolStartPreview(stages, practices, [], true, 10);

    expect(preview.stages.map((entry) => entry.additions[0]?.startValue)).toEqual([
      1, 2, 2,
    ]);
    expect(preview.startMinutes).toBe(1);
    expect(preview.peakMinutes).toBe(2);
    expect(preview.remainingAtPeak).toBe(8);
  });
});

describe('wspólny katalog', () => {
  it('odróżnia grupy bez tworzenia drugiego pojęcia aktywnego zapisu', () => {
    const book = pathRowSchema.parse(pathRow());
    const tarento = pathRowSchema.parse(
      pathRow({
        id: 'a1000000-0000-4000-8000-000000000001',
        path_kind: 'tarento',
        source_type: null,
        source_title: null,
        source_author: null,
        source_edition: null,
        source_identifier: null,
        curated_by: null,
        review_status: 'not_applicable',
        disclaimer: null,
      }),
    );
    const entries: { path: Path; marker: string }[] = [
      { path: book, marker: 'book' },
      { path: tarento, marker: 'tarento' },
    ];

    expect(groupPathCatalog(entries)).toEqual({
      tarento: [{ path: tarento, marker: 'tarento' }],
      books: [{ path: book, marker: 'book' }],
    });
  });
});
