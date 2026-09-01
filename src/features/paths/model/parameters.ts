import type { PathPractice, UserPath } from '@/features/paths/model/schemas';
import { addDays, compareIsoDates, type IsoDate } from '@/lib/date';

/**
 * Parametry praktyki: o ile ścieżka schodzi z liczbami i na jak długo.
 *
 * Dwa powody, żeby zejść niżej, i jeden współczynnik na oba: wariant lekki
 * (budżet nie mieści pełnej wersji) i tydzień wejściowy po powrocie z pauzy.
 * Jeśli zachodzą naraz, mnożą się — ścieżka wzięta lekko i wznowiona startuje
 * z 36% wartości z katalogu.
 *
 * Odpowiednik po stronie bazy: `public.path_practice_params`. Obie strony
 * muszą liczyć tak samo, bo klient pokazuje pozycje optymistycznie, zanim
 * serwer je zapisze.
 */

/** Jeden krok w dół. Ten sam dla wariantu lekkiego i tygodnia wejściowego. */
export const STEP_DOWN_FACTOR = 0.6;

/** Ile dni trwa tydzień wejściowy po powrocie. */
export const REENTRY_DAYS = 7;

export type PracticeScale = {
  /** Wariant lekki wybrany przy zapisie. */
  lite: boolean;
  /** Trwa tydzień wejściowy po powrocie z pauzy. */
  reentry: boolean;
};

/** Data, do której włącznie obowiązują obniżone parametry. */
export function reentryUntilDate(today: IsoDate): IsoDate {
  return addDays(today, REENTRY_DAYS);
}

/** Czy tydzień wejściowy jeszcze trwa. Dzień `reentryUntil` jeszcze się liczy. */
export function isInReentry(reentryUntil: IsoDate | null, today: IsoDate): boolean {
  return reentryUntil !== null && compareIsoDates(today, reentryUntil) <= 0;
}

/**
 * Czy parametry czekają na przywrócenie.
 *
 * Prawda dokładnie wtedy, gdy tydzień wejściowy minął, a znacznik jeszcze
 * stoi. Przywrócenie idzie bez komunikatu — nie było żadnej taryfy ulgowej,
 * więc nie ma czego kończyć.
 */
export function needsParameterRestore(
  userPath: Pick<UserPath, 'state' | 'reentryUntil'>,
  today: IsoDate,
): boolean {
  return (
    userPath.state === 'active' &&
    userPath.reentryUntil !== null &&
    !isInReentry(userPath.reentryUntil, today)
  );
}

/**
 * Praktyka po zejściu o zadaną liczbę kroków.
 *
 * Sufit (`targetValue`) zostaje nietknięty: zejście obniża wejście, a nie
 * odbiera to, dokąd się dojdzie.
 */
export function scaledPractice(
  practice: PathPractice,
  scale: PracticeScale,
): PathPractice {
  const steps = (scale.lite ? 1 : 0) + (scale.reentry ? 1 : 0);
  if (steps === 0) return practice;

  const factor = STEP_DOWN_FACTOR ** steps;

  return {
    ...practice,
    // Start nigdy nie schodzi poniżej jednego: praktyka o wartości zero to
    // brak praktyki. Przyrost zerowy zostaje zerowy.
    startValue: Math.max(Math.round(practice.startValue * factor), 1),
    incrementValue: Math.round(practice.incrementValue * factor),
  };
}
