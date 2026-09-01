import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { isReminderResponse } from '@/features/notifications/api/notifications-api';

/**
 * Stuknięcie w przypomnienie prowadzi na ekran główny.
 *
 * Obsługujemy dwie drogi: aplikacja już działa (listener) i aplikacja
 * została dopiero uruchomiona z powiadomienia (ostatnia odpowiedź). Bez tej
 * drugiej stuknięcie z zimnego startu wyrzucałoby użytkownika tam, gdzie
 * skończył poprzednio.
 */
export function useNotificationDeepLink(): void {
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (!isReminderResponse(response)) return;
        router.navigate('/');
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (lastResponse === undefined || lastResponse === null) return;

    const identifier = lastResponse.notification.request.identifier;
    if (handled.current === identifier) return;
    handled.current = identifier;

    if (!isReminderResponse(lastResponse)) return;
    router.navigate('/');
  }, [lastResponse, router]);
}
