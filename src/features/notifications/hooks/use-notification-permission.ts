import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getNotificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from '@/features/notifications/api/notifications-api';

export type UseNotificationPermissionResult = {
  status: PermissionState | null;
  isRequesting: boolean;
  /** Pokazuje systemowy dialog. Wołaj dopiero po ekranie z wyjaśnieniem. */
  request: () => Promise<PermissionState>;
};

export function useNotificationPermission(): UseNotificationPermissionResult {
  const [status, setStatus] = useState<PermissionState | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void getNotificationPermission().then((current) => {
        if (!cancelled) setStatus(current);
      });
    };

    refresh();

    // Zgodę można cofnąć w ustawieniach systemu, nie wychodząc z aplikacji —
    // po powrocie na wierzch pytamy jeszcze raz.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const request = useCallback(async () => {
    setIsRequesting(true);
    try {
      const next = await requestNotificationPermission();
      setStatus(next);
      return next;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return { status, isRequesting, request };
}
