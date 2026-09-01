import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { AuthFailure } from '@/features/auth/model/errors';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with Apple.
 *
 * STATUS: struktura gotowa, credentiale NIE skonfigurowane. Do uruchomienia
 * brakuje jeszcze:
 *   1. Service ID + klucz Sign in with Apple w Apple Developer,
 *   2. providera `apple` włączonego w projekcie Supabase
 *      (lokalnie: sekcja [auth.external.apple] w supabase/config.toml),
 *   3. `usesAppleSignIn: true` w ios w app.config.ts (entitlement).
 *
 * Do tego czasu przycisk nie jest renderowany na żadnym ekranie —
 * isAppleSignInAvailable() istnieje po to, żeby go włączyć jedną zmianą.
 *
 * Apple wymaga tej metody dopiero wtedy, gdy w aplikacji jest inny social
 * login. Dziś nie ma żadnego, więc nic nie blokuje wysyłki.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<void> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (credential.identityToken === null) {
      throw new Error('Apple nie zwróciło identityToken.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error !== null) throw error;
  } catch (error) {
    throw new AuthFailure(error);
  }
}
