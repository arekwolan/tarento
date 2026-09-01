import { useEffect } from 'react';

import { identifyUser, resetUser } from '@/features/analytics/api/telemetry';
import { useAuth } from '@/features/auth';

/**
 * Wiąże telemetrię z bieżącym kontem i rozwiązuje ją po wylogowaniu.
 *
 * Reset jest tu równie ważny jak identyfikacja: bez niego zdarzenia
 * kolejnego użytkownika na tym samym urządzeniu doklejałyby się do
 * poprzedniego profilu.
 */
export function useAnalyticsIdentity(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) {
      resetUser();
      return;
    }

    identifyUser(userId);
  }, [userId]);
}
