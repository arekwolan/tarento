import {
  protocolConflictReviewSchema,
  type ProtocolConflictContext,
  type ProtocolConflictDecision,
  type ProtocolConflictReview,
} from '@/features/conflict-radar/model/schemas';
import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

export async function scanProtocolConflicts(
  requestId: string,
  pathId: string,
  locale: 'pl' | 'en',
): Promise<ProtocolConflictReview> {
  const { data, error } = await supabase.functions.invoke('protocol-conflicts', {
    body: { request_id: requestId, path_id: pathId, locale },
  });
  if (error !== null) throw toDataError(error);
  return protocolConflictReviewSchema.parse(data);
}

export type ResolveProtocolConflictInput = {
  reviewId: string;
  conflictId: string;
  conflictType: ProtocolConflictReview['conflicts'][number]['type'];
  decision: ProtocolConflictDecision;
  contextA?: ProtocolConflictContext | null;
  contextB?: ProtocolConflictContext | null;
};

export async function resolveProtocolConflict(
  input: ResolveProtocolConflictInput,
): Promise<void> {
  const { error } = await supabase.rpc('resolve_protocol_conflict', {
    p_review_id: input.reviewId,
    p_conflict_id: input.conflictId,
    p_decision: input.decision,
    p_context_a: input.contextA ?? null,
    p_context_b: input.contextB ?? null,
  });
  if (error !== null) throw toDataError(error);
}
