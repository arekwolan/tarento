import type { TimeWindow } from '@/features/day-budget/model/windows';
import type { TranslationKey } from '@/i18n/keys';

/**
 * Liczby minut zaokrąglamy w dół do pięciu.
 *
 * Nie chodzi o precyzję, tylko o to, żeby nagłówek nie tykał. Przy okazji
 * każda pokazana liczba kończy się na 0 albo 5, a takie liczebniki po polsku
 * zawsze łączą się z formą „minut" — tekst nie potrzebuje odmiany przez
 * liczbę, której test parzystości pl/en i tak by nie przepuścił.
 */
const DISPLAY_STEP = 5;

export type WindowHeadline = { key: TranslationKey; minutes: number };

function toDisplayMinutes(minutes: number): number {
  return Math.floor(minutes / DISPLAY_STEP) * DISPLAY_STEP;
}

/**
 * Jedna linia nad listą „Dziś".
 *
 * Dopóki zostaje co najmniej połowa okna, mówimy o całości. Potem o reszcie —
 * i to jest jedyny licznik czasu na tym ekranie: bez paska postępu, bez
 * sekund, bez akcentu (CLAUDE.md, reguła 8).
 *
 * `null` znaczy, że linii nie ma: albo użytkownik nie ma budżetu dnia, albo
 * okno już się skończyło. Wtedy nagłówek po prostu znika — nie zamienia się
 * w komunikat o tym, co przepadło.
 */
export function windowHeadline(
  window: TimeWindow | null,
  remainingMinutes: number,
): WindowHeadline | null {
  if (window === null) return null;

  const total = toDisplayMinutes(window.minutes);
  const remaining = toDisplayMinutes(Math.min(remainingMinutes, window.minutes));

  if (total <= 0 || remaining <= 0) return null;

  return remaining * 2 >= window.minutes
    ? { key: 'today.window.total', minutes: total }
    : { key: 'today.window.left', minutes: remaining };
}
