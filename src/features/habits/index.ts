export { useHabits } from '@/features/habits/api/use-habits';
export type { UseHabitsResult } from '@/features/habits/api/use-habits';

export { useTodayTasks } from '@/features/habits/api/use-today-tasks';
export type { UseTodayTasksResult } from '@/features/habits/api/use-today-tasks';

export {
  registerHabitMutationDefaults,
  useToggleHabitLog,
} from '@/features/habits/api/use-toggle-habit-log';
export type {
  HabitLogMutationVariables,
  UseToggleHabitLogResult,
} from '@/features/habits/api/use-toggle-habit-log';

export { useHabitStreaks } from '@/features/habits/api/use-habit-streaks';
export type { UseHabitStreaksResult } from '@/features/habits/api/use-habit-streaks';

export { useHabitStreak } from '@/features/habits/api/use-habit-streak';
export type { UseHabitStreakResult } from '@/features/habits/api/use-habit-streak';

export { habitKeys } from '@/features/habits/api/keys';

export {
  deleteLogsForDate,
  fetchLogsForDate,
  restoreHabitLogs,
} from '@/features/habits/api/habits-api';

export { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';

export {
  applyDailyCeiling,
  buildTodayTasks,
  DEFAULT_DAILY_CEILING,
  estimateMinutes,
  estimateUnitMinutes,
} from '@/features/habits/model/today-task';
export type { DailyCeilingResult, TodayTask } from '@/features/habits/model/today-task';
export {
  createDayPlanAssignments,
  isExpectedPlanOutcome,
  reconcileDayPlanAssignments,
  visiblePlanTasks,
} from '@/features/habits/model/day-plan';
export type {
  DayPlan,
  DayPlanAssignment,
  DayPlanItem,
  DayPlanReason,
  DayPlanState,
  PlanCapacity,
} from '@/features/habits/model/day-plan';
export type {
  Habit,
  HabitLog,
  HabitLogStatus,
  HabitStreak,
  HabitUnit,
  TimeOfDay,
} from '@/features/habits/model/habit';

export { useHabit } from '@/features/habits/api/use-habit';
export type { UseHabitResult } from '@/features/habits/api/use-habit';
export {
  registerHabitRevisionMutationDefaults,
  useHabitRevisions,
} from '@/features/habits/api/use-habit-revisions';
export type {
  RestoreHabitRevisionVariables,
  UseHabitRevisionsResult,
} from '@/features/habits/api/use-habit-revisions';
export { useArchiveHabit, useSaveHabit } from '@/features/habits/api/use-habit-mutations';
export type {
  HabitEditProvenance,
  UseArchiveHabitResult,
  UseSaveHabitResult,
} from '@/features/habits/api/use-habit-mutations';
export {
  DEFAULT_HABIT_FORM,
  habitFormMessageKey,
  habitFormSchema,
  toHabitFormValues,
  toHabitWriteInput,
} from '@/features/habits/model/habit-form';
export type { HabitFormValues } from '@/features/habits/model/habit-form';
export {
  createHabitRevisionRequestId,
  habitRevisionChanges,
  habitRevisionReasonSchema,
  habitRevisionRestorePreviewSchema,
  habitRevisionRowSchema,
  habitRevisionSnapshotSchema,
  habitRevisionSourceSchema,
} from '@/features/habits/model/revision';
export type {
  HabitRevision,
  HabitRevisionChange,
  HabitRevisionReason,
  HabitRevisionRestorePreview,
  HabitRevisionSnapshot,
  HabitRevisionSource,
} from '@/features/habits/model/revision';
export { useDownshift } from '@/features/habits/api/use-downshift';
export type {
  UseDownshiftOptions,
  UseDownshiftResult,
} from '@/features/habits/api/use-downshift';
export {
  deterministicDownshift,
  DOWNSHIFT_COOLDOWN_DAYS,
  DOWNSHIFT_THRESHOLD,
  DOWNSHIFT_WINDOW_DAYS,
  scheduledCompletion,
  shouldOfferDownshift,
} from '@/features/habits/model/downshift';
export type {
  DownshiftChange,
  DownshiftContext,
  ScheduledCompletion,
} from '@/features/habits/model/downshift';
export { useRetirement } from '@/features/habits/api/use-retirement';
export type { UseRetirementResult } from '@/features/habits/api/use-retirement';
export { useRetiredHabits } from '@/features/habits/api/use-retired-habits';
export type { UseRetiredHabitsResult } from '@/features/habits/api/use-retired-habits';
export {
  isRetirementCandidate,
  RETIREMENT_COOLDOWN_DAYS,
  RETIREMENT_THRESHOLD,
  RETIREMENT_WINDOW_DAYS,
  streakEndDay,
} from '@/features/habits/model/retirement';
export type {
  LastRetirementOffer,
  RetirementContext,
} from '@/features/habits/model/retirement';
export { RetirementCard } from '@/features/habits/components/retirement-card';
export { RetiredHabitsSection } from '@/features/habits/components/retired-habits-section';

export { DownshiftCard } from '@/features/habits/components/downshift-card';
export { DownshiftSheet } from '@/features/habits/components/downshift-sheet';
export {
  HabitRevisionHistory,
  HabitRevisionRestoreSheet,
} from '@/features/habits/components/habit-revision-history';

export { useHabitsProgress } from '@/features/habits/api/use-habits-progress';
export type { UseHabitsProgressResult } from '@/features/habits/api/use-habits-progress';
export { useHabitPlanProgress } from '@/features/habits/api/use-habit-plan-progress';
