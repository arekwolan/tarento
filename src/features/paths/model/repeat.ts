import type { Path } from '@/features/paths/model/schemas';
import { daysBetween, type IsoDate } from '@/lib/date';

/**
 * Karencja na powtórzenie ścieżki.
 *
 * Niektóre ścieżki tracą sens robione dwa razy pod rząd — „Powrót" odbudowuje
 * jeden nawyk po tym, jak wszystko się posypało, i uruchomiona miesiąc po
 * poprzednim podejściu nie odbudowuje już niczego. Reguła jest w treści
 * (`paths.repeatCooldownDays`), nie w warunku po slugu, więc kolejna ścieżka
 * z karencją to migracja, a nie zmiana w kodzie.
 */

export type EndedPath = {
  id: string;
  pathId: string;
  slug: string;
  title: string;
  /** Znacznik zakończenia z bazy (timestamptz w zapisie ISO). */
  endedAt: string;
};

/**
 * Czy ścieżki nie da się teraz uruchomić, bo była robiona niedawno.
 *
 * Dzień zakończenia bierzemy z części kalendarzowej znacznika. Przy karencji
 * liczonej w dziesiątkach dni doba różnicy niczego nie zmienia, a uniknięcie
 * arytmetyki na strefach jest tego warte.
 */
export function isRepeatBlocked(
  path: Pick<Path, 'slug' | 'repeatCooldownDays'>,
  endedPaths: readonly EndedPath[],
  today: IsoDate,
): boolean {
  const cooldown = path.repeatCooldownDays;
  if (cooldown === null) return false;

  return endedPaths.some((ended) => {
    if (ended.slug !== path.slug) return false;

    const endedOn: IsoDate = ended.endedAt.slice(0, 10);
    return daysBetween(endedOn, today) < cooldown;
  });
}
