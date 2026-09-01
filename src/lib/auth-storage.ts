import { createMMKV } from 'react-native-mmkv';

/**
 * Magazyn sesji auth.
 *
 * Wydzielony z klienta Supabase, żeby moduły, które tylko czytają zapisaną
 * sesję, nie musiały ciągnąć za sobą całego klienta.
 */
export const AUTH_SESSION_STORAGE_KEY = 'tarento.auth.session';

export const authStorage = createMMKV({ id: 'tarento.auth' });

/** Adapter pod interfejs storage z supabase-js (dozwolone synchroniczne). */
export const supabaseAuthStorage = {
  getItem: (key: string): string | null => authStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    authStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    authStorage.remove(key);
  },
};
