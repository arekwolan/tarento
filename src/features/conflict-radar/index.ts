export { useProtocolConflictRadar } from '@/features/conflict-radar/api/use-protocol-conflict-radar';
export { ConflictRadarSection } from '@/features/conflict-radar/components/conflict-radar-section';
export type { ConflictRadarSectionProps } from '@/features/conflict-radar/components/conflict-radar-section';
export { createConflictRequestId } from '@/features/conflict-radar/model/request-id';
export {
  canActivateConflictReview,
  protocolConflictContextSchema,
  protocolConflictDecisionSchema,
  protocolConflictReviewSchema,
  protocolConflictTypeSchema,
} from '@/features/conflict-radar/model/schemas';
export type {
  ProtocolConflict,
  ProtocolConflictContext,
  ProtocolConflictDecision,
  ProtocolConflictReview,
  ProtocolConflictType,
} from '@/features/conflict-radar/model/schemas';
