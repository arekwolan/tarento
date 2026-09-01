import { useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';

import { exchangeAuthCode, restoreSessionFromTokens } from '@/features/auth/api/auth-api';
import { authErrorKeyOf, type AuthErrorKey } from '@/features/auth/model/errors';

/** Wyciąga parametry auth z query i z fragmentu — Supabase używa obu. */
function authParamsOf(url: string): URLSearchParams {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  const query =
    queryStart === -1
      ? ''
      : url.slice(queryStart + 1, hashStart > queryStart ? hashStart : undefined);
  const fragment = hashStart === -1 ? '' : url.slice(hashStart + 1);

  return new URLSearchParams([query, fragment].filter((part) => part !== '').join('&'));
}

/**
 * Domyka linki wracające z maila: potwierdzenie rejestracji, magic link
 * i reset hasła.
 *
 * Przy PKCE Supabase oddaje `?code=`, przy starszym przepływie tokeny
 * w `#access_token`. Obsługujemy oba, bo link mógł zostać wysłany wcześniej.
 */
export function useAuthDeepLinks(): { errorKey: AuthErrorKey | null } {
  const url = Linking.useURL();
  const [exchangeErrorKey, setExchangeErrorKey] = useState<AuthErrorKey | null>(null);
  const handled = useRef(new Set<string>());

  const params = useMemo(() => authParamsOf(url ?? ''), [url]);

  // Błąd zapisany wprost w adresie jest funkcją adresu — nie trzymamy go
  // w stanie, tylko wyliczamy.
  const hasErrorInUrl = params.get('error_code') !== null || params.get('error') !== null;

  useEffect(() => {
    if (url === null || hasErrorInUrl || handled.current.has(url)) return;
    handled.current.add(url);

    const code = params.get('code');
    if (code !== null) {
      void exchangeAuthCode(code)
        .then(() => {
          setExchangeErrorKey(null);
        })
        .catch((error: unknown) => {
          setExchangeErrorKey(authErrorKeyOf(error));
        });
      return;
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken !== null && refreshToken !== null) {
      void restoreSessionFromTokens(accessToken, refreshToken)
        .then(() => {
          setExchangeErrorKey(null);
        })
        .catch((error: unknown) => {
          setExchangeErrorKey(authErrorKeyOf(error));
        });
    }
  }, [url, hasErrorInUrl, params]);

  return { errorKey: hasErrorInUrl ? 'auth.errors.linkExpired' : exchangeErrorKey };
}
