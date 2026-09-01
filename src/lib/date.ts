import { format } from 'date-fns';
import { enUS, pl } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Jedyne miejsce w aplikacji, które sięga po zegar i liczy na datach.
 *
 * CLAUDE.md, reguła krytyczna 2: w kodzie feature'ów i komponentów nie ma
 * bezpośredniego `new Date()` ani `Date.now()`.
 *
 * Wszystkie funkcje operujące na dniu przyjmują i zwracają `IsoDate`
 * ('YYYY-MM-DD'), czyli datę kalendarzową bez strefy. Arytmetyka na niej idzie
 * przez UTC, gdzie doba zawsze ma 24 godziny — dzięki temu zmiana czasu nie
 * przesuwa wyników.
 */

/** Data kalendarzowa bez strefy, w formacie 'YYYY-MM-DD'. */
export type IsoDate = string;

export type ScheduleType = 'daily' | 'weekdays' | 'custom';
export type ProgressionMode = 'completion' | 'calendar';

/** Minimum potrzebne, żeby powiedzieć, w których dniach nawyk wypada. */
export type HabitSchedule = {
  scheduleType: ScheduleType;
  /** Dni tygodnia dla `custom`. 0 = niedziela, 6 = sobota — jak w Postgresie. */
  scheduleDays: readonly number[] | null;
  startedOn: IsoDate;
};

/** Schedule plus wszystko, co wpływa na cel danego dnia. */
export type HabitProgression = HabitSchedule & {
  startValue: number;
  incrementValue: number;
  /** Sufit progresji. `null` = brak sufitu. */
  targetValue: number | null;
  progressionMode: ProgressionMode;
};

export type SupportedLocale = 'pl' | 'en';

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 1440;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_DOWS: readonly number[] = [1, 2, 3, 4, 5];

const DATE_FNS_LOCALES = { pl, en: enUS } as const;

/**
 * Etykiety dnia względnego.
 *
 * To jedyne teksty widoczne dla użytkownika poza warstwą i18n. Nie są kopią
 * interfejsu, tylko tabelą lokalizacyjną kluczowaną tym samym zbiorem
 * języków — trzymanie ich tutaj pozwala testować `formatRelativeDay()`
 * bez inicjalizacji i18next.
 */
const RELATIVE_LABELS: Record<SupportedLocale, { today: string; yesterday: string }> = {
  pl: { today: 'dziś', yesterday: 'wczoraj' },
  en: { today: 'today', yesterday: 'yesterday' },
};

// Zegar ----------------------------------------------------------------------

/** Bieżący czas w milisekundach epoki. */
export function nowMs(): number {
  return Date.now();
}

/** Czy znacznik czasu (w sekundach epoki, jak w JWT) już minął. */
export function isEpochSecondsPast(epochSeconds: number): boolean {
  return epochSeconds * 1000 <= nowMs();
}

/** Strefa czasowa urządzenia w zapisie IANA. */
export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Arytmetyka na IsoDate ------------------------------------------------------

/** 'YYYY-MM-DD' → północ UTC tego dnia. Rzuca dla dat nieistniejących. */
function isoDateToUtcMs(date: IsoDate): number {
  const match = ISO_DATE_PATTERN.exec(date);
  if (match === null) {
    throw new RangeError(`Oczekiwano daty 'YYYY-MM-DD', dostano '${date}'.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);

  // Date.UTC normalizuje przepełnienia (2026-02-31 → 2026-03-03), więc
  // sprawdzamy przez powrót do stringa, czy data w ogóle istniała.
  if (utcMsToIsoDate(ms) !== date) {
    throw new RangeError(`Data '${date}' nie istnieje w kalendarzu.`);
  }

  return ms;
}

function utcMsToIsoDate(ms: number): IsoDate {
  const value = new Date(ms);
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Dzień tygodnia: 0 = niedziela, 6 = sobota (jak `extract(dow)` w Postgresie). */
export function dayOfWeek(date: IsoDate): number {
  return new Date(isoDateToUtcMs(date)).getUTCDay();
}

/** Przesuwa datę o `amount` dni. Ujemne cofa. */
export function addDays(date: IsoDate, amount: number): IsoDate {
  return utcMsToIsoDate(isoDateToUtcMs(date) + amount * MS_PER_DAY);
}

/** Liczba pełnych dni od `from` do `to`. Ujemna, gdy `to` jest wcześniej. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return (isoDateToUtcMs(to) - isoDateToUtcMs(from)) / MS_PER_DAY;
}

/** -1 / 0 / 1, jak komparator. */
export function compareIsoDates(left: IsoDate, right: IsoDate): number {
  const difference = isoDateToUtcMs(left) - isoDateToUtcMs(right);
  return difference === 0 ? 0 : difference < 0 ? -1 : 1;
}

// Doba logiczna --------------------------------------------------------------

/**
 * Dzień, który dla użytkownika jest „dzisiaj".
 *
 * Doba logiczna nie kończy się o północy, tylko o `dayStartHour` czasu
 * lokalnego: przy ustawieniu 4 odhaczenie o 2:00 w nocy domyka dzień
 * poprzedni.
 *
 * Zamiast dodawać i odejmować godziny od instantu, odczytujemy ścianę zegara
 * w danej strefie i dalej liczymy na kalendarzu. Dzięki temu zmiana czasu
 * niczego nie przesuwa — także w dobie, która ma 23 albo 25 godzin.
 *
 * @param timeZone strefa IANA, np. 'Europe/Warsaw'
 * @param dayStartHour godzina 0–23, o której zaczyna się nowy dzień
 * @param now punkt w czasie (Date albo ms epoki); parametr istnieje dla testów
 */
export function getLogicalToday(
  timeZone: string,
  dayStartHour: number,
  now: Date | number = new Date(),
): IsoDate {
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new RangeError(
      `dayStartHour musi być liczbą całkowitą 0–23, dostano ${dayStartHour}.`,
    );
  }

  const instant = typeof now === 'number' ? new Date(now) : now;
  const wallClock = formatInTimeZone(instant, timeZone, 'yyyy-MM-dd HH');
  const calendarDate = wallClock.slice(0, 10);
  const hour = Number(wallClock.slice(11, 13));

  return hour < dayStartHour ? addDays(calendarDate, -1) : calendarDate;
}

// Harmonogram ----------------------------------------------------------------

/** Które dni tygodnia obejmuje harmonogram. Pusty zbiór = żaden. */
function scheduledDows(schedule: HabitSchedule): readonly number[] {
  switch (schedule.scheduleType) {
    case 'daily':
      return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays':
      return WEEKDAY_DOWS;
    case 'custom':
      return schedule.scheduleDays ?? [];
  }
}

/**
 * Czy nawyk wypada w danym dniu.
 *
 * Musi dawać ten sam wynik co `public.habit_is_scheduled_on` w bazie —
 * stąd ta sama numeracja dni (0 = niedziela).
 */
export function isScheduledOn(habit: HabitSchedule, date: IsoDate): boolean {
  if (compareIsoDates(date, habit.startedOn) < 0) {
    return false;
  }

  return scheduledDows(habit).includes(dayOfWeek(date));
}

/**
 * Ile dni z harmonogramu wypadło w przedziale [from, toExclusive).
 *
 * Liczone wzorem, nie pętlą po dniach — nawyk prowadzony od lat nie może
 * kosztować tysięcy iteracji przy każdym renderze.
 */
export function countScheduledDays(
  schedule: HabitSchedule,
  from: IsoDate,
  toExclusive: IsoDate,
): number {
  const span = daysBetween(from, toExclusive);
  if (span <= 0) return 0;

  const dows = new Set(scheduledDows(schedule));
  if (dows.size === 0) return 0;
  if (dows.size === 7) return span;

  const startDow = dayOfWeek(from);
  const fullWeeks = Math.floor(span / 7);
  let count = fullWeeks * dows.size;

  for (let offset = 0; offset < span % 7; offset += 1) {
    if (dows.has((startDow + offset) % 7)) count += 1;
  }

  return count;
}

// Cel na dany dzień ----------------------------------------------------------

/**
 * Cel nawyku na wskazany dzień:
 * `min(startValue + incrementValue * n, targetValue ?? +∞)`.
 *
 * `n` zależy od trybu progresji:
 *   * `completion` — liczba dotychczasowych wykonań (`completedCount`),
 *   * `calendar`   — liczba dni z harmonogramu, które minęły przed `date`.
 *
 * W obu trybach pierwszy dzień daje `n = 0`, czyli goły `startValue`.
 */
export function computeTargetForDate(
  habit: HabitProgression,
  date: IsoDate,
  completedCount: number,
): number {
  return computeTargetAtStep(habit, progressionStep(habit, date, completedCount));
}

/** Który krok progresji obowiązuje w danym dniu. Pierwszy dzień to krok 0. */
export function progressionStep(
  habit: HabitProgression,
  date: IsoDate,
  completedCount: number,
): number {
  return habit.progressionMode === 'completion'
    ? Math.max(0, Math.trunc(completedCount))
    : countScheduledDays(habit, habit.startedOn, date);
}

/** Cel na wskazanym kroku progresji, po przycięciu sufitem. */
export function computeTargetAtStep(habit: HabitProgression, step: number): number {
  const progressed = habit.startValue + habit.incrementValue * Math.max(0, step);
  const cap = habit.targetValue ?? Number.POSITIVE_INFINITY;

  return Math.min(progressed, cap);
}

// Prezentacja ----------------------------------------------------------------

/**
 * „dziś", „wczoraj" albo „pon, 3 mar".
 *
 * @param today dzień odniesienia; przekazuj wynik getLogicalToday(), bo
 *   domyślna wartość zna tylko kalendarz urządzenia, nie dobę logiczną
 */
export function formatRelativeDay(
  date: IsoDate,
  locale: SupportedLocale,
  today: IsoDate = getLogicalToday(systemTimeZone(), 0),
): string {
  const offset = daysBetween(today, date);

  if (offset === 0) return RELATIVE_LABELS[locale].today;
  if (offset === -1) return RELATIVE_LABELS[locale].yesterday;

  const value = new Date(isoDateToUtcMs(date));
  const dateFnsLocale = DATE_FNS_LOCALES[locale];

  // Polski skrót dnia z date-fns ma kropkę ('pon.'); format aplikacji jej nie ma.
  const weekday = format(value, 'EEE', { locale: dateFnsLocale }).replace(/\.$/, '');
  const dayAndMonth = format(value, 'd MMM', { locale: dateFnsLocale });

  return `${weekday}, ${dayAndMonth}`;
}

/** Bieżąca chwila w ISO 8601 (UTC). */
export function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

/**
 * Sprawdza, czy strefa jest znana temu urządzeniu; w razie czego wraca do
 * strefy systemowej.
 *
 * Profil może pochodzić z innego telefonu, a Intl na starszym Androidzie nie
 * zna każdej strefy IANA. Bez tego cała lista „Dziś" wywracałaby się na
 * RangeError zamiast pokazać dane w lokalnym czasie.
 */
export function resolveTimeZone(candidate: string | null | undefined): string {
  if (candidate === null || candidate === undefined || candidate === '') {
    return systemTimeZone();
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return systemTimeZone();
  }
}

/** Godzina 0–23 na zegarze użytkownika. Do powitań, nie do doby logicznej. */
export function getLocalHour(timeZone: string, now: Date | number = new Date()): number {
  const instant = typeof now === 'number' ? new Date(now) : now;
  return Number(formatInTimeZone(instant, timeZone, 'HH'));
}

/**
 * Minuty od północy na zegarze użytkownika.
 *
 * Do okna dnia, nie do doby logicznej: okno leży na zegarze ściennym
 * („od 17:00"), więc porównuje się je z tym samym zegarem.
 */
export function getLocalMinutes(
  timeZone: string,
  now: Date | number = new Date(),
): number {
  const instant = typeof now === 'number' ? new Date(now) : now;
  return minutesOfDay(formatInTimeZone(instant, timeZone, 'HH:mm')) ?? 0;
}

/** Pełna data do nagłówka, np. „poniedziałek, 16 marca". */
export function formatFullDay(date: IsoDate, locale: SupportedLocale): string {
  return format(new Date(isoDateToUtcMs(date)), 'EEEE, d MMMM', {
    locale: DATE_FNS_LOCALES[locale],
  });
}

// Godzina w ciągu doby -------------------------------------------------------

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** 'HH:MM' → składowe, albo null gdy zapis jest niepoprawny. */
export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

export function formatTimeOfDay(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Przesuwa godzinę o podaną liczbę minut, zawijając w obrębie doby. */
export function shiftTimeOfDay(value: string, minutes: number): string {
  const parsed = parseTimeOfDay(value);
  if (parsed === null) return value;

  const total = (((parsed.hour * 60 + parsed.minute + minutes) % 1440) + 1440) % 1440;
  return formatTimeOfDay(Math.floor(total / 60), total % 60);
}

/**
 * 'HH:MM' → minuty od północy. null, gdy zapis jest niepoprawny.
 *
 * Arytmetyka na godzinach idzie na minutach, nie na stringach: porównanie
 * '9:05' z '10:00' leksykograficznie kłamie, a odejmowanie godzin od minut
 * rozjeżdża się przy każdym przekroczeniu pełnej godziny.
 */
export function minutesOfDay(value: string): number | null {
  // '24:00' to koniec doby — zapis, który oddaje timeOfDayFromMinutes(1440)
  // i który Postgres przyjmuje w kolumnie `time`.
  if (value === '24:00') return MINUTES_PER_DAY;

  const parsed = parseTimeOfDay(value);
  return parsed === null ? null : parsed.hour * 60 + parsed.minute;
}

/**
 * Minuty od północy → 'HH:MM'. Wartości spoza doby przycina do jej granic.
 *
 * 1440 daje '24:00', nie '00:00' — to koniec doby, nie jej początek, i tylko
 * w tym zapisie koniec przedziału da się odróżnić od jego początku.
 */
export function timeOfDayFromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  return formatTimeOfDay(Math.floor(clamped / 60), clamped % 60);
}

/** Czy zapis 'HH:MM' jest poprawną godziną. */
export function isValidTimeOfDay(value: string): boolean {
  return parseTimeOfDay(value) !== null;
}

/**
 * Data kalendarzowa + godzina ścienna w danej strefie → punkt w czasie.
 *
 * Potrzebne do planowania powiadomień: „26 sierpnia o 7:30 czasu użytkownika"
 * to inny moment w Warszawie i w Auckland, a system operacyjny chce instantu.
 */
export function zonedDateTimeToInstant(
  date: IsoDate,
  time: string,
  timeZone: string,
): Date | null {
  const parsed = parseTimeOfDay(time);
  if (parsed === null) return null;

  const wallClock = `${date}T${formatTimeOfDay(parsed.hour, parsed.minute)}:00`;
  const instant = fromZonedTime(wallClock, timeZone);

  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Krótki skrót treści — do wykrywania, że zaplanowane powiadomienie się zdezaktualizowało. */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** Poniedziałek tygodnia, w którym leży data. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  // dayOfWeek: 0 = niedziela. Do poniedziałku cofamy się o (dow + 6) % 7 dni.
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}
