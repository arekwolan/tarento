import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Klient service_role i tożsamość wołającego.
 *
 * service_role omija RLS, więc funkcja sama składa kontekst, którego klient
 * nie mógłby podać bez otwarcia furtki: okno dnia, lista nawyków, licznik
 * wywołań. Klient wysyła intencję, nigdy kontekst i nigdy klucz
 * (CLAUDE.md, reguła krytyczna 1).
 */

export type AdminContext = { admin: SupabaseClient; userId: string };

export type AdminFailure = 'not_configured' | 'unauthorized';

export async function resolveAdmin(token: string): Promise<AdminContext | AdminFailure> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (supabaseUrl === '' || serviceRoleKey === '') return 'not_configured';
  if (token === '') return 'unauthorized';

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user ?? null;

  if (error !== null || user === null) return 'unauthorized';

  return { admin, userId: user.id };
}

/**
 * Ile wywołań danego rodzaju użytkownik zużył w oknie kroczącym.
 *
 * Okno kroczące zamiast kalendarzowej doby: użytkownik podróżujący między
 * strefami nie dostaje w ten sposób dodatkowej puli o północy.
 *
 * `null` znaczy, że nie udało się policzyć — wołający ma wtedy odmówić,
 * a nie puścić wywołanie „na wszelki wypadek".
 */
export async function countGenerations(
  admin: SupabaseClient,
  userId: string,
  kind: string,
  windowMs: number,
): Promise<number | null> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await admin
    .from('ai_generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', windowStart);

  return error !== null ? null : (count ?? 0);
}
