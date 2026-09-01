import { addDays, compareIsoDates, daysBetween, type IsoDate } from '@/lib/date';

/**
 * Cichy tydzień: aplikacja milknie, kiedy jest ciężko.
 *
 * To jest dokładna odwrotność standardowej mechaniki retencji i celowa
 * decyzja produktowa. Po siedmiu słabych dniach przypomnienia gasną na
 * tydzień, wracają same i w obie strony nie ma o tym ani jednego komunikatu.
 * Produkt, który nie chce być źródłem poczucia winy, nie może w takim
 * momencie robić się głośniejszy.
 *
 * Czysta arytmetyka: bez zegara, bez sieci, bez systemu powiadomień.
 */

/** Długość okna, z którego czytamy sygnał, i długość samego wyciszenia. */
export const QUIET_WEEK_DAYS = 7;

/** Poniżej tego wykonania tydzień uznajemy za słaby. */
export const QUIET_THRESHOLD = 0.3;

/**
 * Ile dni z harmonogramu musi być w oknie.
 *
 * Tydzień, w którym użytkownik świadomie zaplanował cztery dni puste, nie
 * jest słabym tygodniem — jest tygodniem odpoczynku i nie ma go za co wyciszać.
 */
export const QUIET_MIN_SCHEDULED_DAYS = 5;

/** Odstęp między wyciszeniami. */
export const QUIET_COOLDOWN_DAYS = 21;

/** Dzień w postaci, w jakiej oddaje go agregat dzienny. */
export type QuietDay = { day: IsoDate; scheduled: number; completed: number };

export type IsRestDay = (day: IsoDate) => boolean;

const NEVER_REST: IsRestDay = () => false;

export type QuietWeekContext = {
  /** Początek ostatniego wyciszenia. `null`, gdy jeszcze żadnego nie było. */
  lastQuietWeekOn: IsoDate | null;
  isRestDay?: IsRestDay;
};

/**
 * Czy wejść w cichy tydzień.
 *
 * Okno to siedem dni przed dzisiaj: doba, która trwa, nie jest jeszcze
 * słabym dniem. Dni puste i dni bez harmonogramu wypadają z rachunku — i to
 * one decydują, czy w oknie w ogóle jest o czym mówić.
 */
export function shouldEnterQuietWeek(
  days: readonly QuietDay[],
  today: IsoDate,
  context: QuietWeekContext,
): boolean {
  if (
    context.lastQuietWeekOn !== null &&
    daysBetween(context.lastQuietWeekOn, today) < QUIET_COOLDOWN_DAYS
  ) {
    return false;
  }

  const isRestDay = context.isRestDay ?? NEVER_REST;
  const from = addDays(today, -QUIET_WEEK_DAYS);

  const window = days.filter(
    (entry) =>
      entry.scheduled > 0 &&
      !isRestDay(entry.day) &&
      compareIsoDates(entry.day, from) >= 0 &&
      compareIsoDates(entry.day, today) < 0,
  );

  if (window.length < QUIET_MIN_SCHEDULED_DAYS) return false;

  const scheduled = window.reduce((sum, entry) => sum + entry.scheduled, 0);
  const completed = window.reduce((sum, entry) => sum + entry.completed, 0);

  return scheduled > 0 && completed / scheduled < QUIET_THRESHOLD;
}

/** Wyciszenie w postaci, w jakiej trzyma je baza. */
export type QuietWeek = {
  id: string;
  startedOn: IsoDate;
  endsOn: IsoDate;
  endedEarlyAt: string | null;
};

/**
 * Czy wyciszenie obowiązuje dzisiaj.
 *
 * Kończy się samo: nie ma zadania w tle ani zapisu, który by je zamykał —
 * wystarczy data. Dzięki temu powrót przypomnień nie wymaga, żeby użytkownik
 * w ogóle otworzył aplikację siódmego dnia.
 */
export function isQuietWeekActive(week: QuietWeek | null, today: IsoDate): boolean {
  if (week === null || week.endedEarlyAt !== null) return false;

  return (
    compareIsoDates(today, week.startedOn) >= 0 &&
    compareIsoDates(today, week.endsOn) <= 0
  );
}

/** Data, do której trwa wyciszenie. `null`, gdy żadne nie obowiązuje. */
export function quietWeekEndsOn(week: QuietWeek | null, today: IsoDate): IsoDate | null {
  return isQuietWeekActive(week, today) && week !== null ? week.endsOn : null;
}

/** Wyciszenie zaczynające się dzisiaj. Siedem dni, licząc z dniem wejścia. */
export function nextQuietWeek(today: IsoDate): { startedOn: IsoDate; endsOn: IsoDate } {
  return { startedOn: today, endsOn: addDays(today, QUIET_WEEK_DAYS - 1) };
}
