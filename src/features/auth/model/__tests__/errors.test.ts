import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import {
  AuthFailure,
  authErrorKeyOf,
  toAuthErrorKey,
} from '@/features/auth/model/errors';
import { validationMessageKey } from '@/features/auth/model/validation-messages';

/**
 * Wymóg: żaden surowy komunikat z Supabase nie może trafić na ekran.
 * Te testy pilnują, że każde wejście wychodzi jako klucz i18n.
 */
describe('mapowanie błędów auth', () => {
  it.each([
    ['invalid_credentials', 'auth.errors.invalidCredentials'],
    ['email_not_confirmed', 'auth.errors.emailNotConfirmed'],
    ['user_already_exists', 'auth.errors.emailExists'],
    ['anonymous_provider_disabled', 'auth.errors.guestDisabled'],
    ['otp_expired', 'auth.errors.linkExpired'],
    ['over_email_send_rate_limit', 'auth.errors.tooManyEmails'],
  ])('kod %s -> %s', (code, expected) => {
    const error = new AuthApiError('Invalid login credentials', 400, code);
    expect(toAuthErrorKey(error)).toBe(expected);
  });

  it('nieznany kod ląduje na komunikacie ogólnym', () => {
    const error = new AuthApiError('Something new', 400, 'brand_new_code_from_future');
    expect(toAuthErrorKey(error)).toBe('auth.errors.unknown');
  });

  it('5xx to niedostępny serwer, nie „coś poszło nie tak"', () => {
    const error = new AuthApiError('Bad gateway', 502, undefined);
    expect(toAuthErrorKey(error)).toBe('auth.errors.serverUnavailable');
  });

  it('429 bez kodu to limit żądań', () => {
    const error = new AuthApiError('Too many', 429, undefined);
    expect(toAuthErrorKey(error)).toBe('auth.errors.tooManyRequests');
  });

  it.each([
    ['AuthRetryableFetchError', new AuthRetryableFetchError('Failed to fetch', 0)],
    ['TypeError z fetcha', new TypeError('Network request failed')],
    ['zwykły Error o sieci', new Error('Network request failed')],
  ])('brak sieci rozpoznany: %s', (_label, error) => {
    expect(toAuthErrorKey(error)).toBe('auth.errors.network');
  });

  it('cokolwiek innego też daje klucz, nie surowy string', () => {
    expect(toAuthErrorKey('jakiś string')).toBe('auth.errors.unknown');
    expect(toAuthErrorKey(null)).toBe('auth.errors.unknown');
    expect(toAuthErrorKey({ message: 'Invalid login credentials' })).toBe(
      'auth.errors.unknown',
    );
  });

  it('AuthFailure niesie klucz dalej', () => {
    const failure = new AuthFailure(new AuthApiError('nope', 400, 'invalid_credentials'));
    expect(authErrorKeyOf(failure)).toBe('auth.errors.invalidCredentials');
  });
});

describe('komunikaty walidacji', () => {
  it('znany klucz przechodzi bez zmian', () => {
    expect(validationMessageKey('auth.validation.emailInvalid')).toBe(
      'auth.validation.emailInvalid',
    );
  });

  it('brak komunikatu to brak błędu', () => {
    expect(validationMessageKey(undefined)).toBeUndefined();
  });

  it('nieznany komunikat nie przecieka na ekran', () => {
    expect(validationMessageKey('String must contain at least 8 character(s)')).toBe(
      'auth.errors.unknown',
    );
  });
});
