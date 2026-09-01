import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { AUTH_SESSION_STORAGE_KEY, supabaseAuthStorage } from '@/lib/auth-storage';
import type { Database } from '@/types/database';

/**
 * URL projektu i klucz `anon` są publiczne z założenia — trafiają do bundla
 * i każdy może je odczytać. Bezpieczeństwo opiera się wyłącznie na RLS,
 * dlatego każda tabela musi mieć polityki (CLAUDE.md, reguła krytyczna 3).
 *
 * To jedyne dwie zmienne, które wolno trzymać w EXPO_PUBLIC_*. Klucz
 * service_role, klucz Gemini i cokolwiek innego idzie do sekretów
 * Edge Functions (reguła krytyczna 1).
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
  throw new Error(
    'Brak EXPO_PUBLIC_SUPABASE_URL lub EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Skopiuj .env.example do .env i uzupełnij wartości.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    storageKey: AUTH_SESSION_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    // Deep linki obsługuje Expo Router, nie supabase-js.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Odświeżanie tokenu ma sens tylko wtedy, gdy aplikacja jest na wierzchu.
 * W tle timer i tak nie chodzi wiarygodnie, a nieudane odświeżenia potrafią
 * wylogować użytkownika. Rejestrujemy raz, na poziomie modułu — klient jest
 * singletonem, więc nie ma czego sprzątać.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
