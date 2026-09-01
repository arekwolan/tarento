import type { HabitUnit } from '@/features/habits/model/habit';
import type { TodayTask } from '@/features/habits/model/today-task';
import type { TranslationKey } from '@/i18n/keys';

export type TaskGroupKey = 'morning' | 'afternoon' | 'evening' | 'anytime';

/** Kolejność sekcji na liście — dzień idzie od rana do wieczora. */
export const TASK_GROUP_ORDER: readonly TaskGroupKey[] = [
  'morning',
  'afternoon',
  'evening',
  'anytime',
];

export type TaskGroup = {
  key: TaskGroupKey;
  tasks: TodayTask[];
};

/**
 * Dzieli listę na sekcje po `time_of_day`. Puste sekcje wypadają, żeby
 * ekran nie pokazywał nagłówków bez treści.
 */
export function groupTasksByTimeOfDay(tasks: readonly TodayTask[]): TaskGroup[] {
  const buckets = new Map<TaskGroupKey, TodayTask[]>(
    TASK_GROUP_ORDER.map((key) => [key, []]),
  );

  for (const task of tasks) {
    const key: TaskGroupKey = task.habit.timeOfDay ?? 'anytime';
    buckets.get(key)?.push(task);
  }

  return TASK_GROUP_ORDER.map((key) => ({ key, tasks: buckets.get(key) ?? [] })).filter(
    (group) => group.tasks.length > 0,
  );
}

/** Ile pozycji jest zaliczonych. Pominięte nie liczą się jako wykonane. */
export function countCompleted(tasks: readonly TodayTask[]): number {
  return tasks.filter((task) => task.isCompleted).length;
}

/**
 * Czy dzień jest domknięty.
 *
 * Pominięte pozycje domykają dzień razem z wykonanymi — użytkownik podjął
 * decyzję o każdej z nich, a o to chodzi.
 */
export function isDayComplete(tasks: readonly TodayTask[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.isCompleted || task.isSkipped);
}

/** Pora dnia do powitania. Wieczór zaczyna się o 18 i trwa do świtu. */
export function greetingBand(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Klucz i18n z etykietą jednostki. `count` i `none` nie mają skrótu —
 * przy nich pokazujemy samą liczbę albo nic.
 */
export function targetUnitKey(unit: HabitUnit): TranslationKey | null {
  switch (unit) {
    case 'minutes':
      return 'habits.units.minutes';
    case 'seconds':
      return 'habits.units.seconds';
    case 'reps':
      return 'habits.units.reps';
    case 'pages':
      return 'habits.units.pages';
    case 'count':
    case 'none':
      return null;
  }
}

/** Liczba bez zbędnych zer po przecinku: 3, 2.5, 0.25. */
export function formatTargetValue(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';
}
