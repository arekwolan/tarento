import type { DaySummary, HabitStat } from '@/features/stats/model/stats';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/**
 * Agregaty liczone w SQL.
 *
 * Klient nigdy nie ściąga surowych logów — z roku prowadzenia pięciu nawyków
 * zrobiłoby się z tego kilkaset kilobajtów na każde wejście na ekran.
 */
export async function fetchDailySummary(
  from: IsoDate,
  to: IsoDate,
): Promise<DaySummary[]> {
  const { data, error } = await supabase.rpc('get_daily_summary', {
    p_from: from,
    p_to: to,
  });

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => ({
    day: row.day,
    scheduled: row.scheduled,
    completed: row.completed,
  }));
}

export async function fetchHabitStats(today: IsoDate): Promise<HabitStat[]> {
  const { data, error } = await supabase.rpc('get_habit_stats', { p_today: today });

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => ({
    habitId: row.habit_id,
    scheduled7: row.scheduled_7,
    completed7: row.completed_7,
    scheduled30: row.scheduled_30,
    completed30: row.completed_30,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    recentDays: row.recent_days ?? [],
  }));
}
