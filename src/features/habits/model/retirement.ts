import { scheduledCompletion, type IsRestDay } from '@/features/habits/model/downshift';
import type { Habit, HabitLog } from '@/features/habits/model/habit';
import { daysBetween, type IsoDate } from '@/lib/date';

/**
 * Emerytura nawyku: nawyk, który stał się nawykiem, przestaje być śledzony.
 *
 * Najbardziej kontrintuicyjna funkcja w produkcie i jedyna, która dowodzi jego
 * tezy — celem jest przestać potrzebować aplikacji do tej konkretnej rzeczy.
 * Przy pisaniu kodu będzie się to wydawało błędem. To nie jest błąd.
 *
 * Czysta arytmetyka: bez zegara, bez sieci, bez znajomości ścieżek ani dni
 * pustych. Wszystko, czego nie da się policzyć z nawyku i logów, wchodzi
 * kontekstem — tak samo jak przy propozycji zmniejszenia.
 */

/** Ile ostatnich zaplanowanych dni bierzemy pod uwagę. */
export const RETIREMENT_WINDOW_DAYS = 60;

/** Powyżej tego wykonania nawyk jest już nawykiem, a nie zadaniem. */
export const RETIREMENT_THRESHOLD = 0.85;

/** Ile dni nawyk musi istnieć, zanim w ogóle da się coś o nim powiedzieć. */
export const RETIREMENT_MIN_AGE_DAYS = 60;

/** Odstęp między propozycjami dla tego samego nawyku. */
export const RETIREMENT_COOLDOWN_DAYS = 90;

/** Ostatnia propozycja: kiedy padła i czy użytkownik już się do niej odniósł. */
export type LastRetirementOffer = { on: IsoDate; decided: boolean };

export type RetirementContext = {
  lastOffer: LastRetirementOffer | null;
  isRestDay?: IsRestDay;
};

/**
 * Czy zaproponować zdjęcie nawyku z listy.
 *
 * Wszystkie warunki muszą być spełnione naraz. Praktyka ścieżki nie kwalifikuje
 * się nigdy: ją wycofuje etap, a dwie ręce na tej samej dźwigni oznaczałyby, że
 * użytkownik zdejmuje z listy coś, co ścieżka za chwilę doda z powrotem.
 */
export function isRetirementCandidate(
  habit: Habit,
  logs: readonly HabitLog[],
  today: IsoDate,
  context: RetirementContext,
): boolean {
  if (habit.archivedAt !== null || habit.retiredAt !== null) return false;
  if (habit.sourcePathId !== null) return false;

  if (daysBetween(habit.startedOn, today) < RETIREMENT_MIN_AGE_DAYS) return false;

  // Propozycja z dzisiaj to ta, która właśnie stoi na ekranie: zostaje widoczna,
  // dopóki użytkownik nie wybierze „Zdejmij z listy" albo „Zostaw".
  if (context.lastOffer !== null) {
    const age = daysBetween(context.lastOffer.on, today);

    if (age < RETIREMENT_COOLDOWN_DAYS && (age > 0 || context.lastOffer.decided)) {
      return false;
    }
  }

  const completion = scheduledCompletion(
    habit,
    logs,
    today,
    RETIREMENT_WINDOW_DAYS,
    context.isRestDay,
  );

  return completion !== null && completion.ratio >= RETIREMENT_THRESHOLD;
}

/**
 * Ostatni dzień, który wchodzi do serii nawyku.
 *
 * Nawyk zdjęty z listy nie ma już dni z harmonogramu — nikt o niego nie prosi,
 * więc brak wpisu nie jest niewykonaniem, a seria stoi w miejscu zamiast się
 * zrywać. Dzień zdjęcia wchodzi jeszcze do rachunku: tego dnia nawyk był na
 * liście i dało się go odhaczyć.
 *
 * Mirror warunku z public.get_habit_streak — obie strony muszą zamrażać serię
 * w tym samym dniu, inaczej ekran i baza pokazałyby różne liczby.
 */
export function streakEndDay(habit: Habit, today: IsoDate): IsoDate {
  if (habit.retiredAt === null) return today;

  const retiredOn = habit.retiredAt.slice(0, 10);

  return daysBetween(retiredOn, today) > 0 ? retiredOn : today;
}
