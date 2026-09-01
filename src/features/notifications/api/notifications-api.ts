import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type {
  PlannedReminder,
  ScheduledReminder,
} from '@/features/notifications/model/plan';

export const ANDROID_CHANNEL_ID = 'habit-reminders';

/** Znacznik w payloadzie, po którym poznajemy własne powiadomienia. */
const REMINDER_MARKER = 'tarento.reminder';

/**
 * Powiadomienie ma się pokazać także wtedy, gdy aplikacja jest otwarta —
 * inaczej przypomnienie o 7:00 przepadłoby komuś, kto akurat scrolluje listę.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toPermissionState(
  status: Notifications.NotificationPermissionsStatus,
): PermissionState {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export async function getNotificationPermission(): Promise<PermissionState> {
  return toPermissionState(await Notifications.getPermissionsAsync());
}

/**
 * Pyta system o zgodę.
 *
 * Wołane dopiero po ekranie, który tłumaczy po co — systemowy dialog pada
 * raz, więc nie wypalamy go na wejściu.
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Tarento',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    });
  }

  return toPermissionState(await Notifications.requestPermissionsAsync());
}

/** Payload, który sami wkładamy do powiadomienia. */
type ReminderData = { marker: string; key: string; habitId: string };

function readReminderData(value: unknown): ReminderData | null {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  if (record.marker !== REMINDER_MARKER) return null;
  if (typeof record.key !== 'string' || typeof record.habitId !== 'string') return null;

  return { marker: REMINDER_MARKER, key: record.key, habitId: record.habitId };
}

/**
 * Zaplanowane przypomnienia Tarento.
 *
 * Filtrujemy po markerze, bo `cancelAllScheduledNotificationsAsync` skasowałby
 * także cudze wpisy, gdyby aplikacja kiedyś planowała coś jeszcze.
 */
export async function getScheduledReminders(): Promise<ScheduledReminder[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  return scheduled.flatMap((notification) => {
    const data = readReminderData(notification.content.data);
    return data === null ? [] : [{ identifier: notification.identifier, key: data.key }];
  });
}

export async function cancelReminders(identifiers: readonly string[]): Promise<void> {
  for (const identifier of identifiers) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
}

export async function scheduleReminders(
  reminders: readonly PlannedReminder[],
): Promise<void> {
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        data: {
          marker: REMINDER_MARKER,
          key: reminder.key,
          habitId: reminder.habitId,
        } satisfies ReminderData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: ANDROID_CHANNEL_ID,
        date: reminder.fireAt,
      },
    });
  }
}

/** Kasuje wszystkie przypomnienia Tarento — używane przy wyłączeniu globalnym. */
export async function cancelAllReminders(): Promise<void> {
  const scheduled = await getScheduledReminders();
  await cancelReminders(scheduled.map((reminder) => reminder.identifier));
}

/** Czy odpowiedź systemu dotyczy naszego przypomnienia. */
export function isReminderResponse(
  response: Notifications.NotificationResponse | null,
): boolean {
  if (response === null) return false;
  return readReminderData(response.notification.request.content.data) !== null;
}
