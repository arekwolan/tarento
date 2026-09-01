import * as Linking from 'expo-linking';

/**
 * Adres, pod który wracają linki z maili (potwierdzenie rejestracji, magic
 * link, reset hasła). W dev buildzie to `exp://...`, w buildzie produkcyjnym
 * `tarento://...` — oba są dopuszczone w supabase/config.toml.
 */
export function authRedirectUrl(): string {
  return Linking.createURL('/auth/callback');
}
