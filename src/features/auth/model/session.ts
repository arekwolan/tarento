import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';

import { isEpochSecondsPast } from '@/lib/date';
import { AUTH_SESSION_STORAGE_KEY, authStorage } from '@/lib/auth-storage';

/**
 * Kształt sesji zapisanej przez supabase-js. Walidujemy, bo to dane
 * z zewnątrz (MMKV) — CLAUDE.md, sekcja TypeScript.
 *
 * Interesuje nas tylko tyle, ile potrzeba do decyzji „pokazać ekran
 * logowania czy nie". Resztę i tak dostarczy supabase-js.
 */
const persistedSessionSchema = z.object({
  access_token: z.string().min(1),
  expires_at: z.number().optional(),
  user: z.object({
    id: z.string().min(1),
    is_anonymous: z.boolean().optional(),
  }),
});

export type PersistedSessionHint = {
  userId: string;
  isAnonymous: boolean;
  isExpired: boolean;
};

/**
 * Synchroniczny odczyt sesji z MMKV.
 *
 * Sedno: MMKV czyta bez awaita, więc pierwszy render zna już odpowiedź na
 * pytanie „czy jest sesja". Bez tego użytkownik zobaczyłby mignięcie ekranu
 * logowania, zanim supabase-js zdąży wczytać sesję ze storage.
 *
 * To tylko podpowiedź do routingu. Źródłem prawdy pozostaje supabase-js.
 */
export function readPersistedSessionHint(): PersistedSessionHint | null {
  const raw = authStorage.getString(AUTH_SESSION_STORAGE_KEY);
  if (raw === undefined) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = persistedSessionSchema.safeParse(parsed);
  if (!result.success) return null;

  const { expires_at: expiresAt, user } = result.data;

  return {
    userId: user.id,
    isAnonymous: user.is_anonymous ?? false,
    isExpired: expiresAt !== undefined && isEpochSecondsPast(expiresAt),
  };
}

/** Czy sesja należy do gościa (konto anonimowe). */
export function isGuestSession(session: Session | null): boolean {
  return session?.user.is_anonymous ?? false;
}
