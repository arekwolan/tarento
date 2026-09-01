import { z } from 'zod';

import { dayOfWeek, type IsoDate } from '@/lib/date';

/**
 * Dzień pusty: doba, w której aplikacja o nic nie prosi.
 *
 * Wiersz niesie dokładnie jedną z dwóch deklaracji — cykliczny dzień tygodnia
 * albo pojedynczą datę. CHECK `rest_days_one_of` w migracji pilnuje, żeby nie
 * dało się zapisać obu naraz ani żadnej.
 */
export type RestDay = {
  id: string;
  userId: string;
  /** 0 = niedziela, 6 = sobota — numeracja z Postgresa i z `dayOfWeek()`. */
  weekday: number | null;
  restDate: IsoDate | null;
  createdAt: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

export const restDayRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    weekday: z.number().int().min(0).max(6).nullable(),
    rest_date: isoDate.nullable(),
    created_at: z.string(),
  })
  .transform((row): RestDay => ({
    id: row.id,
    userId: row.user_id,
    weekday: row.weekday,
    restDate: row.rest_date,
    createdAt: row.created_at,
  }));

/** Czy w tym dniu aplikacja o nic nie prosi. */
export function isRestDay(date: IsoDate, restDays: readonly RestDay[]): boolean {
  if (restDays.length === 0) return false;

  const dow = dayOfWeek(date);

  return restDays.some(
    (entry) =>
      entry.restDate === date || (entry.weekday !== null && entry.weekday === dow),
  );
}

/** Dni tygodnia zadeklarowane jako puste — pod przełączniki w ustawieniach. */
export function restWeekdays(restDays: readonly RestDay[]): number[] {
  return restDays
    .map((entry) => entry.weekday)
    .filter((weekday): weekday is number => weekday !== null);
}

/**
 * Deklaracja dotycząca konkretnej daty, jeśli istnieje.
 *
 * Potrzebna do cofnięcia: „Cofnij" w toaście kasuje ten jeden wiersz, a nie
 * cykliczny dzień tygodnia, który akurat też wypada dzisiaj.
 */
export function findRestDate(
  date: IsoDate,
  restDays: readonly RestDay[],
): RestDay | null {
  return restDays.find((entry) => entry.restDate === date) ?? null;
}

/** Deklaracja dotycząca dnia tygodnia, jeśli istnieje. */
export function findRestWeekday(
  weekday: number,
  restDays: readonly RestDay[],
): RestDay | null {
  return restDays.find((entry) => entry.weekday === weekday) ?? null;
}
