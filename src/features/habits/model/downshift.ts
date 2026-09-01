import type { Habit, HabitLog } from '@/features/habits/model/habit';
import {
  addDays,
  compareIsoDates,
  daysBetween,
  isScheduledOn,
  type IsoDate,
} from '@/lib/date';

/**
 * Kiedy zaproponować mniejszą wersję nawyku.
 *
 * Nie jest to ostrzeżenie ani ocena: niskie wykonanie znaczy, że prośba była
 * za duża, a właściwą odpowiedzią jest mniejsza prośba. Dlatego warunki są
 * ostre — propozycja ma paść raz, w momencie, w którym coś znaczy, a nie
 * przy każdym słabszym tygodniu.
 *
 * Czysta arytmetyka: bez zegara, bez sieci, bez znajomości feature'u dni
 * pustych ani ścieżek. Wszystko, czego nie da się policzyć z nawyku i logów,
 * wchodzi jako kontekst.
 */

/** Ile ostatnich zaplanowanych dni bierzemy pod uwagę. */
export const DOWNSHIFT_WINDOW_DAYS = 14;

/** Poniżej tego wykonania prośba jest za duża. */
export const DOWNSHIFT_THRESHOLD = 0.4;

/** Ile dni nawyk musi istnieć, zanim w ogóle da się coś o nim powiedzieć. */
export const DOWNSHIFT_MIN_AGE_DAYS = 14;

/** Odstęp między propozycjami dla tego samego nawyku. */
export const DOWNSHIFT_COOLDOWN_DAYS = 30;

/**
 * Ile dni wstecz wolno przeszukać na każdy dzień próbki.
 *
 * Harmonogram raz w tygodniu potrzebuje siedmiu dni kalendarza na jedno
 * wystąpienie; dziesięć daje zapas. Sufit istnieje, bo harmonogram, który
 * przez dzień pusty nie wypada nigdy, zapętliłby skanowanie aż do daty startu.
 */
const SCAN_DAYS_PER_SAMPLE = 10;

/**
 * Predykat dnia pustego.
 *
 * Model nawyków nie zna feature'u dni pustych — dostaje samo pytanie, na które
 * ktoś inny umie odpowiedzieć. Ten sam wzorzec co w module statystyk.
 */
export type IsRestDay = (day: IsoDate) => boolean;

const NEVER_REST: IsRestDay = () => false;

export type ScheduledCompletion = {
  /** Ile dni z harmonogramu weszło do próbki. */
  scheduled: number;
  /** Ile z nich ma wpis 'done' albo 'partial'. */
  completed: number;
  ratio: number;
};

/**
 * Wykonanie w ostatnich `sampleSize` dniach z harmonogramu.
 *
 * `null`, gdy próbki nie da się zebrać — o nawyku, który wypadł pięć razy,
 * nie ma czego powiedzieć.
 *
 * Dzisiaj nie wchodzi do próbki: doba jeszcze trwa, a policzenie jej jako
 * niewykonanej byłoby karą za to, że użytkownik otworzył ekran przed
 * wieczorem.
 *
 * Dzień pusty wypada z rachunku tak samo jak dzień spoza harmonogramu.
 * Dzień świadomie pominięty (`skipped`) zostaje w mianowniku i nie wchodzi
 * do licznika — dla serii jest przezroczysty, ale tutaj jest właśnie tym
 * sygnałem, którego szukamy: prośba była na tyle duża, że użytkownik ją odsunął.
 */
export function scheduledCompletion(
  habit: Habit,
  logs: readonly HabitLog[],
  today: IsoDate,
  sampleSize: number = DOWNSHIFT_WINDOW_DAYS,
  isRestDay: IsRestDay = NEVER_REST,
): ScheduledCompletion | null {
  const statusByDate = new Map(logs.map((log) => [log.logDate, log.status]));

  let scheduled = 0;
  let completed = 0;

  const maxScan = sampleSize * SCAN_DAYS_PER_SAMPLE;

  for (let offset = 1; offset <= maxScan && scheduled < sampleSize; offset += 1) {
    const day = addDays(today, -offset);
    if (compareIsoDates(day, habit.startedOn) < 0) break;
    if (isRestDay(day) || !isScheduledOn(habit, day)) continue;

    scheduled += 1;

    const status = statusByDate.get(day);
    if (status === 'done' || status === 'partial') completed += 1;
  }

  if (scheduled < sampleSize) return null;

  return { scheduled, completed, ratio: completed / scheduled };
}

/** Wymiary, na których nawyk może się skurczyć. */
export type DownshiftChange = {
  startValue: number;
  incrementValue: number;
  scheduleType: Habit['scheduleType'];
  /** Dni tygodnia dla `custom`. `null` dla pozostałych harmonogramów. */
  scheduleDays: number[] | null;
};

/** Dni tygodnia, w które nawyk wypada. 0 = niedziela. */
export function scheduledWeekdays(habit: Habit): number[] {
  switch (habit.scheduleType) {
    case 'daily':
      return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays':
      return [1, 2, 3, 4, 5];
    case 'custom':
      return [...(habit.scheduleDays ?? [])].sort((left, right) => left - right);
  }
}

/**
 * Mniejsza wersja nawyku, wyliczona bez modelu.
 *
 * Najpierw połowa wartości startowej — to jest zmiana, którą użytkownik
 * rozumie bez tłumaczenia. Kiedy nie ma czego dzielić (start już wynosi
 * jeden), rzedniejemy harmonogram: zostaje co drugi dzień z dotychczasowych.
 *
 * `null` znaczy, że nawyk nie ma się już jak skurczyć — jedna sztuka raz
 * w tygodniu jest najmniejszą prośbą, jaką da się złożyć.
 */
export function deterministicDownshift(habit: Habit): DownshiftChange | null {
  const halved = Math.max(1, Math.floor(habit.startValue * 0.5));

  if (halved < habit.startValue) {
    return {
      startValue: halved,
      incrementValue: 0,
      scheduleType: habit.scheduleType,
      scheduleDays: habit.scheduleType === 'custom' ? scheduledWeekdays(habit) : null,
    };
  }

  const days = scheduledWeekdays(habit);
  if (days.length < 2) return null;

  return {
    startValue: habit.startValue,
    incrementValue: 0,
    scheduleType: 'custom',
    scheduleDays: days.filter((_, index) => index % 2 === 0),
  };
}

/** Ostatnia propozycja dla nawyku: kiedy padła i czy została przyjęta. */
export type LastDownshiftOffer = { on: IsoDate; accepted: boolean };

export type DownshiftContext = {
  lastOffer: LastDownshiftOffer | null;
  /** Ostatni dzień tygodnia wejściowego ścieżki. `null`, gdy go nie ma. */
  reentryUntil: IsoDate | null;
  isRestDay?: IsRestDay;
};

/**
 * Czy pokazać propozycję zmniejszenia.
 *
 * Wszystkie warunki muszą być spełnione naraz. Kontekst (ostatnia propozycja,
 * tydzień wejściowy) wchodzi osobnym parametrem, bo nie da się go odczytać
 * z nawyku ani z logów, a ta funkcja ma zostać czysta.
 */
export function shouldOfferDownshift(
  habit: Habit,
  logs: readonly HabitLog[],
  today: IsoDate,
  context: DownshiftContext,
): boolean {
  if (habit.archivedAt !== null || habit.retiredAt !== null) return false;

  if (daysBetween(habit.startedOn, today) < DOWNSHIFT_MIN_AGE_DAYS) return false;

  // Propozycja z dzisiaj to ta, która właśnie stoi na ekranie — dopóki
  // użytkownik jej nie przyjął, karta ma zostać widoczna. Przyjęta znika od
  // razu, bo nawyk jest już mniejszy i drugie zmniejszenie tego samego dnia
  // byłoby liczeniem tej samej ulgi dwa razy.
  if (context.lastOffer !== null) {
    const age = daysBetween(context.lastOffer.on, today);

    if (age < DOWNSHIFT_COOLDOWN_DAYS && (age > 0 || context.lastOffer.accepted)) {
      return false;
    }
  }

  // Tydzień wejściowy dotyczy wyłącznie praktyk ścieżki: to ona obniżyła
  // parametry na siedem dni i to ona je przywróci. Zmniejszanie czegoś, co
  // już jest zmniejszone, byłoby liczeniem tej samej ulgi dwa razy.
  if (
    habit.sourcePathId !== null &&
    context.reentryUntil !== null &&
    compareIsoDates(today, context.reentryUntil) <= 0
  ) {
    return false;
  }

  // Bez wariantu deterministycznego propozycja nie miałaby czego zaproponować.
  if (deterministicDownshift(habit) === null) return false;

  const completion = scheduledCompletion(
    habit,
    logs,
    today,
    DOWNSHIFT_WINDOW_DAYS,
    context.isRestDay,
  );

  return completion !== null && completion.ratio < DOWNSHIFT_THRESHOLD;
}
