export { selfKnowledgeKeys } from '@/features/self-knowledge/api/keys';
export {
  registerSelfRuleMutationDefaults,
  useSelfRules,
} from '@/features/self-knowledge/api/use-self-rules';
export type { UseSelfRulesResult } from '@/features/self-knowledge/api/use-self-rules';
export { buildSelfRuleCandidates } from '@/features/self-knowledge/model/candidate-engine';
export {
  acceptedSelfRuleContexts,
  createSelfRuleRequestId,
  SELF_RULE_ALGORITHM_VERSION,
  SELF_RULE_MAX_CANDIDATES,
  SELF_RULE_MIN_COMPARATIVE_OPPORTUNITIES,
  SELF_RULE_MIN_FRICTION_EVENTS,
  SELF_RULE_MIN_RATE_GAP,
  SELF_RULE_REEVALUATE_DAYS,
  SELF_RULE_WINDOW_DAYS,
} from '@/features/self-knowledge/model/self-rule';
export type {
  SelfRule,
  SelfRuleCandidate,
  SelfRuleDecision,
  SelfRuleEvidence,
  SelfRuleEvidenceRow,
  SelfRuleStatus,
  SelfRuleType,
} from '@/features/self-knowledge/model/self-rule';
export { AcceptedRuleContext } from '@/features/self-knowledge/components/accepted-rule-context';
export { SelfKnowledgeSection } from '@/features/self-knowledge/components/self-knowledge-section';
