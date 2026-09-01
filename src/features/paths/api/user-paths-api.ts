import {
  endedPathRowSchema,
  userPathPracticeRowSchema,
  userPathRowSchema,
  type UserPath,
  type UserPathPractice,
} from '@/features/paths/model/schemas';
import type { EndedPath } from '@/features/paths/model/repeat';
import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

/**
 * Zapytania o zapis użytkownika na ścieżkę. Tylko odczyt: zapis, przejście
 * etapu i wycofanie praktyki dotykają naraz `user_paths`, `habits`
 * i `user_path_practices`, więc idą jedną transakcją po stronie bazy, a nie
 * serią żądań z klienta.
 */

const USER_PATH_COLUMNS =
  'id, user_id, path_id, state, current_stage_id, stage_entered_on, started_on, ' +
  'paused_at, ended_at, ended_reason, reentry_until, fit, created_at, updated_at';

const USER_PATH_PRACTICE_COLUMNS =
  'id, user_path_id, practice_id, habit_id, user_id, activated_on, retired_on';

/**
 * Zapisy, które jeszcze się nie skończyły: aktywny i wstrzymane.
 *
 * Wstrzymane muszą wejść do tego samego zapytania, bo ekran ścieżki nie ma
 * innej drogi, żeby pokazać przycisk „Wznów". Aktywna jest najwyżej jedna
 * (pilnuje tego indeks częściowy), wstrzymanych może być kilka.
 */
export async function fetchOpenUserPaths(): Promise<UserPath[]> {
  const { data, error } = await supabase
    .from('user_paths')
    .select(USER_PATH_COLUMNS)
    .in('state', ['active', 'paused'])
    .order('created_at', { ascending: false });

  if (error !== null) throw toDataError(error);

  return userPathRowSchema.array().parse(data);
}

/** Ile zakończonych ścieżek pamiętamy na potrzeby karencji. */
const ENDED_PATHS_LIMIT = 20;

/**
 * Zakończone ścieżki użytkownika razem ze slugiem.
 *
 * Slug, a nie id: karencja dotyczy ścieżki, a nie konkretnej wersji treści,
 * którą ktoś akurat przechodził.
 */
export async function fetchEndedPaths(): Promise<EndedPath[]> {
  const { data, error } = await supabase
    .from('user_paths')
    .select('id, path_id, ended_at, paths!inner(slug, title)')
    .eq('state', 'ended')
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(ENDED_PATHS_LIMIT);

  if (error !== null) throw toDataError(error);

  return endedPathRowSchema.array().parse(data);
}

/**
 * Most między praktykami ścieżki a nawykami użytkownika — razem z tymi już
 * wycofanymi, bo to one mówią, co ścieżka zdjęła z listy i kiedy.
 */
export async function fetchUserPathPractices(
  userPathId: string,
): Promise<UserPathPractice[]> {
  const { data, error } = await supabase
    .from('user_path_practices')
    .select(USER_PATH_PRACTICE_COLUMNS)
    .eq('user_path_id', userPathId)
    .order('activated_on', { ascending: true });

  if (error !== null) throw toDataError(error);

  return userPathPracticeRowSchema.array().parse(data);
}
