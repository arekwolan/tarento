import {
  addDays,
  compareIsoDates,
  daysBetween,
  startOfIsoWeek,
  type IsoDate,
} from '@/lib/date';

/** Jeden dzień: ile było zaplanowane, ile odhaczone. Wprost z SQL. */
export type DaySummary = {
  day: IsoDate;
  scheduled: number;
  completed: number;
};

export type HabitStat = {
  habitId: string;
  scheduled7: number;
  completed7: number;
  scheduled30: number;
  completed30: number;
  currentStreak: number;
  longestStreak: number;
  /** Ostatnie dni z harmonogramu: true = wykonane. Pod mini-wykres. */
  recentDays: boolean[];
};

export const HEATMAP_WEEKS = 12;

/** Zakres dat heatmapy: pełne tygodnie, ostatni kończy się dzisiaj. */
export function heatmapRange(
  today: IsoDate,
  weeks = HEATMAP_WEEKS,
): {
  from: IsoDate;
  to: IsoDate;
} {
  return { from: addDays(startOfIsoWeek(today), -(weeks - 1) * 7), to: today };
}

/**
 * Intensywność pola mapy dni.
 *
 * Pięć stopni ze skali serii systemu designu: 0 = nic nie odhaczone,
 * 1 = do 25%, 2 = do 50%, 3 = powyżej 50% ale nie wszystko, 4 = komplet.
 *
 * `null` znaczy „nic nie było zaplanowane" — takie pole rysuje się tak samo
 * jak poziom 0, bo dzień bez zadań nie jest ani sukcesem, ani porażką,
 * a dnia pominiętego nie karzemy wizualnie.
 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | null;

export function heatLevel(summary: DaySummary | undefined): HeatLevel {
  if (summary === undefined || summary.scheduled === 0) return null;

  const ratio = summary.completed / summary.scheduled;
  if (ratio <= 0) return 0;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/**
 * Predykat „czy to dzień pusty".
 *
 * Model statystyk nie zna feature'u dni pustych — dostaje samo pytanie,
 * na które ktoś inny umie odpowiedzieć. Dzięki temu ten plik zostaje czystą
 * arytmetyką bez importu warstwy danych.
 */
export type IsRestDay = (day: IsoDate) => boolean;

const NEVER_REST: IsRestDay = () => false;

export type HeatmapCell = {
  day: IsoDate;
  level: HeatLevel;
  /** Dzień pusty. Rysuje się jak dzień bez danych, ale mówi o sobie wprost. */
  isRest: boolean;
};

/**
 * Siatka heatmapy: kolumna = tydzień, wiersz = dzień tygodnia (pn–nd).
 *
 * Dni po dzisiaj dostają `null`, żeby ostatnia kolumna nie sugerowała
 * przyszłych porażek. Dzień pusty też dostaje `null`: skoro seria go pomija,
 * mapa nie ma prawa pokazywać go ani jako sukcesu, ani jako pustki po
 * porażce (CLAUDE.md, reguła 7).
 */
export function toHeatmapWeeks(
  days: readonly DaySummary[],
  today: IsoDate,
  weeks = HEATMAP_WEEKS,
  isRestDay: IsRestDay = NEVER_REST,
): HeatmapCell[][] {
  const byDay = new Map(days.map((summary) => [summary.day, summary]));
  const firstMonday = addDays(startOfIsoWeek(today), -(weeks - 1) * 7);

  return Array.from({ length: weeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const day = addDays(firstMonday, weekIndex * 7 + dayIndex);
      const isRest = isRestDay(day);

      return {
        day,
        isRest,
        level:
          isRest || compareIsoDates(day, today) > 0 ? null : heatLevel(byDay.get(day)),
      };
    }),
  );
}

/**
 * Skuteczność za ostatnie N dni jako ułamek 0–1.
 *
 * `null`, gdy w oknie nie było nic zaplanowane — procent z zera niczego
 * nie mówi, a 0% wyglądałoby jak porażka.
 */
export function computeAdherence(
  days: readonly DaySummary[],
  lastDays: number,
  today: IsoDate,
): number | null {
  const from = addDays(today, -(lastDays - 1));

  let scheduled = 0;
  let completed = 0;

  for (const summary of days) {
    if (compareIsoDates(summary.day, from) < 0) continue;
    if (compareIsoDates(summary.day, today) > 0) continue;
    scheduled += summary.scheduled;
    completed += summary.completed;
  }

  return scheduled === 0 ? null : completed / scheduled;
}

/**
 * Ile z ostatnich N dni zostało domkniętych w całości.
 *
 * Główna liczba ekranu postępów. Proporcja przeżywa pominięty dzień, seria
 * umiera — i to jest cała różnica między „23 z ostatnich 30 dni" a „seria: 0".
 *
 * Dzień pusty i dzień bez zadań nie wchodzą do licznika. Mianownik zostaje
 * kalendarzowy, bo taką obietnicę niesie zdanie „z ostatnich 30 dni".
 */
export function countCompleteDays(
  days: readonly DaySummary[],
  lastDays: number,
  today: IsoDate,
  isRestDay: IsRestDay = NEVER_REST,
): number {
  const from = addDays(today, -(lastDays - 1));

  return days.filter(
    (summary) =>
      summary.scheduled > 0 &&
      summary.completed >= summary.scheduled &&
      !isRestDay(summary.day) &&
      compareIsoDates(summary.day, from) >= 0 &&
      compareIsoDates(summary.day, today) <= 0,
  ).length;
}

export type DayStreaks = { current: number; longest: number };

/**
 * Serie liczone na poziomie dnia: liczy się dzień, w którym zrobiono
 * wszystko, co było zaplanowane.
 *
 * Dni bez żadnego zadania są neutralne — nie przerywają serii i jej nie
 * przedłużają. Dzisiaj bez kompletu też nie przerywa, bo doba jeszcze trwa.
 *
 * Dzień pusty jest przezroczysty: wypada z rachunku tak samo jak dzień bez
 * zadań. Nie liczy się jak wykonanie (seria na kredyt) ani jak dzień
 * zaplanowany bez wpisu (zerwanie) — po prostu go nie ma.
 */
export function computeDayStreaks(
  days: readonly DaySummary[],
  today: IsoDate,
  isRestDay: IsRestDay = NEVER_REST,
): DayStreaks {
  const sorted = [...days].sort((left, right) => compareIsoDates(left.day, right.day));

  let running = 0;
  let longest = 0;

  for (const summary of sorted) {
    if (compareIsoDates(summary.day, today) > 0) continue;
    if (summary.scheduled === 0) continue;
    if (isRestDay(summary.day)) continue;

    if (summary.completed >= summary.scheduled) {
      running += 1;
      longest = Math.max(longest, running);
      continue;
    }

    if (summary.day === today) continue;

    running = 0;
  }

  return { current: running, longest };
}

/** Czy jest już czego pokazywać, czy trzeba wrócić za kilka dni. */
export function hasEnoughHistory(days: readonly DaySummary[]): boolean {
  return days.some((summary) => summary.scheduled > 0);
}

/** Ile dni historii zebrano — do komunikatu dla nowych użytkowników. */
export function historyLengthInDays(days: readonly DaySummary[], today: IsoDate): number {
  const withData = days.filter((summary) => summary.scheduled > 0);
  const first = withData[0];

  return first === undefined ? 0 : daysBetween(first.day, today) + 1;
}
