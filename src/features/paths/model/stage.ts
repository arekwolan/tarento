import type { Habit } from '@/features/habits/model/habit';
import type { Path, PathPractice, PathStage } from '@/features/paths/model/schemas';
import type { IsoDate } from '@/lib/date';

/**
 * Maszyna etapów: czyste funkcje, bez sieci i bez zegara.
 *
 * Wszystko, co decyduje o przejściu etapu i o tym, co ląduje na liście
 * użytkownika, da się tu przetestować na liczbach. Datę „dzisiaj" i liczbę dni
 * w etapie podaje wołający — w tym pliku nie ma `new Date()`
 * (CLAUDE.md, reguła krytyczna 2).
 */

/**
 * Werdykt przejścia etapu:
 *   * `no`        — zostajemy,
 *   * `threshold` — próg spełniony, przechodzimy normalnie,
 *   * `ceiling`   — minął sufit dni, przechodzimy mimo progu.
 *
 * Rozróżnienie niesie copy: przy `ceiling` komunikat jest łagodniejszy
 * („poprzedni etap nie domknął się w całości — to nic nie zmienia"), a nie
 * informacją o niezaliczeniu.
 */
export type StageAdvance = 'no' | 'threshold' | 'ceiling';

/** Minimum potrzebne, żeby rozstrzygnąć przejście — pełny etap też pasuje. */
export type StageCriteria = Pick<
  PathStage,
  'minDays' | 'maxDays' | 'completionThreshold'
>;

/**
 * Nawyk gotowy do zapisu, złożony z praktyki ścieżki.
 *
 * Kształt bierzemy z `Habit`, żeby nie rozjechał się z tabelą przy pierwszej
 * zmianie schematu. Brakuje tylko tego, co nadaje baza (id, znaczniki czasu)
 * i co należy do użytkownika, a nie do ścieżki (ikona, kolor, godzina
 * przypomnienia).
 */
export type HabitInsert = Pick<
  Habit,
  | 'userId'
  | 'title'
  | 'description'
  | 'unit'
  | 'category'
  | 'startValue'
  | 'incrementValue'
  | 'targetValue'
  | 'progressionMode'
  | 'scheduleType'
  | 'scheduleDays'
  | 'timeOfDay'
  | 'sourceBook'
  | 'sourceAuthor'
  | 'sortOrder'
  | 'startedOn'
> & {
  sourcePathId: string;
  sourceStageId: string;
};

/**
 * Czy etap ma przejść dalej.
 *
 * Kryterium jest koniunkcją z sufitem: `daysInStage >= minDays` **oraz**
 * `completionRatio14d >= completionThreshold`, a niezależnie od tego po
 * `maxDays` etap przechodzi zawsze. Sam próg potrafiłby zatrzymać kogoś
 * w pierwszym etapie na stałe — a ścieżka nie ma prawa nikogo uwięzić.
 *
 * Kolejność sprawdzeń nie jest przypadkowa: gdy w dniu sufitu próg też jest
 * spełniony, wygrywa `threshold`, bo użytkownik faktycznie postawił na swoim
 * i nie ma po co mówić mu, że coś się nie domknęło.
 *
 * @param daysInStage pełne dni od `stage_entered_on` do dziś
 * @param completionRatio14d udział wykonanych dni z ostatnich 14, od 0 do 1;
 *   wartość spoza zakresu (także brak danych) liczy się jak 0
 */
export function shouldAdvance(
  stage: StageCriteria,
  daysInStage: number,
  completionRatio14d: number,
): StageAdvance {
  const ratio = Number.isFinite(completionRatio14d) ? Math.max(0, completionRatio14d) : 0;

  if (daysInStage >= stage.minDays && ratio >= stage.completionThreshold) {
    return 'threshold';
  }

  if (daysInStage >= stage.maxDays) return 'ceiling';

  return 'no';
}

/**
 * Praktyki, które faktycznie trafią na listę po wejściu w etap.
 *
 * `skipIds` obejmuje pominięcia z dwóch źródeł naraz: praktyki wyłączalne
 * odznaczone przez użytkownika i praktyki wskazane przez dopasowanie, bo
 * użytkownik już to robi. Granicą nie jest już podział na obowiązkowe
 * i wyłączalne, tylko sufit: ścieżka, z której zniknęła więcej niż połowa
 * etapu, przestaje być tą ścieżką i lista pominięć wraca wtedy do samych
 * praktyk wyłączalnych. Tę samą regułę egzekwuje baza
 * (public.capped_skip_ids), więc optymistyczna lista nie rozjeżdża się
 * z tym, co naprawdę powstanie.
 */
export function practicesForStage(
  stage: PathStage,
  practices: readonly PathPractice[],
  skipIds: readonly string[],
): PathPractice[] {
  const ofStage = practices
    .filter((practice) => practice.stageId === stage.id)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const requested = new Set(skipIds);
  const skipped = ofStage.filter((practice) => requested.has(practice.id));

  // Sufit pominięć: ścieżka, z której zniknęła więcej niż połowa etapu,
  // przestaje być tą ścieżką. Powyżej sufitu zostają wyłącznie praktyki
  // wyłączalne. Mirror public.capped_skip_ids z migracji path_fit.
  const effective =
    skipped.length * 2 > ofStage.length
      ? new Set(
          skipped
            .filter((practice) => practice.isOptional)
            .map((practice) => practice.id),
        )
      : requested;

  return ofStage.filter((practice) => !effective.has(practice.id));
}

/**
 * Praktyka → wiersz nawyku.
 *
 * Sedno całego modułu: ścieżka nie prowadzi własnej ewidencji, tylko dokłada
 * zwykłe nawyki. Wszystkie parametry przechodzą jeden do jednego, a `why`
 * zostaje w katalogu — na liście „Dziś" potrzebne jest `how`, czyli co
 * konkretnie zrobić.
 *
 * @param startedOn dzień startu; podawaj wynik getLogicalToday(), nie datę
 *   urządzenia (CLAUDE.md, reguła krytyczna 2)
 */
export function practiceToHabitInsert(
  practice: PathPractice,
  userId: string,
  path: Pick<Path, 'id' | 'pathKind' | 'sourceTitle' | 'sourceAuthor'>,
  stageId: string,
  startedOn: IsoDate,
): HabitInsert {
  const isBookProtocol = path.pathKind === 'book_protocol';

  return {
    userId,
    title: practice.title,
    description: practice.how,
    unit: practice.unit,
    category: practice.category,
    startValue: practice.startValue,
    incrementValue: practice.incrementValue,
    targetValue: practice.targetValue,
    progressionMode: practice.progressionMode,
    scheduleType: practice.scheduleType,
    scheduleDays: practice.scheduleType === 'custom' ? practice.scheduleDays : null,
    timeOfDay: practice.timeOfDay,
    sourceBook: isBookProtocol ? path.sourceTitle : null,
    sourceAuthor: isBookProtocol ? path.sourceAuthor : null,
    sortOrder: practice.sortOrder,
    startedOn,
    sourcePathId: path.id,
    sourceStageId: stageId,
  };
}
