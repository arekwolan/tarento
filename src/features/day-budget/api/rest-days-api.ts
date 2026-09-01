import { restDayRowSchema, type RestDay } from '@/features/day-budget/model/rest';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const REST_DAY_COLUMNS = 'id, user_id, weekday, rest_date, created_at';

/**
 * Wszystkie deklaracje dni pustych użytkownika.
 *
 * Jedno zapytanie bez filtrowania po dacie: wierszy jest najwyżej kilka
 * (siedem dni tygodnia plus pojedyncze daty), a lista musi być pod ręką przy
 * każdym pytaniu „czy dziś aplikacja o coś prosi".
 */
export async function fetchRestDays(): Promise<RestDay[]> {
  const { data, error } = await supabase
    .from('rest_days')
    .select(REST_DAY_COLUMNS)
    .order('created_at', { ascending: true });

  if (error !== null) throw toDataError(error);

  return restDayRowSchema.array().parse(data);
}

export async function addRestWeekday(userId: string, weekday: number): Promise<RestDay> {
  const { data, error } = await supabase
    .from('rest_days')
    .insert({ user_id: userId, weekday, rest_date: null })
    .select(REST_DAY_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return restDayRowSchema.parse(data);
}

export async function addRestDate(userId: string, date: IsoDate): Promise<RestDay> {
  const { data, error } = await supabase
    .from('rest_days')
    .insert({ user_id: userId, weekday: null, rest_date: date })
    .select(REST_DAY_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return restDayRowSchema.parse(data);
}

/**
 * Kasuje deklarację. To jedno z dwóch miejsc, gdzie klient kasuje wiersz
 * fizycznie — uzasadnienie w migracji 20260826224656_rest_days.sql.
 */
export async function removeRestDay(id: string): Promise<void> {
  const { error } = await supabase.from('rest_days').delete().eq('id', id);

  if (error !== null) throw toDataError(error);
}
