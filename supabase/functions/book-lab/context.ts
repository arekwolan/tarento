import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  budgetCeiling,
  DEFAULT_WINDOW_MINUTES,
  itemMinutes,
} from '../_shared/validate-proposal.ts';
import type { BookLabCategory, BookLabTimeOfDay } from './validator.ts';

type StructuralHabit = {
  unit: string;
  start_value: number;
  time_of_day: string | null;
  category: string | null;
};

export type BookLabContext = {
  allocatedMinutes: number;
  usedMinutes: number;
  freeMinutes: number;
  safeMinutes: number;
  hasWindow: boolean;
  bands: Record<BookLabTimeOfDay, { itemCount: number; usedMinutes: number }>;
  habits: {
    category: BookLabCategory | null;
    minutes: number;
    timeOfDay: BookLabTimeOfDay | null;
  }[];
  activePath: { exists: boolean; stageMinutes: number };
};

function timeOfDay(value: string | null): BookLabTimeOfDay | null {
  return value === 'morning' || value === 'afternoon' || value === 'evening'
    ? value
    : null;
}

function category(value: string | null): BookLabCategory | null {
  return value === 'mindfulness' ||
    value === 'health' ||
    value === 'focus' ||
    value === 'learning' ||
    value === 'relationships'
    ? value
    : null;
}

export async function loadBookLabContext(
  admin: SupabaseClient,
  userId: string,
): Promise<BookLabContext> {
  const { data: todayValue } = await admin.rpc('logical_today', { p_user_id: userId });
  const today = typeof todayValue === 'string' ? todayValue : '';
  const { data: windowValue } =
    today === ''
      ? { data: null }
      : await admin.rpc('allocated_window_minutes', { p_user_id: userId, p_date: today });
  const allocatedMinutes =
    typeof windowValue === 'number' && Number.isFinite(windowValue) && windowValue > 0
      ? Math.round(windowValue)
      : DEFAULT_WINDOW_MINUTES;

  const { data: rows } = await admin
    .from('habits')
    .select('unit, start_value, time_of_day, category')
    .eq('user_id', userId)
    .is('archived_at', null)
    .is('retired_at', null)
    .limit(50);

  const habits = (Array.isArray(rows) ? (rows as StructuralHabit[]) : []).map(
    (habit) => ({
      category: category(habit.category),
      minutes: Math.ceil(
        itemMinutes({
          title: '',
          unit:
            habit.unit === 'minutes' ||
            habit.unit === 'seconds' ||
            habit.unit === 'reps' ||
            habit.unit === 'pages' ||
            habit.unit === 'count' ||
            habit.unit === 'none'
              ? habit.unit
              : 'none',
          start_value: habit.start_value,
          increment_value: 0,
        }),
      ),
      timeOfDay: timeOfDay(habit.time_of_day),
    }),
  );
  const usedMinutes = habits.reduce((sum, habit) => sum + habit.minutes, 0);
  const freeMinutes = Math.max(0, allocatedMinutes - usedMinutes);

  const bands: BookLabContext['bands'] = {
    morning: { itemCount: 0, usedMinutes: 0 },
    afternoon: { itemCount: 0, usedMinutes: 0 },
    evening: { itemCount: 0, usedMinutes: 0 },
  };
  for (const habit of habits) {
    if (habit.timeOfDay === null) continue;
    bands[habit.timeOfDay].itemCount += 1;
    bands[habit.timeOfDay].usedMinutes += habit.minutes;
  }

  const { data: activeRows } = await admin
    .from('user_paths')
    .select('current_stage_id')
    .eq('user_id', userId)
    .eq('state', 'active')
    .limit(1);
  const activeStageId = Array.isArray(activeRows)
    ? activeRows[0]?.current_stage_id
    : null;
  const { data: activeStage } =
    typeof activeStageId === 'string'
      ? await admin
          .from('path_stages')
          .select('daily_minutes_p50')
          .eq('id', activeStageId)
          .maybeSingle()
      : { data: null };

  return {
    allocatedMinutes,
    usedMinutes,
    freeMinutes,
    safeMinutes: budgetCeiling(freeMinutes),
    hasWindow: typeof windowValue === 'number',
    bands,
    habits,
    activePath: {
      exists: typeof activeStageId === 'string',
      stageMinutes:
        typeof activeStage?.daily_minutes_p50 === 'number'
          ? activeStage.daily_minutes_p50
          : 0,
    },
  };
}
