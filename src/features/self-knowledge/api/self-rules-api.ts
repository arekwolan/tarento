import {
  selfRuleEvidenceRowSchema,
  selfRuleRowSchema,
  type SelfRule,
  type SelfRuleCandidate,
  type SelfRuleDecision,
  type SelfRuleEvidenceRow,
} from '@/features/self-knowledge/model/self-rule';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const RULE_COLUMNS =
  'id, user_id, rule_key, rule_type, subject_habit_id, status, algorithm_version, ' +
  'conclusion_key, evidence_snapshot, evidence_hash, sample_size, range_start, ' +
  'range_end, reevaluate_on, review_required_at, archived_at, created_at, updated_at';

export async function fetchSelfRules(): Promise<SelfRule[]> {
  const { data, error } = await supabase
    .from('self_rules')
    .select(RULE_COLUMNS)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error !== null) throw toDataError(error);
  return selfRuleRowSchema.array().parse(data);
}

export async function fetchSelfRuleEvidence(
  from: IsoDate,
  to: IsoDate,
): Promise<SelfRuleEvidenceRow[]> {
  const { data, error } = await supabase.rpc('get_self_rule_evidence', {
    p_from: from,
    p_to: to,
  });
  if (error !== null) throw toDataError(error);
  return selfRuleEvidenceRowSchema.array().parse(data);
}

export async function syncSelfRuleCandidates(input: {
  candidates: readonly SelfRuleCandidate[];
  effectiveOn: IsoDate;
}): Promise<SelfRule[]> {
  const { data, error } = await supabase.rpc('sync_self_rule_candidates', {
    p_candidates: input.candidates.map((candidate) => ({
      rule_type: candidate.ruleType,
      subject_habit_id: candidate.subjectHabitId,
      preferred_value: candidate.preferredValue,
      comparison_value: candidate.comparisonValue,
      preferred_completed: candidate.preferredCompleted,
      preferred_opportunities: candidate.preferredOpportunities,
      comparison_completed: candidate.comparisonCompleted,
      comparison_opportunities: candidate.comparisonOpportunities,
      range_start: candidate.rangeStart,
      range_end: candidate.rangeEnd,
    })),
    p_effective_on: input.effectiveOn,
  });
  if (error !== null) throw toDataError(error);
  return selfRuleRowSchema.array().parse(data);
}

export async function decideSelfRule(input: {
  ruleId: string;
  action: SelfRuleDecision;
  effectiveOn: IsoDate;
  requestId: string;
}): Promise<SelfRule> {
  const { data, error } = await supabase.rpc('decide_self_rule', {
    p_rule_id: input.ruleId,
    p_action: input.action,
    p_effective_on: input.effectiveOn,
    p_idempotency_key: input.requestId,
  });
  if (error !== null) throw toDataError(error);
  return selfRuleRowSchema.parse(data);
}

export async function setSelfRuleArchived(input: {
  ruleId: string;
  archived: boolean;
  effectiveOn: IsoDate;
  requestId: string;
}): Promise<SelfRule> {
  const { data, error } = await supabase.rpc('set_self_rule_archived', {
    p_rule_id: input.ruleId,
    p_archived: input.archived,
    p_effective_on: input.effectiveOn,
    p_idempotency_key: input.requestId,
  });
  if (error !== null) throw toDataError(error);
  return selfRuleRowSchema.parse(data);
}
