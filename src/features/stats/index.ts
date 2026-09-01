export { PACE_WINDOW_DAYS, useStats } from '@/features/stats/api/use-stats';
export type { UseStatsResult } from '@/features/stats/api/use-stats';
export { useForecasts } from '@/features/stats/api/use-forecasts';
export type { ForecastEntry } from '@/features/stats/api/use-forecasts';
export { buildObservation, forecastDate } from '@/features/stats/model/observation';
export type {
  Observation,
  ObservationHabit,
  ObservationInput,
  ObservationKey,
} from '@/features/stats/model/observation';
export { statsKeys } from '@/features/stats/api/keys';
export { useDayUndo } from '@/features/stats/api/use-day-undo';
export type { UseDayUndoResult } from '@/features/stats/api/use-day-undo';
export { DayUndoSheet } from '@/features/stats/components/day-undo-sheet';
export type { DayUndoSheetProps } from '@/features/stats/components/day-undo-sheet';
export { fetchDailySummary } from '@/features/stats/api/stats-api';
export { countCompleteDays } from '@/features/stats/model/stats';
export type {
  DaySummary,
  DayStreaks,
  HabitStat,
  HeatmapCell,
  IsRestDay,
} from '@/features/stats/model/stats';
