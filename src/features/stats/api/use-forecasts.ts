import { useMemo } from 'react';

import { useLogicalToday } from '@/features/auth';
import { useHabitPlanProgress, useHabits, type HabitUnit } from '@/features/habits';
import { forecastDate } from '@/features/stats/model/observation';
import type { IsoDate } from '@/lib/date';

export type ForecastEntry = {
  habitId: string;
  title: string;
  target: number;
  unit: HabitUnit;
  /** Dzień, w którym nawyk dobije do sufitu. */
  date: IsoDate;
};

/**
 * Prognozy dla nawyków, które da się prognozować.
 *
 * Tylko progresja kalendarzowa z sufitem: przy trybie „po wykonaniu" tempo
 * zależy od użytkownika, a nie od kalendarza, więc data byłaby zmyślona.
 * Nawyk bez tempa albo już przy suficie po prostu nie wchodzi na listę —
 * nie pokazujemy „nigdy".
 */
export function useForecasts(): ForecastEntry[] {
  const today = useLogicalToday();
  const { habits } = useHabits();
  const expectedCounts = useHabitPlanProgress();

  return useMemo(
    () =>
      habits.flatMap((habit) => {
        const date = forecastDate(habit, today, expectedCounts.get(habit.id));
        if (date === null || habit.targetValue === null) return [];

        return [
          {
            habitId: habit.id,
            title: habit.title,
            target: habit.targetValue,
            unit: habit.unit,
            date,
          },
        ];
      }),
    [habits, today, expectedCounts],
  );
}
