import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Błąd warstwy danych w jednym kształcie, niezależnie od tego, czy przyszedł
 * z PostgREST, z auth, czy z zerwanego połączenia.
 *
 * Nie niesie jeszcze klucza i18n — mapowanie na komunikat należy do warstwy UI
 * i przyjdzie razem z ekranami. Tutaj chodzi o to, żeby `code` i `isOffline`
 * dało się sprawdzić bez parsowania tekstu błędu.
 */
export class DataError extends Error {
  /** Kod PostgREST/Postgres (np. '42501', 'PGRST116') albo kod auth. */
  readonly code: string | null;
  /** Czy to problem z siecią, a nie odpowiedź serwera. */
  readonly isOffline: boolean;

  constructor(message: string, code: string | null, isOffline: boolean) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.isOffline = isOffline;
  }
}

function hasStringProperty<TKey extends string>(
  value: unknown,
  key: TKey,
): value is Record<TKey, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  );
}

function looksOffline(error: unknown): boolean {
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

/** Zamienia cokolwiek z catch/PostgrestError na DataError. */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;

  const isOffline = looksOffline(error);
  const code = hasStringProperty(error, 'code') ? error.code : null;
  const message = hasStringProperty(error, 'message')
    ? error.message
    : isAuthApiError(error)
      ? error.message
      : String(error);

  return new DataError(message, code, isOffline);
}
