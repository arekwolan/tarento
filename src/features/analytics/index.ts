export {
  identifyUser,
  initTelemetry,
  isTelemetryConfigured,
  reportError,
  resetUser,
  trackEvent,
} from '@/features/analytics/api/telemetry';

export { reachedMilestone, STREAK_MILESTONES } from '@/features/analytics/model/events';
export type {
  AnalyticsEventName,
  AnalyticsEvents,
} from '@/features/analytics/model/events';

export { useAnalyticsIdentity } from '@/features/analytics/hooks/use-analytics-identity';
export {
  useDayStreakMilestone,
  useHabitStreakMilestones,
} from '@/features/analytics/hooks/use-streak-milestones';
export { useDayCompleteEvent } from '@/features/analytics/hooks/use-day-complete-event';
