import { z } from 'zod';

import type { Habit } from '@/features/habits/model/habit';
import type { IsoDate } from '@/lib/date';

/**
 * Ścieżka i wszystko, co do niej należy, w postaci używanej przez aplikację
 * (camelCase).
 *
 * Podział jest ten sam co w bazie: `Path`, `PathStage`, `PathPractice`
 * i `PathReading` to treść — wspólna, wersjonowana, tylko do odczytu.
 * `UserPath` i `UserPathPractice` to zapis konkretnego użytkownika.
 */

export type PathSourceKind =
  'public_domain' | 'own_translation' | 'citation' | 'pointer' | 'original';

export type PathKind = 'tarento' | 'book_protocol';
export type PathOriginKind = 'curated' | 'private';
export type PathSourceType = 'book';
export type PathReviewStatus =
  'not_applicable' | 'draft' | 'editorial_reviewed' | 'legal_reviewed';

export type UserPathState = 'active' | 'paused' | 'ended';
export type UserPathEndedReason = 'completed' | 'abandoned' | 'replaced';

export type Path = {
  id: string;
  slug: string;
  /** Wersja treści. Zapisany użytkownik jest przypięty do jednej. */
  version: number;
  title: string;
  /** Jedno zdanie na karcie katalogu. */
  hook: string;
  /** Akapit o uczciwości wobec źródeł. `null`, gdy ścieżka nie ma źródeł. */
  honesty: string | null;
  /** Jedno zdanie na zamknięcie ścieżki. Nie gratuluje i nie proponuje kolejnej. */
  completionNote: string | null;
  /** Czy zamknięcie prosi o list do siebie za rok. */
  closingLetter: boolean;
  /** Ile dni po zakończeniu ścieżki nie da się jej powtórzyć. `null` = bez karencji. */
  repeatCooldownDays: number | null;
  /** Wspólny silnik, ale dwa jawne rodzaje pozycji katalogu. */
  pathKind: PathKind;
  /** Provenance protokołu. Wszystkie pola są `null` dla zwykłej ścieżki. */
  sourceType: PathSourceType | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceEdition: string | null;
  sourceIdentifier: string | null;
  curatedBy: string | null;
  reviewStatus: PathReviewStatus;
  disclaimer: string | null;
  /** Prywatny właściciel; `null` dla katalogu redakcyjnego. */
  ownerId: string | null;
  originKind: PathOriginKind;
  versionParentId: string | null;
  archivedAt: string | null;
  durationDays: number;
  language: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
};

export type PathStage = {
  id: string;
  pathId: string;
  /** Numer etapu w ścieżce, liczony od 1. */
  ordinal: number;
  name: string;
  description: string;
  /** Deklarowane zapotrzebowanie etapu na dobę — wejście do bramki budżetowej. */
  dailyMinutesP50: number;
  minDays: number;
  /** Sufit: po tylu dniach etap przechodzi mimo niespełnionego progu. */
  maxDays: number;
  /** Udział wykonanych dni z ostatnich 14, od 0 do 1. */
  completionThreshold: number;
  /** Jednorazowe przygotowanie, nie nowy nawyk. */
  environmentSetup: string | null;
  environmentSetupNoteOrdinals: number[] | null;
  transitionCriterion: string | null;
  transitionNoteOrdinals: number[] | null;
};

/**
 * Praktyka etapu: pełne odbicie parametrów nawyku.
 *
 * Wszystko, co przyjmuje `habits`, przyjmuje też praktyka — dzięki temu zapis
 * na ścieżkę jest przepisaniem wiersza, a nie tłumaczeniem jednego modelu na
 * drugi (patrz `practiceToHabitInsert`).
 */
export type PathPractice = {
  id: string;
  stageId: string;
  title: string;
  /** Jedno zdanie: po co. */
  why: string;
  /** Jedno zdanie: jak. */
  how: string;
  /** Jedno zdanie: co zrobić, gdy nie idzie. */
  whenHard: string | null;
  unit: Habit['unit'];
  startValue: number;
  incrementValue: number;
  targetValue: number | null;
  progressionMode: Habit['progressionMode'];
  scheduleType: Habit['scheduleType'];
  scheduleDays: number[] | null;
  timeOfDay: Habit['timeOfDay'];
  category: Habit['category'];
  /** Praktyka wyłączalna przy zapisie. Obowiązkowej nie da się pominąć. */
  isOptional: boolean;
  /** Praktyka, która schodzi z listy, gdy ta wchodzi. */
  retiresPracticeId: string | null;
  sourceNoteOrdinals: number[] | null;
  sortOrder: number;
};

export type PathReading = {
  id: string;
  stageId: string;
  /** Tydzień ścieżki, liczony od 1. */
  week: number;
  title: string;
  author: string | null;
  sourceKind: PathSourceKind;
  attribution: string | null;
  /** Rozdział, sekcja albo strony; obowiązkowe dla pointera. */
  sourceLocator: string | null;
  /**
   * Treść źródła albo `null`. Przy `sourceKind: 'pointer'` zawsze `null` —
   * pilnuje tego CHECK `path_readings_pointer_has_no_body` w bazie.
   */
  body: string | null;
  /** Własna rama, ~100 słów. Zawsze obecna; przy wskazaniu jedyna treść. */
  framing: string;
  /** Opcjonalny cytat, oddzielony od autorskiej ramy Tarento. */
  quoteText: string | null;
  quoteSource: string | null;
};

/**
 * Dopasowanie ścieżki do kontekstu użytkownika.
 *
 * Dokument JSON w kolumnie `fit`, więc klucze zostają w camelCase — to nie są
 * kolumny. Każde pole ma wartość domyślną, bo zapis bez dopasowania (i zapis
 * sprzed dopasowania) musi dawać poprawny obiekt.
 */
export type PathFit = {
  /** Wariant lekki: niższe parametry startowe, praktyki opcjonalne pominięte. */
  lite: boolean;
  /** Identyfikatory praktyk pominiętych przy zapisie. */
  skip: string[];
  adjust: PathFitAdjustment[];
  /** Jedno zdanie, pokazywane raz przy zapisie. */
  note: string;
};

export type PathFitAdjustment = {
  practiceId: string;
  startValue: number;
  timeOfDay: Habit['timeOfDay'];
};

export type UserPath = {
  id: string;
  userId: string;
  /** Wskazuje konkretną WERSJĘ ścieżki, nie slug. */
  pathId: string;
  state: UserPathState;
  currentStageId: string | null;
  stageEnteredOn: IsoDate;
  startedOn: IsoDate;
  pausedAt: string | null;
  endedAt: string | null;
  endedReason: UserPathEndedReason | null;
  /** Koniec tygodnia wejściowego po powrocie z pauzy. */
  reentryUntil: IsoDate | null;
  fit: PathFit | null;
  createdAt: string;
  updatedAt: string;
};

/** Most między definicją praktyki a wierszem w `habits`. */
export type UserPathPractice = {
  id: string;
  userPathId: string;
  practiceId: string;
  habitId: string;
  userId: string;
  activatedOn: IsoDate;
  /** Dzień, w którym ścieżka zdjęła praktykę z listy. */
  retiredOn: IsoDate | null;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

const habitUnit = z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']);
const progressionMode = z.enum(['completion', 'calendar']);
const scheduleType = z.enum(['daily', 'weekdays', 'custom']);
const timeOfDay = z.enum(['morning', 'afternoon', 'evening']);
const habitCategory = z.enum([
  'mindfulness',
  'health',
  'focus',
  'learning',
  'relationships',
]);
const sourceKind = z.enum([
  'public_domain',
  'own_translation',
  'citation',
  'pointer',
  'original',
]);
const pathKind = z.enum(['tarento', 'book_protocol']);
const pathOriginKind = z.enum(['curated', 'private']);
const pathSourceType = z.enum(['book']);
const pathReviewStatus = z.enum([
  'not_applicable',
  'draft',
  'editorial_reviewed',
  'legal_reviewed',
]);
const userPathState = z.enum(['active', 'paused', 'ended']);
const endedReason = z.enum(['completed', 'abandoned', 'replaced']);

/**
 * Wiersz z Postgresa → Path.
 *
 * Walidujemy zodem, bo to dane z zewnątrz (CLAUDE.md, sekcja TypeScript).
 * Kolumny tekstowe mają w bazie CHECK-i, ale generator typów widzi w nich
 * zwykły `string` — bez tego zawężenia trzeba by rzutować.
 */
export const pathRowSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    version: z.number().int(),
    title: z.string(),
    hook: z.string(),
    honesty: z.string().nullable(),
    completion_note: z.string().nullable(),
    closing_letter: z.boolean(),
    repeat_cooldown_days: z.number().int().nullable(),
    path_kind: pathKind,
    source_type: pathSourceType.nullable(),
    source_title: z.string().nullable(),
    source_author: z.string().nullable(),
    source_edition: z.string().nullable(),
    source_identifier: z.string().nullable(),
    curated_by: z.string().nullable(),
    review_status: pathReviewStatus,
    disclaimer: z.string().nullable(),
    owner_id: z.string().nullable(),
    origin_kind: pathOriginKind,
    version_parent_id: z.string().nullable(),
    archived_at: z.string().nullable(),
    duration_days: z.number().int(),
    language: z.string(),
    is_published: z.boolean(),
    sort_order: z.number(),
    created_at: z.string(),
  })
  .superRefine((row, context) => {
    if (row.path_kind !== 'book_protocol') return;

    const required = [
      ['source_type', row.source_type],
      ['source_title', row.source_title],
      ['source_author', row.source_author],
      ['curated_by', row.curated_by],
      ['disclaimer', row.disclaimer],
    ] as const;

    for (const [field, value] of required) {
      if (value === null || value.trim().length === 0) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Protokół książkowy wymaga kompletnego provenance',
        });
      }
    }
  })
  .transform((row): Path => ({
    id: row.id,
    slug: row.slug,
    version: row.version,
    title: row.title,
    hook: row.hook,
    honesty: row.honesty,
    completionNote: row.completion_note,
    closingLetter: row.closing_letter,
    repeatCooldownDays: row.repeat_cooldown_days,
    pathKind: row.path_kind,
    sourceType: row.source_type,
    sourceTitle: row.source_title,
    sourceAuthor: row.source_author,
    sourceEdition: row.source_edition,
    sourceIdentifier: row.source_identifier,
    curatedBy: row.curated_by,
    reviewStatus: row.review_status,
    disclaimer: row.disclaimer,
    ownerId: row.owner_id,
    originKind: row.origin_kind,
    versionParentId: row.version_parent_id,
    archivedAt: row.archived_at,
    durationDays: row.duration_days,
    language: row.language,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));

export const pathStageRowSchema = z
  .object({
    id: z.string(),
    path_id: z.string(),
    ordinal: z.number().int(),
    name: z.string(),
    description: z.string(),
    daily_minutes_p50: z.number(),
    min_days: z.number().int(),
    max_days: z.number().int(),
    completion_threshold: z.number().min(0).max(1),
    environment_setup: z.string().nullable(),
    environment_setup_note_ordinals: z.array(z.number().int()).nullable(),
    transition_criterion: z.string().nullable(),
    transition_note_ordinals: z.array(z.number().int()).nullable(),
  })
  .transform((row): PathStage => ({
    id: row.id,
    pathId: row.path_id,
    ordinal: row.ordinal,
    name: row.name,
    description: row.description,
    dailyMinutesP50: row.daily_minutes_p50,
    minDays: row.min_days,
    maxDays: row.max_days,
    completionThreshold: row.completion_threshold,
    environmentSetup: row.environment_setup,
    environmentSetupNoteOrdinals: row.environment_setup_note_ordinals,
    transitionCriterion: row.transition_criterion,
    transitionNoteOrdinals: row.transition_note_ordinals,
  }));

export const pathPracticeRowSchema = z
  .object({
    id: z.string(),
    stage_id: z.string(),
    title: z.string(),
    why: z.string(),
    how: z.string(),
    when_hard: z.string().nullable(),
    unit: habitUnit,
    start_value: z.number(),
    increment_value: z.number(),
    target_value: z.number().nullable(),
    progression_mode: progressionMode,
    schedule_type: scheduleType,
    schedule_days: z.array(z.number().int()).nullable(),
    time_of_day: timeOfDay.nullable(),
    category: habitCategory.nullable(),
    is_optional: z.boolean(),
    retires_practice_id: z.string().nullable(),
    source_note_ordinals: z.array(z.number().int()).nullable(),
    sort_order: z.number(),
  })
  .transform((row): PathPractice => ({
    id: row.id,
    stageId: row.stage_id,
    title: row.title,
    why: row.why,
    how: row.how,
    whenHard: row.when_hard,
    unit: row.unit,
    startValue: row.start_value,
    incrementValue: row.increment_value,
    targetValue: row.target_value,
    progressionMode: row.progression_mode,
    scheduleType: row.schedule_type,
    scheduleDays: row.schedule_days,
    timeOfDay: row.time_of_day,
    category: row.category,
    isOptional: row.is_optional,
    retiresPracticeId: row.retires_practice_id,
    sourceNoteOrdinals: row.source_note_ordinals,
    sortOrder: row.sort_order,
  }));

export const pathReadingRowSchema = z
  .object({
    id: z.string(),
    stage_id: z.string(),
    week: z.number().int(),
    title: z.string(),
    author: z.string().nullable(),
    source_kind: sourceKind,
    attribution: z.string().nullable(),
    source_locator: z.string().nullable(),
    body: z.string().nullable(),
    framing: z.string(),
    quote_text: z.string().max(240).nullable(),
    quote_source: z.string().nullable(),
  })
  .superRefine((row, context) => {
    if (
      row.source_kind === 'pointer' &&
      (row.source_locator === null || row.source_locator.trim().length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['source_locator'],
        message: 'Pointer wymaga rozdziału, sekcji albo strony',
      });
    }

    if ((row.quote_text === null) !== (row.quote_source === null)) {
      context.addIssue({
        code: 'custom',
        path: ['quote_text'],
        message: 'Cytat i jego źródło muszą występować razem',
      });
    }
  })
  .transform((row): PathReading => ({
    id: row.id,
    stageId: row.stage_id,
    week: row.week,
    title: row.title,
    author: row.author,
    sourceKind: row.source_kind,
    attribution: row.attribution,
    sourceLocator: row.source_locator,
    // Odbicie CHECK-a z bazy po stronie klienta: przy wskazaniu do cudzej
    // książki nie ma czego renderować poza własną ramą, a wiersz z treścią
    // sprzed constraintu nie może się prześliznąć do widoku.
    body: row.source_kind === 'pointer' ? null : row.body,
    framing: row.framing,
    quoteText: row.quote_text,
    quoteSource: row.quote_source,
  }));

/**
 * Zawartość kolumny `fit`.
 *
 * Pisze ją funkcja dopasowania, nie schemat bazy, więc każde pole ma wartość
 * domyślną, a całość — fallback na `null`. Dopasowanie jest podpowiedzią:
 * nieznany kształt ma zniknąć, a nie wywrócić zapis użytkownika na ścieżkę.
 */
export const pathFitSchema = z
  .object({
    lite: z.boolean().default(false),
    skip: z.array(z.string()).default([]),
    adjust: z
      .array(
        z.object({
          practiceId: z.string(),
          startValue: z.number(),
          timeOfDay: timeOfDay.nullable().default(null),
        }),
      )
      .default([]),
    note: z.string().default(''),
  })
  .nullable()
  .catch(null);

export const userPathRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    path_id: z.string(),
    state: userPathState,
    current_stage_id: z.string().nullable(),
    stage_entered_on: isoDate,
    started_on: isoDate,
    paused_at: z.string().nullable(),
    ended_at: z.string().nullable(),
    ended_reason: endedReason.nullable(),
    reentry_until: isoDate.nullable(),
    fit: pathFitSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): UserPath => ({
    id: row.id,
    userId: row.user_id,
    pathId: row.path_id,
    state: row.state,
    currentStageId: row.current_stage_id,
    stageEnteredOn: row.stage_entered_on,
    startedOn: row.started_on,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    endedReason: row.ended_reason,
    reentryUntil: row.reentry_until,
    fit: row.fit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export const userPathPracticeRowSchema = z
  .object({
    id: z.string(),
    user_path_id: z.string(),
    practice_id: z.string(),
    habit_id: z.string(),
    user_id: z.string(),
    activated_on: isoDate,
    retired_on: isoDate.nullable(),
  })
  .transform((row): UserPathPractice => ({
    id: row.id,
    userPathId: row.user_path_id,
    practiceId: row.practice_id,
    habitId: row.habit_id,
    userId: row.user_id,
    activatedOn: row.activated_on,
    retiredOn: row.retired_on,
  }));

/** Pochodzenie nawyku: z której ścieżki i z którego etapu. */
export type PathOrigin = {
  pathTitle: string;
  stageOrdinal: number;
};

/**
 * Wiersz etapu z osadzoną ścieżką.
 *
 * PostgREST oddaje relację wiele-do-jednego jako obiekt, nie tablicę — stąd
 * `paths` bez `array()`.
 */
export const pathOriginRowSchema = z
  .object({
    ordinal: z.number().int(),
    paths: z.object({ title: z.string() }),
  })
  .transform((row): PathOrigin => ({
    pathTitle: row.paths.title,
    stageOrdinal: row.ordinal,
  }));

/** Co zmieniło przejście etapu. */
export type StageAdvanceResult = {
  /** `null`, gdy etap był ostatni — zakończenie ścieżki ma własny przepływ. */
  nextStageId: string | null;
  /** Nawyki zdjęte z listy przez ten etap, pod toast z akcją „Cofnij". */
  retiredHabitIds: string[];
  retiredTitles: string[];
};

export const stageAdvanceRowSchema = z
  .object({
    next_stage_id: z.string().nullable(),
    retired_habit_ids: z.array(z.string()).nullable(),
    retired_titles: z.array(z.string()).nullable(),
  })
  .transform((row): StageAdvanceResult => ({
    nextStageId: row.next_stage_id,
    retiredHabitIds: row.retired_habit_ids ?? [],
    retiredTitles: row.retired_titles ?? [],
  }));

/**
 * Wiersz zakończonego zapisu z osadzonym slugiem ścieżki.
 *
 * PostgREST oddaje relację wiele-do-jednego jako obiekt, nie tablicę.
 */
export const endedPathRowSchema = z
  .object({
    id: z.string(),
    path_id: z.string(),
    ended_at: z.string(),
    paths: z.object({ slug: z.string(), title: z.string() }),
  })
  .transform((row) => ({
    id: row.id,
    pathId: row.path_id,
    slug: row.paths.slug,
    title: row.paths.title,
    endedAt: row.ended_at,
  }));
