import { useCallback, useState } from 'react';

import { authErrorKeyOf, type AuthErrorKey } from '@/features/auth/model/errors';

export type AuthActionState = {
  isPending: boolean;
  /** Klucz i18n błędu z ostatniej próby. */
  errorKey: AuthErrorKey | null;
  /** Uruchamia akcję; zwraca true, gdy się udała. */
  run: (action: () => Promise<void>) => Promise<boolean>;
  clearError: () => void;
};

/**
 * Stan pojedynczej akcji auth: trwa / nie trwa, ostatni błąd jako klucz i18n.
 * Żaden surowy komunikat z Supabase nie wychodzi stąd na ekran.
 */
export function useAuthAction(): AuthActionState {
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    setIsPending(true);
    setErrorKey(null);
    try {
      await action();
      return true;
    } catch (error) {
      setErrorKey(authErrorKeyOf(error));
      return false;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { isPending, errorKey, run, clearError };
}
