export { useDayBudget } from '@/features/day-budget/api/use-day-budget';
export type { UseDayBudgetResult } from '@/features/day-budget/api/use-day-budget';

export { useSaveDayShape } from '@/features/day-budget/api/use-save-day-shape';
export type { UseSaveDayShapeResult } from '@/features/day-budget/api/use-save-day-shape';

export { dayBudgetKeys } from '@/features/day-budget/api/keys';

export { useRestDays } from '@/features/day-budget/api/use-rest-days';
export type { UseRestDaysResult } from '@/features/day-budget/api/use-rest-days';
export { useToggleRestDay } from '@/features/day-budget/api/use-toggle-rest-day';
export type { UseToggleRestDayResult } from '@/features/day-budget/api/use-toggle-rest-day';

export { useDayWindow } from '@/features/day-budget/hooks/use-day-window';
export type { UseDayWindowResult } from '@/features/day-budget/hooks/use-day-window';

export { windowHeadline } from '@/features/day-budget/model/headline';
export type { WindowHeadline } from '@/features/day-budget/model/headline';

export { useDayShapeDraft } from '@/features/day-budget/hooks/use-day-shape-draft';
export type { UseDayShapeDraftResult } from '@/features/day-budget/hooks/use-day-shape-draft';

export { BusyBlocksStep } from '@/features/day-budget/components/busy-blocks-step';
export type { BusyBlocksStepProps } from '@/features/day-budget/components/busy-blocks-step';
export { SelfMinutesStep } from '@/features/day-budget/components/self-minutes-step';
export type { SelfMinutesStepProps } from '@/features/day-budget/components/self-minutes-step';
export { WakeSleepStep } from '@/features/day-budget/components/wake-sleep-step';
export type { WakeSleepStepProps } from '@/features/day-budget/components/wake-sleep-step';
export { RestDaysCard } from '@/features/day-budget/components/rest-days-card';

export {
  allocatedWindow,
  budgetCeiling,
  freeWindows,
  remainingSelfMinutes,
  templateForDate,
} from '@/features/day-budget/model/windows';
export type {
  BusySpan,
  DayShape,
  SelfBudget,
  TimeWindow,
} from '@/features/day-budget/model/windows';

export {
  defaultDayShape,
  MAX_BLOCKS,
  MIN_BLOCK_MINUTES,
  SELF_MINUTES_OPTIONS,
  STEP_MINUTES,
} from '@/features/day-budget/model/day-shape';
export type {
  DayAxis,
  DayShapeBlockDraft,
  DayShapeDraft,
} from '@/features/day-budget/model/day-shape';

export {
  findRestDate,
  findRestWeekday,
  isRestDay,
  restWeekdays,
} from '@/features/day-budget/model/rest';
export type { RestDay } from '@/features/day-budget/model/rest';

export type {
  DayBlock,
  DayBlockKind,
  DayRotation,
  DayTemplate,
  DayTemplateKind,
} from '@/features/day-budget/model/schemas';
