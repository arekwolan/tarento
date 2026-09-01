import type { DaySummary, HabitStat, IsRestDay } from '@/features/stats/model/stats';
import type { TranslationKey } from '@/i18n/keys';
import {
  compareIsoDates,
  countScheduledDays,
  daysBetween,
  dayOfWeek,
  isScheduledOn,
  addDays,
  computeTargetAtStep,
  type HabitProgression,
  type IsoDate,
} from '@/lib/date';

/**
 * Jedno zdanie zamiast wykresu.
 *
 * Osoba prowadząca własne nawyki nie potrzebuje analityki — potrzebuje jednej
 * obserwacji. Ekran postępów otwiera się nią, a wykresy schodzą niżej, dla
 * chętnych.
 *
 * Czysta arytmetyka: bez zegara, bez sieci, bez i18n. Funkcja oddaje klucz
 * i parametry, a złożenie zdania należy do warstwy widoku — dzięki temu żadna
 * obserwacja nie powstaje przez sklejanie stringów.
 */

export type ObservationKey = Extract<TranslationKey, `stats.observation.${string}`>;

/**
 * Parametry obserwacji w dwóch rodzajach.
 *
 * `values` wstawiamy wprost. `keys` trzeba najpierw przetłumaczyć — nazwa dnia
 * tygodnia i pora dnia są tekstem interfejsu, a nie danymi, i nie mogą powstać
 * z konkatenacji po stronie modelu.
 */
export type Observation = {
  key: ObservationKey;
  values?: Record<string, string | number>;
  keys?: Record<string, TranslationKey>;
};

/** Minimum potrzebne, żeby powiedzieć coś o nawyku. */
export type ObservationHabit = {
  id: string;
  title: string;
  startedOn: IsoDate;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | null;
};

export type ObservationInput = {
  /** Agregaty dzień po dniu — z nich wychodzą wnioski o dniach tygodnia. */
  days: readonly DaySummary[];
  habits: readonly ObservationHabit[];
  /** Skuteczność per nawyk; łączy się z porą dnia z `habits`. */
  habitStats: readonly HabitStat[];
  today: IsoDate;
  isRestDay?: IsRestDay;
};

/** Ile dni z danymi musi być, żeby mówić o dniach tygodnia. */
const MIN_DAYS_FOR_WEEKDAY = 20;

/** Różnica poniżej tej wartości nie jest wnioskiem, tylko szumem. */
const MIN_WEEKDAY_GAP = 0.25;

/** Poniżej dwóch tygodni „robisz od X dni" nie jest jeszcze obserwacją. */
const MIN_HABIT_AGE_DAYS = 14;

/** Ile dni z harmonogramu musi mieć pora dnia, żeby dało się ją porównać. */
const MIN_BAND_DAYS = 5;

const WEEKDAY_KEYS = [
  'dayPlural.sun',
  'dayPlural.mon',
  'dayPlural.tue',
  'dayPlural.wed',
  'dayPlural.thu',
  'dayPlural.fri',
  'dayPlural.sat',
] as const satisfies readonly TranslationKey[];

const BAND_KEYS = {
  morning: 'stats.observation.bands.morning',
  afternoon: 'stats.observation.bands.afternoon',
  evening: 'stats.observation.bands.evening',
} as const satisfies Record<string, TranslationKey>;

const NEVER_REST: IsRestDay = () => false;

/** Dni, które w ogóle wchodzą do wniosków: z harmonogramem, nie puste, nie z przyszłości. */
function usableDays(input: ObservationInput): DaySummary[] {
  const isRestDay = input.isRestDay ?? NEVER_REST;

  return input.days.filter(
    (summary) =>
      summary.scheduled > 0 &&
      !isRestDay(summary.day) &&
      compareIsoDates(summary.day, input.today) <= 0,
  );
}

function weekdayObservation(days: readonly DaySummary[]): Observation | null {
  if (days.length < MIN_DAYS_FOR_WEEKDAY) return null;

  const totals = Array.from({ length: 7 }, () => ({ scheduled: 0, completed: 0 }));

  for (const summary of days) {
    const bucket = totals[dayOfWeek(summary.day)];
    if (bucket === undefined) continue;

    bucket.scheduled += summary.scheduled;
    bucket.completed += summary.completed;
  }

  const ratios = totals
    .map((bucket, weekday) => ({
      weekday,
      ratio: bucket.scheduled === 0 ? null : bucket.completed / bucket.scheduled,
    }))
    .filter((entry): entry is { weekday: number; ratio: number } => entry.ratio !== null);

  if (ratios.length < 2) return null;

  const best = ratios.reduce((top, entry) => (entry.ratio > top.ratio ? entry : top));
  const worst = ratios.reduce((low, entry) => (entry.ratio < low.ratio ? entry : low));

  if (best.ratio - worst.ratio < MIN_WEEKDAY_GAP) return null;

  const bestKey = WEEKDAY_KEYS[best.weekday];
  const worstKey = WEEKDAY_KEYS[worst.weekday];
  if (bestKey === undefined || worstKey === undefined) return null;

  return {
    key: 'stats.observation.weekday',
    keys: { best: bestKey, worst: worstKey },
  };
}

function longestHabitObservation(input: ObservationInput): Observation | null {
  const oldest = input.habits.reduce<ObservationHabit | null>(
    (top, habit) =>
      top === null || compareIsoDates(habit.startedOn, top.startedOn) < 0 ? habit : top,
    null,
  );

  if (oldest === null) return null;

  const days = daysBetween(oldest.startedOn, input.today);
  if (days < MIN_HABIT_AGE_DAYS) return null;

  return {
    key: 'stats.observation.longestHabit',
    values: { title: oldest.title, days },
  };
}

function timeOfDayObservation(input: ObservationInput): Observation | null {
  const bandOf = new Map(input.habits.map((habit) => [habit.id, habit.timeOfDay]));
  const totals = new Map<
    keyof typeof BAND_KEYS,
    { scheduled: number; completed: number }
  >();

  for (const stat of input.habitStats) {
    const band = bandOf.get(stat.habitId) ?? null;
    if (band === null) continue;

    const bucket = totals.get(band) ?? { scheduled: 0, completed: 0 };
    bucket.scheduled += stat.scheduled30;
    bucket.completed += stat.completed30;
    totals.set(band, bucket);
  }

  const ratios = [...totals.entries()]
    .filter(([, bucket]) => bucket.scheduled >= MIN_BAND_DAYS)
    .map(([band, bucket]) => ({ band, ratio: bucket.completed / bucket.scheduled }));

  // Jedna pora dnia nie jest porównaniem: „najlepiej wychodzi Ci rano" przy
  // nawykach wyłącznie porannych nic nie mówi.
  if (ratios.length < 2) return null;

  const best = ratios.reduce((top, entry) => (entry.ratio > top.ratio ? entry : top));

  return {
    key: 'stats.observation.timeOfDay',
    keys: { band: BAND_KEYS[best.band] },
  };
}

function fullDaysObservation(
  days: readonly DaySummary[],
  today: IsoDate,
): Observation | null {
  const month = today.slice(0, 7);
  const count = days.filter(
    (summary) => summary.day.startsWith(month) && summary.completed >= summary.scheduled,
  ).length;

  return count === 0 ? null : { key: 'stats.observation.fullDays', values: { count } };
}

/**
 * Jedna obserwacja, wybrana w kolejności priorytetu.
 *
 * Kolejność jest produktem: wniosek o dniach tygodnia jest najbardziej
 * użyteczny, a licznik domkniętych dni najbardziej oczywisty. Wariant zapasowy
 * mówi wprost, że danych jest za mało — zamiast pokazywać wniosek z trzech dni.
 */
export function buildObservation(input: ObservationInput): Observation {
  const days = usableDays(input);

  return (
    weekdayObservation(days) ??
    longestHabitObservation(input) ??
    timeOfDayObservation(input) ??
    fullDaysObservation(days, input.today) ?? {
      key: 'stats.observation.tooEarly',
    }
  );
}

// Prognoza --------------------------------------------------------------------

/** Nawyk z sufitem i progresją kalendarzową — tylko taki da się prognozować. */
export type ForecastHabit = HabitProgression;

/** Sufit skanowania w przód: prognoza dalsza niż pięć lat i tak nic nie mówi. */
const MAX_FORECAST_DAYS = 1830;

/**
 * Dzień, w którym nawyk osiągnie swój sufit.
 *
 * Patrzenie w przód zamiast oceniania przeszłości: „skończysz książkę
 * 14 listopada" mówi więcej niż „w tym tygodniu przeczytałeś 60%".
 *
 * `null`, gdy prognoza nie ma sensu — brak sufitu, zerowy albo ujemny przyrost,
 * progresja liczona wykonaniami (wtedy tempo zależy od użytkownika, a nie od
 * kalendarza) albo sufit już osiągnięty. Nie pokazujemy „nigdy".
 */
export function forecastDate(
  habit: ForecastHabit,
  today: IsoDate,
  expectedBeforeToday?: number,
): IsoDate | null {
  if (habit.progressionMode !== 'calendar') return null;
  if (habit.targetValue === null || habit.incrementValue <= 0) return null;

  // Snapshoty historyczne są źródłem prawdy. `undefined` to kompatybilny
  // fallback podczas ładowania/starego cache'u; przyszłość bez snapshotu nadal
  // używa harmonogramu, bo plan tego dnia jeszcze nie istnieje.
  const step = expectedBeforeToday ?? countScheduledDays(habit, habit.startedOn, today);
  const current = computeTargetAtStep(habit, step);
  if (current >= habit.targetValue) return null;

  const stepsNeeded = Math.ceil((habit.targetValue - current) / habit.incrementValue);

  let remaining = stepsNeeded;

  for (let offset = 1; offset <= MAX_FORECAST_DAYS; offset += 1) {
    const day = addDays(today, offset);
    if (!isScheduledOn(habit, day)) continue;

    remaining -= 1;
    if (remaining <= 0) return day;
  }

  return null;
}
