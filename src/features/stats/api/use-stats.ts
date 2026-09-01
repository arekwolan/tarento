import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { useRestDays } from '@/features/day-budget';
import { useHabits } from '@/features/habits';
import { statsKeys } from '@/features/stats/api/keys';
import { buildObservation, type Observation } from '@/features/stats/model/observation';
import { fetchDailySummary, fetchHabitStats } from '@/features/stats/api/stats-api';
import {
  computeAdherence,
  computeDayStreaks,
  countCompleteDays,
  hasEnoughHistory,
  heatmapRange,
  toHeatmapWeeks,
  type DaySummary,
  type DayStreaks,
  type HabitStat,
  type HeatmapCell,
} from '@/features/stats/model/stats';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { STALE_TIME } from '@/lib/query-client';

/** Okno głównej liczby ekranu: „{{done}} z ostatnich 30 dni". */
export const PACE_WINDOW_DAYS = 30;

export type UseStatsResult = {
  today: IsoDate;
  /** Jedno zdanie otwierające ekran. Zawsze jest — najgorzej wariant zapasowy. */
  observation: Observation;
  /** Ile z ostatnich 30 dni domknięto w całości. Główna liczba ekranu. */
  completeDays: number;
  /** Siatka heatmapy: kolumna = tydzień, wiersz = dzień tygodnia. */
  heatmap: HeatmapCell[][];
  streaks: DayStreaks;
  /** Ułamek 0–1 albo null, gdy w oknie nic nie było zaplanowane. */
  adherence7: number | null;
  adherence30: number | null;
  habitStats: HabitStat[];
  /** Czy jest już cokolwiek do pokazania. */
  hasHistory: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: DataError | null;
  refetch: () => void;
};

const EMPTY_DAYS: DaySummary[] = [];
const EMPTY_STATS: HabitStat[] = [];

/**
 * Wszystko, co pokazuje ekran postępów.
 *
 * Dwa zapytania: dzienne agregaty (heatmapa i skuteczność liczone z tego
 * samego zestawu) oraz statystyki per nawyk.
 */
export function useStats(): UseStatsResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const { isRest } = useRestDays();
  const userId = user?.id ?? null;
  const enabled = userId !== null;
  const keyUserId = userId ?? 'anonymous';

  const { from, to } = useMemo(() => heatmapRange(today), [today]);

  const [dailyQuery, habitsQuery] = useQueries({
    queries: [
      {
        queryKey: statsKeys.daily(keyUserId, from, to),
        queryFn: () => fetchDailySummary(from, to),
        enabled,
        staleTime: STALE_TIME.today,
      },
      {
        queryKey: statsKeys.habits(keyUserId, today),
        queryFn: () => fetchHabitStats(today),
        enabled,
        staleTime: STALE_TIME.today,
      },
    ],
  });

  const days = dailyQuery.data ?? EMPTY_DAYS;
  const habitStats = habitsQuery.data ?? EMPTY_STATS;
  const { habits } = useHabits();

  const derived = useMemo(
    () => ({
      heatmap: toHeatmapWeeks(days, today, undefined, isRest),
      streaks: computeDayStreaks(days, today, isRest),
      adherence7: computeAdherence(days, 7, today),
      adherence30: computeAdherence(days, 30, today),
      completeDays: countCompleteDays(days, PACE_WINDOW_DAYS, today, isRest),
      hasHistory: hasEnoughHistory(days),
      observation: buildObservation({
        days,
        habits,
        habitStats,
        today,
        isRestDay: isRest,
      }),
    }),
    [days, habits, habitStats, today, isRest],
  );

  const firstError = dailyQuery.error ?? habitsQuery.error;

  return {
    today,
    ...derived,
    habitStats,
    isLoading: enabled && (dailyQuery.isPending || habitsQuery.isPending),
    isRefreshing:
      !dailyQuery.isPending && (dailyQuery.isFetching || habitsQuery.isFetching),
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
    refetch: () => {
      void dailyQuery.refetch();
      void habitsQuery.refetch();
    },
  };
}
