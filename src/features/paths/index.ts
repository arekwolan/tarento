export { usePaths } from '@/features/paths/api/use-paths';
export { usePrivateBookProtocols } from '@/features/paths/api/use-private-book-protocols';
export type { UsePrivateBookProtocolsResult } from '@/features/paths/api/use-private-book-protocols';
export type { UsePathsResult } from '@/features/paths/api/use-paths';

export { usePath } from '@/features/paths/api/use-path';
export type { UsePathResult } from '@/features/paths/api/use-path';

export { usePathById } from '@/features/paths/api/use-path-by-id';
export type { UsePathByIdResult } from '@/features/paths/api/use-path-by-id';

export { usePathReadings } from '@/features/paths/api/use-path-readings';
export type { UsePathReadingsResult } from '@/features/paths/api/use-path-readings';

export { usePathOrigin } from '@/features/paths/api/use-path-origin';
export type { UsePathOriginResult } from '@/features/paths/api/use-path-origin';

export { useActiveUserPath } from '@/features/paths/api/use-active-user-path';
export type { UseActiveUserPathResult } from '@/features/paths/api/use-active-user-path';

export { useUserPathPractices } from '@/features/paths/api/use-user-path-practices';
export type { UseUserPathPracticesResult } from '@/features/paths/api/use-user-path-practices';

export {
  registerPathMutationDefaults,
  useEnrollInPath,
} from '@/features/paths/api/use-enroll-in-path';
export type {
  EnrollInput,
  UseEnrollInPathResult,
} from '@/features/paths/api/use-enroll-in-path';

export { useStageAdvance } from '@/features/paths/api/use-stage-advance';
export type {
  PathCompletion,
  StageTransferCheck,
  StageTransition,
  UseStageAdvanceResult,
} from '@/features/paths/api/use-stage-advance';

export { useImplementationConfirmations } from '@/features/paths/api/use-implementation-confirmations';
export type { UseImplementationConfirmationsResult } from '@/features/paths/api/use-implementation-confirmations';

export { usePathLifecycle } from '@/features/paths/api/use-path-lifecycle';
export type { UsePathLifecycleResult } from '@/features/paths/api/use-path-lifecycle';

export { useReentryReconcile } from '@/features/paths/api/use-reentry-reconcile';

export {
  registerPathSetupMutationDefaults,
  usePathSetupActions,
} from '@/features/paths/api/use-path-setup-actions';
export type { UsePathSetupActionsResult } from '@/features/paths/api/use-path-setup-actions';

export { useEndedPaths } from '@/features/paths/api/use-ended-paths';
export type { UseEndedPathsResult } from '@/features/paths/api/use-ended-paths';

export { useRetirePractice } from '@/features/paths/api/use-retire-practice';
export type { UseRetirePracticeResult } from '@/features/paths/api/use-retire-practice';

export { pathKeys } from '@/features/paths/api/keys';
export type { PathCatalogEntry, PathDetail } from '@/features/paths/api/paths-api';
export type { PracticesDecision } from '@/features/paths/api/path-actions-api';

export { StageAdvanceSheet } from '@/features/paths/components/stage-advance-sheet';
export type { StageAdvanceSheetProps } from '@/features/paths/components/stage-advance-sheet';

export { PathTransferCard } from '@/features/paths/components/path-transfer-card';
export type { PathTransferCardProps } from '@/features/paths/components/path-transfer-card';

export { PathTransferSheet } from '@/features/paths/components/path-transfer-sheet';
export type { PathTransferSheetProps } from '@/features/paths/components/path-transfer-sheet';

export {
  PathContinueCard,
  PathContinueSkeleton,
} from '@/features/paths/components/path-continue-card';
export type { PathContinueCardProps } from '@/features/paths/components/path-continue-card';

export { StageReadings } from '@/features/paths/components/stage-readings';
export type { StageReadingsProps } from '@/features/paths/components/stage-readings';

export {
  PathReadingContent,
  PathReadingSkeleton,
} from '@/features/paths/components/path-reading-content';
export type { PathReadingContentProps } from '@/features/paths/components/path-reading-content';

export { PathFitSheet } from '@/features/paths/components/path-fit-sheet';
export type { PathFitSheetProps } from '@/features/paths/components/path-fit-sheet';

export { PathEndSheet } from '@/features/paths/components/path-end-sheet';
export type { PathEndSheetProps } from '@/features/paths/components/path-end-sheet';

export { BookProtocolProvenance } from '@/features/paths/components/book-protocol-provenance';
export type { BookProtocolProvenanceProps } from '@/features/paths/components/book-protocol-provenance';

export { BookProtocolPreviewSheet } from '@/features/paths/components/book-protocol-preview-sheet';
export type { BookProtocolPreviewSheetProps } from '@/features/paths/components/book-protocol-preview-sheet';

export {
  PathSetupActionCard,
  PathSetupActionSkeleton,
} from '@/features/paths/components/path-setup-action-card';
export type { PathSetupActionCardProps } from '@/features/paths/components/path-setup-action-card';

export {
  checkPathFit,
  deterministicPathFit,
  hasFitChanges,
  optionalPracticeIds,
  pathMinutes,
} from '@/features/paths/model/fit';
export type { FitVerdict, PathFitCheck, PathMinutes } from '@/features/paths/model/fit';

export {
  isInReentry,
  needsParameterRestore,
  REENTRY_DAYS,
  reentryUntilDate,
  scaledPractice,
  STEP_DOWN_FACTOR,
} from '@/features/paths/model/parameters';
export type { PracticeScale } from '@/features/paths/model/parameters';

export { isRepeatBlocked } from '@/features/paths/model/repeat';
export type { EndedPath } from '@/features/paths/model/repeat';

export {
  buildBookProtocolStartPreview,
  groupPathCatalog,
} from '@/features/paths/model/book-protocol';
export type {
  BookProtocolStagePreview,
  BookProtocolStartPreview,
  PathCatalogGroups,
} from '@/features/paths/model/book-protocol';

export {
  practicesForStage,
  practiceToHabitInsert,
  shouldAdvance,
} from '@/features/paths/model/stage';
export type {
  HabitInsert,
  StageAdvance,
  StageCriteria,
} from '@/features/paths/model/stage';

export {
  buildPathContinue,
  findPathReading,
  parsePathRouteParams,
  parseReadingRouteParams,
  readingParagraphs,
  readingsForStage,
} from '@/features/paths/model/reading';
export type {
  PathContinue,
  PathRouteParams,
  ReadingRouteParams,
} from '@/features/paths/model/reading';

export type {
  Path,
  PathKind,
  PathOriginKind,
  PathFit,
  PathFitAdjustment,
  PathOrigin,
  PathPractice,
  PathReading,
  PathReviewStatus,
  PathSourceType,
  PathSourceKind,
  PathStage,
  StageAdvanceResult,
  UserPath,
  UserPathEndedReason,
  UserPathPractice,
  UserPathState,
} from '@/features/paths/model/schemas';

export { createPathSetupRequestId } from '@/features/paths/model/setup-action';
export type {
  PathSetupAction,
  PathSetupActionStatus,
} from '@/features/paths/model/setup-action';

export {
  createPathTransferRequestId,
  isTransferDecisionAllowed,
  isTransferSuppressed,
  pathTransferFormSchema,
  TRANSFER_DEFER_DAYS,
  TRANSFER_EVIDENCE_MAX_LENGTH,
} from '@/features/paths/model/transfer';
export type {
  ImplementationPracticeOutcome,
  ImplementationStage,
  PathImplementationConfirmation,
  PathTransferFormValues,
  PathTransferResponse,
  PathTransferSubmitResult,
  TransferDecision,
  TransferResponse,
} from '@/features/paths/model/transfer';
