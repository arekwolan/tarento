import { useAuth } from '@/features/auth';
import { useDayBudget } from '@/features/day-budget/api/use-day-budget';
import {
  windowHeadline,
  type WindowHeadline,
} from '@/features/day-budget/model/headline';
import { remainingSelfMinutes } from '@/features/day-budget/model/windows';
import { getLocalMinutes, resolveTimeZone, type IsoDate } from '@/lib/date';

export type UseDayWindowResult = {
  /** Linia nad listą. `null`, gdy nie ma budżetu albo okno się skończyło. */
  headline: WindowHeadline | null;
  /**
   * Ile minut jeszcze się mieści. `Infinity`, gdy użytkownik nie przeszedł
   * jeszcze kroku „kształt dnia" — wtedy listę ogranicza sam sufit sztuk,
   * a nie zegar.
   */
  remainingMinutes: number;
};

/**
 * Okno dnia w postaci, której potrzebuje ekran „Dziś".
 *
 * Godzinę czytamy przy renderze, bez minutnika: plan nie przelicza się sam
 * i nigdy nie informuje o przeliczeniu (IDEAS.md §A). Lista bywa krótsza przy
 * kolejnym otwarciu — i tyle.
 */
export function useDayWindow(date: IsoDate): UseDayWindowResult {
  const { profile } = useAuth();
  const { template, blocks, allocatedWindow } = useDayBudget(date);

  if (template === null) {
    return { headline: null, remainingMinutes: Number.POSITIVE_INFINITY };
  }

  const nowMinutes = getLocalMinutes(resolveTimeZone(profile?.timezone));
  const remainingMinutes = remainingSelfMinutes(template, blocks, nowMinutes);

  return {
    headline: windowHeadline(allocatedWindow, remainingMinutes),
    remainingMinutes,
  };
}
