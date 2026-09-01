import type {
  Habit,
  HabitLog,
  HabitUnit,
  TimeOfDay,
} from '@/features/habits/model/habit';
import type {
  DayPlanAssignment,
  DayPlanReason,
  DayPlanState,
} from '@/features/habits/model/day-plan';
import {
  computeTargetAtStep,
  computeTargetForDate,
  isScheduledOn,
  progressionStep,
  type IsoDate,
} from '@/lib/date';

/** Pozycja listy „Dziś": nawyk, jego cel na dziś i ewentualny wpis. */
export type TodayTask = {
  habit: Habit;
  date: IsoDate;
  /** Cel wyliczony z progresji nawyku, przycięty sufitem. */
  target: number;
  /**
   * O ile cel urósł względem poprzedniego kroku progresji. 0, gdy nawyk stoi
   * w miejscu albo dobił do sufitu.
   */
  targetDelta: number;
  /** Wpis z dzisiaj albo null, gdy jeszcze nie odhaczono. */
  log: HabitLog | null;
  /** Czy pozycja jest zaliczona (done albo partial). */
  isCompleted: boolean;
  /** Czy użytkownik świadomie pominął ten dzień. */
  isSkipped: boolean;
  /** Trwała klasyfikacja planu; overflow bez wykonania jest neutralny. */
  planState: DayPlanState;
  planReason: DayPlanReason;
};

/**
 * Składa listę na dany dzień z trzech kawałków: nawyków, wpisów z tego dnia
 * i liczników wykonań.
 *
 * Czysta funkcja — całe „co dziś widać" da się przetestować bez sieci.
 *
 * Cel bierzemy ze snapshotu w logu, jeśli log istnieje. Inaczej zmiana
 * ustawień nawyku w ciągu dnia przesuwałaby cel pod już odhaczonym wpisem.
 */
export function buildTodayTasks(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  completedCounts: ReadonlyMap<string, number>,
  date: IsoDate,
  assignments: ReadonlyMap<string, DayPlanAssignment> = new Map(),
): TodayTask[] {
  const logByHabitId = new Map(logs.map((log) => [log.habitId, log]));

  return habits
    .filter((habit) => {
      const log = logByHabitId.get(habit.id) ?? null;
      const decided = log !== null;

      return (
        (habit.archivedAt === null &&
          habit.retiredAt === null &&
          isScheduledOn(habit, date)) ||
        decided
      );
    })
    .map((habit) => {
      const log = logByHabitId.get(habit.id) ?? null;
      const plan = assignments.get(habit.id);
      const completedCount = completedCounts.get(habit.id) ?? 0;
      const target =
        log?.targetValue ??
        plan?.target ??
        computeTargetForDate(habit, date, completedCount);

      const step = progressionStep(habit, date, completedCount);
      const previousTarget = computeTargetAtStep(habit, step - 1);

      return {
        habit,
        date,
        target,
        targetDelta: step > 0 ? Math.max(0, target - previousTarget) : 0,
        log,
        isCompleted: log !== null && (log.status === 'done' || log.status === 'partial'),
        isSkipped: log?.status === 'skipped',
        planState: plan?.state ?? 'planned',
        planReason: plan?.reason ?? 'legacy_fallback',
      };
    })
    .sort((left, right) => {
      const leftOrder = assignments.get(left.habit.id)?.sortOrder ?? left.habit.sortOrder;
      const rightOrder =
        assignments.get(right.habit.id)?.sortOrder ?? right.habit.sortOrder;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.habit.title.localeCompare(right.habit.title);
    });
}

// Sufit dnia -----------------------------------------------------------------

/** Ta sama wartość co domyślna w kolumnie profiles.daily_ceiling. */
export const DEFAULT_DAILY_CEILING = 5;

/**
 * Ile minut kosztuje pozycja bez jednostki czasu.
 *
 * Ryczałt zamiast pytania użytkownika o czas trwania każdego nawyku:
 * onboarding ma trwać 90 sekund, a różnica między „10 pompek" a „20 pompek"
 * i tak nie zmienia decyzji o tym, co się dziś mieści.
 */
const FLAT_ESTIMATE_MINUTES = 3;

const BAND_ORDER: Record<TimeOfDay, number> = { morning: 0, afternoon: 1, evening: 2 };

/**
 * Szacowany czas w minutach dla pary jednostka + wartość.
 *
 * Osobno od `estimateMinutes`, bo ten sam rachunek jest potrzebny przy
 * propozycjach modelu, gdzie nie ma jeszcze nawyku ani wpisu — a dwie kopie
 * ryczałtu rozjechałyby się przy pierwszej zmianie.
 */
export function estimateUnitMinutes(unit: HabitUnit, value: number): number {
  switch (unit) {
    case 'minutes':
      return Math.max(0, value);
    case 'seconds':
      return Math.max(0, value / 60);
    default:
      return FLAT_ESTIMATE_MINUTES;
  }
}

/** Szacowany czas pozycji w minutach. */
export function estimateMinutes(task: TodayTask): number {
  return estimateUnitMinutes(task.habit.unit, task.target);
}

/** Czy pora tej pozycji już minęła. Bez znanej pory „teraz" — nic nie jest spóźnione. */
function isPastBand(task: TodayTask, band: TimeOfDay | null): boolean {
  const taskBand = task.habit.timeOfDay;
  if (band === null || taskBand === null) return false;

  return BAND_ORDER[taskBand] < BAND_ORDER[band];
}

/** Pozycja, o której użytkownik już zdecydował — odhaczył albo świadomie pominął. */
function isDecided(task: TodayTask): boolean {
  return task.isCompleted || task.isSkipped;
}

export type DailyCeilingResult = {
  visible: TodayTask[];
  /** Nadmiar: zostaje w danych, ale nie ma odznaki, licznika ani koloru. */
  overflow: TodayTask[];
};

/**
 * Przycina listę na dziś do tego, co się w tym dniu jeszcze mieści.
 *
 * Dwa limity naraz: sztuk (ustawienie profilu) i minut (to, co zostało
 * z okna). Pozycje, o których użytkownik już zdecydował, zostają zawsze
 * i nie zajmują ani minut, ani miejsca w limicie sztuk ponad to, które
 * już zajęły — dzięki temu odhaczenie nigdy nie wypycha innej pozycji.
 *
 * Kolejność wypadania: najpierw pozycje z porą dnia, która już minęła,
 * potem od najdłuższych. Pozycja, która się nie mieści, nie zamyka listy —
 * krótsze po niej nadal dostają szansę, bo lepiej pokazać dwie rzeczy
 * na dziesięć minut niż jedną na czterdzieści.
 *
 * Wynik zachowuje kolejność wejściową; przestawiamy tylko to, co wypada.
 *
 * @param remainingMinutes minuty, które jeszcze zostają; Infinity, gdy
 *   użytkownik nie ma budżetu dnia i ogranicza go sam sufit sztuk
 * @param band pora dnia „teraz"; null, gdy nieznana
 */
export function applyDailyCeiling(
  tasks: readonly TodayTask[],
  ceiling: number,
  remainingMinutes: number,
  band: TimeOfDay | null = null,
): DailyCeilingResult {
  const decidedCount = tasks.filter(isDecided).length;
  const slots = Math.max(0, Math.trunc(ceiling) - decidedCount);

  const keepOrder = [...tasks]
    .filter((task) => !isDecided(task))
    .sort((left, right) => {
      const lateDifference =
        Number(isPastBand(left, band)) - Number(isPastBand(right, band));
      if (lateDifference !== 0) return lateDifference;

      const lengthDifference = estimateMinutes(left) - estimateMinutes(right);
      if (lengthDifference !== 0) return lengthDifference;

      return left.habit.sortOrder - right.habit.sortOrder;
    });

  const kept = new Set<string>();
  let budget = remainingMinutes;

  for (const task of keepOrder) {
    if (kept.size >= slots || budget <= 0) break;

    const minutes = estimateMinutes(task);
    if (minutes > budget) continue;

    budget -= minutes;
    kept.add(task.habit.id);
  }

  const visible: TodayTask[] = [];
  const overflow: TodayTask[] = [];

  for (const task of tasks) {
    if (isDecided(task) || kept.has(task.habit.id)) {
      visible.push(task);
    } else {
      overflow.push(task);
    }
  }

  return { visible, overflow };
}
