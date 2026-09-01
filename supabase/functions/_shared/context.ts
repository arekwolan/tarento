import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { DEFAULT_WINDOW_MINUTES } from './validate-proposal.ts';

/**
 * Kontekst, którego model nigdy nie dostaje od klienta.
 *
 * Model nie dostaje pustej kartki (IDEAS.md §C): w promptcie zawsze jest okno
 * w minutach i lista nawyków, które użytkownik już prowadzi. Gdyby te dane
 * przychodziły z aplikacji, budżet dałoby się rozszerzyć podmieniając ciało
 * żądania — dlatego czyta je funkcja, kluczem service_role.
 */

export type ContextHabit = { title: string; unit: string };

export type UserContext = {
  /** Doba logiczna użytkownika, wyliczona przez public.logical_today(). */
  today: string;
  /** Okno w minutach. Przy braku kształtu dnia — wartość domyślna. */
  allocatedMinutes: number;
  /** Czy okno pochodzi z deklaracji użytkownika, czy z wartości domyślnej. */
  hasWindow: boolean;
  /** Niezarchiwizowane i niezdjęte nawyki. */
  habits: ContextHabit[];
};

const MAX_HABITS_IN_PROMPT = 20;

export async function loadUserContext(
  admin: SupabaseClient,
  userId: string,
): Promise<UserContext> {
  const { data: todayValue } = await admin.rpc('logical_today', { p_user_id: userId });
  const today = typeof todayValue === 'string' ? todayValue : '';

  const { data: windowValue } =
    today === ''
      ? { data: null }
      : await admin.rpc('allocated_window_minutes', {
          p_user_id: userId,
          p_date: today,
        });

  const allocated =
    typeof windowValue === 'number' && Number.isFinite(windowValue) && windowValue > 0
      ? Math.round(windowValue)
      : null;

  const { data: habitRows } = await admin
    .from('habits')
    .select('title, unit')
    .eq('user_id', userId)
    .is('archived_at', null)
    .is('retired_at', null)
    .order('sort_order', { ascending: true })
    .limit(MAX_HABITS_IN_PROMPT);

  const habits = Array.isArray(habitRows)
    ? habitRows.flatMap((row: { title?: unknown; unit?: unknown }) =>
        typeof row.title === 'string' && typeof row.unit === 'string'
          ? [{ title: row.title.slice(0, 120), unit: row.unit }]
          : [],
      )
    : [];

  return {
    today,
    allocatedMinutes: allocated ?? DEFAULT_WINDOW_MINUTES,
    hasWindow: allocated !== null,
    habits,
  };
}
