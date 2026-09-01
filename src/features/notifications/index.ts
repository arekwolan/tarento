export {
  cancelAllReminders,
  getNotificationPermission,
  requestNotificationPermission,
} from '@/features/notifications/api/notifications-api';
export type { PermissionState } from '@/features/notifications/api/notifications-api';

export { useNotificationPermission } from '@/features/notifications/hooks/use-notification-permission';
export type { UseNotificationPermissionResult } from '@/features/notifications/hooks/use-notification-permission';

export {
  readRemindersEnabled,
  useRemindersEnabled,
} from '@/features/notifications/hooks/use-reminders-enabled';
export type { UseRemindersEnabledResult } from '@/features/notifications/hooks/use-reminders-enabled';

export { useReminderReconcile } from '@/features/notifications/hooks/use-reminder-reconcile';
export { useQuietWeek } from '@/features/notifications/hooks/use-quiet-week';
export type { UseQuietWeekResult } from '@/features/notifications/hooks/use-quiet-week';
export { notificationKeys } from '@/features/notifications/api/keys';
export {
  isQuietWeekActive,
  nextQuietWeek,
  QUIET_COOLDOWN_DAYS,
  QUIET_THRESHOLD,
  QUIET_WEEK_DAYS,
  quietWeekEndsOn,
  shouldEnterQuietWeek,
} from '@/features/notifications/model/quiet';
export type {
  QuietDay,
  QuietWeek,
  QuietWeekContext,
} from '@/features/notifications/model/quiet';
export { useNotificationDeepLink } from '@/features/notifications/hooks/use-notification-deep-link';

export { buildReminderPlan, diffReminders } from '@/features/notifications/model/plan';
export type {
  PlannedReminder,
  ReminderDiff,
  ScheduledReminder,
} from '@/features/notifications/model/plan';

export { NotificationsCard } from '@/features/notifications/components/notifications-card';
