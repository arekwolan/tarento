/**
 * Harmonogram nawyku w postaci, której potrzebuje walidator.
 *
 * Odpowiednik `scheduledDows()` z @/lib/date, ograniczony do jednego pytania:
 * ile dni w tygodniu nawyk wypada. To jedyny wymiar harmonogramu, który
 * rozstrzyga, czy propozycja jest mniejsza od oryginału.
 */

export const SCHEDULE_TYPES = ['daily', 'weekdays', 'custom'] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export function isScheduleType(value: unknown): value is ScheduleType {
  return (
    typeof value === 'string' && (SCHEDULE_TYPES as readonly string[]).includes(value)
  );
}

/** 0 = niedziela, 6 = sobota — numeracja z Postgresowego extract(dow). */
export function daysPerWeek(
  scheduleType: ScheduleType,
  scheduleDays: readonly number[] | null,
): number {
  switch (scheduleType) {
    case 'daily':
      return 7;
    case 'weekdays':
      return 5;
    case 'custom':
      return scheduleDays === null ? 0 : scheduleDays.length;
  }
}

/** Dni tygodnia z odpowiedzi modelu: liczby całkowite 0–6, bez powtórzeń. */
export function toWeekdays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;

  const days = [...new Set(value)]
    .filter(
      (day): day is number =>
        typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6,
    )
    .sort((left, right) => left - right);

  return days.length === 0 ? null : days;
}
