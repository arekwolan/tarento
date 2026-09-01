import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import type { TranslationKey } from '@/i18n/keys';

/**
 * Klucz i18n opisujący błąd. Nigdy nie pokazujemy użytkownikowi surowego
 * `error.message` z Supabase — te teksty są po angielsku, zmieniają się
 * między wersjami i bywają techniczne.
 */
export type AuthErrorKey = Extract<TranslationKey, `auth.errors.${string}`>;

/** Kody Supabase, dla których mamy własny komunikat. */
const CODE_TO_KEY: Record<string, AuthErrorKey> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  email_exists: 'auth.errors.emailExists',
  user_already_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  same_password: 'auth.errors.samePassword',
  email_address_invalid: 'auth.errors.emailInvalid',
  email_address_not_authorized: 'auth.errors.emailNotAuthorized',
  otp_expired: 'auth.errors.linkExpired',
  flow_state_expired: 'auth.errors.linkExpired',
  flow_state_not_found: 'auth.errors.linkExpired',
  bad_code_verifier: 'auth.errors.linkExpired',
  over_email_send_rate_limit: 'auth.errors.tooManyEmails',
  over_request_rate_limit: 'auth.errors.tooManyRequests',
  signup_disabled: 'auth.errors.signupDisabled',
  email_provider_disabled: 'auth.errors.signupDisabled',
  anonymous_provider_disabled: 'auth.errors.guestDisabled',
  provider_disabled: 'auth.errors.providerDisabled',
  user_banned: 'auth.errors.userBanned',
  user_not_found: 'auth.errors.userNotFound',
  session_expired: 'auth.errors.sessionExpired',
  session_not_found: 'auth.errors.sessionExpired',
  refresh_token_not_found: 'auth.errors.sessionExpired',
  refresh_token_already_used: 'auth.errors.sessionExpired',
  validation_failed: 'auth.errors.validationFailed',
  request_timeout: 'auth.errors.network',
};

/** Czy błąd wygląda na problem z siecią, a nie odpowiedź serwera. */
function looksLikeNetworkFailure(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error instanceof TypeError) return true;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('timeout')
    );
  }

  return false;
}

/**
 * Zamienia dowolny błąd na klucz i18n. Zawsze zwraca coś sensownego —
 * nieznany kod ląduje na `auth.errors.unknown`, nigdy na surowym stringu
 * z Supabase.
 */
export function toAuthErrorKey(error: unknown): AuthErrorKey {
  if (looksLikeNetworkFailure(error)) {
    return 'auth.errors.network';
  }

  if (isAuthApiError(error)) {
    const mapped = error.code === undefined ? undefined : CODE_TO_KEY[error.code];
    if (mapped !== undefined) {
      return mapped;
    }
    if (error.status === 429) {
      return 'auth.errors.tooManyRequests';
    }
    if (error.status !== undefined && error.status >= 500) {
      return 'auth.errors.serverUnavailable';
    }
  }

  return 'auth.errors.unknown';
}

/** Błąd domenowy warstwy auth — nosi już przetłumaczalny klucz. */
export class AuthFailure extends Error {
  readonly key: AuthErrorKey;

  constructor(error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.name = 'AuthFailure';
    this.key = toAuthErrorKey(error);
  }
}

/** Wyciąga klucz i18n z czegokolwiek, co wpadło do catch. */
export function authErrorKeyOf(error: unknown): AuthErrorKey {
  return error instanceof AuthFailure ? error.key : toAuthErrorKey(error);
}
