import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { trackEvent } from '@/features/analytics';
import { useAuth, useLogicalToday } from '@/features/auth';
import { selfKnowledgeKeys } from '@/features/self-knowledge/api/keys';
import {
  decideSelfRule,
  fetchSelfRuleEvidence,
  fetchSelfRules,
  setSelfRuleArchived,
  syncSelfRuleCandidates,
} from '@/features/self-knowledge/api/self-rules-api';
import { buildSelfRuleCandidates } from '@/features/self-knowledge/model/candidate-engine';
import {
  acceptedSelfRuleContexts,
  createSelfRuleRequestId,
  SELF_RULE_WINDOW_DAYS,
  type SelfRule,
  type SelfRuleDecision,
} from '@/features/self-knowledge/model/self-rule';
import { toDataError, type DataError } from '@/lib/data-error';
import { addDays, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type DecideSelfRuleVariables = {
  userId: string;
  rule: SelfRule;
  action: SelfRuleDecision;
  effectiveOn: IsoDate;
  requestId: string;
};
export type ArchiveSelfRuleVariables = {
  userId: string;
  rule: SelfRule;
  archived: boolean;
  effectiveOn: IsoDate;
  requestId: string;
};
type MutationContext = { previous: SelfRule[] | undefined };

const writeDecision: MutationFunction<SelfRule, DecideSelfRuleVariables> = (variables) =>
  decideSelfRule({
    ruleId: variables.rule.id,
    action: variables.action,
    effectiveOn: variables.effectiveOn,
    requestId: variables.requestId,
  });

const writeArchive: MutationFunction<SelfRule, ArchiveSelfRuleVariables> = (variables) =>
  setSelfRuleArchived({
    ruleId: variables.rule.id,
    archived: variables.archived,
    effectiveOn: variables.effectiveOn,
    requestId: variables.requestId,
  });

function replaceRule(rules: readonly SelfRule[], updated: SelfRule): SelfRule[] {
  return rules.map((rule) => (rule.id === updated.id ? updated : rule));
}

const decisionDefaults = {
  mutationFn: writeDecision,
  async onMutate(variables: DecideSelfRuleVariables): Promise<MutationContext> {
    const key = selfKnowledgeKeys.rules(variables.userId);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<SelfRule[]>(key);
    queryClient.setQueryData<SelfRule[]>(key, (current = []) =>
      current.map((rule) => {
        if (rule.id !== variables.rule.id) return rule;
        if (variables.action === 'accept') {
          return { ...rule, status: 'accepted', reviewRequiredAt: null };
        }
        if (variables.action === 'reject') {
          return { ...rule, status: 'rejected', reviewRequiredAt: null };
        }
        if (variables.action === 'expire') {
          return { ...rule, status: 'expired', reviewRequiredAt: null };
        }
        return { ...rule, reviewRequiredAt: null };
      }),
    );
    return { previous };
  },
  onError(
    _error: unknown,
    variables: DecideSelfRuleVariables,
    context: MutationContext | undefined,
  ) {
    queryClient.setQueryData(selfKnowledgeKeys.rules(variables.userId), context?.previous);
  },
  onSuccess(rule: SelfRule, variables: DecideSelfRuleVariables) {
    queryClient.setQueryData<SelfRule[]>(
      selfKnowledgeKeys.rules(variables.userId),
      (current = []) => replaceRule(current, rule),
    );
  },
  onSettled() {
    void queryClient.invalidateQueries({ queryKey: selfKnowledgeKeys.all });
  },
};

const archiveDefaults = {
  mutationFn: writeArchive,
  async onMutate(variables: ArchiveSelfRuleVariables): Promise<MutationContext> {
    const key = selfKnowledgeKeys.rules(variables.userId);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<SelfRule[]>(key);
    queryClient.setQueryData<SelfRule[]>(key, (current = []) =>
      variables.archived
        ? current.filter((rule) => rule.id !== variables.rule.id)
        : [...current, { ...variables.rule, archivedAt: null }],
    );
    return { previous };
  },
  onError(
    _error: unknown,
    variables: ArchiveSelfRuleVariables,
    context: MutationContext | undefined,
  ) {
    queryClient.setQueryData(selfKnowledgeKeys.rules(variables.userId), context?.previous);
  },
  onSettled() {
    void queryClient.invalidateQueries({ queryKey: selfKnowledgeKeys.all });
  },
};

export function registerSelfRuleMutationDefaults(): void {
  queryClient.setMutationDefaults(selfKnowledgeKeys.decide(), decisionDefaults);
  queryClient.setMutationDefaults(selfKnowledgeKeys.archive(), archiveDefaults);
}

export type UseSelfRulesResult = {
  rules: SelfRule[];
  candidates: SelfRule[];
  accepted: SelfRule[];
  refreshCandidates: () => void;
  decide: (rule: SelfRule, action: SelfRuleDecision) => void;
  archive: (rule: SelfRule) => void;
  restore: (rule: SelfRule) => void;
  isLoading: boolean;
  isRefreshingCandidates: boolean;
  isPending: boolean;
  isQueued: boolean;
  error: DataError | null;
};

export function useSelfRules(): UseSelfRulesResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const key = selfKnowledgeKeys.rules(userId ?? 'anonymous');
  const query = useQuery({
    queryKey: key,
    queryFn: fetchSelfRules,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });
  const syncMutation = useMutation({
    mutationKey: selfKnowledgeKeys.sync(),
    mutationFn: async () => {
      const evidence = await fetchSelfRuleEvidence(
        addDays(today, -SELF_RULE_WINDOW_DAYS),
        addDays(today, -1),
      );
      return syncSelfRuleCandidates({
        candidates: buildSelfRuleCandidates(evidence),
        effectiveOn: today,
      });
    },
    onSuccess: (rules) => {
      queryClient.setQueryData(key, rules);
    },
  });
  const decisionMutation = useMutation<
    SelfRule,
    Error,
    DecideSelfRuleVariables,
    MutationContext
  >({ mutationKey: selfKnowledgeKeys.decide() });
  const archiveMutation = useMutation<
    SelfRule,
    Error,
    ArchiveSelfRuleVariables,
    MutationContext
  >({ mutationKey: selfKnowledgeKeys.archive() });

  const rules = query.data ?? [];
  const firstError =
    query.error ?? syncMutation.error ?? decisionMutation.error ?? archiveMutation.error;

  return {
    rules,
    candidates: rules.filter((rule) => rule.status === 'candidate'),
    accepted: acceptedSelfRuleContexts(rules),
    refreshCandidates: () => {
      syncMutation.mutate();
    },
    decide: (rule, action) => {
      if (userId === null) return;
      trackEvent('self_rule_answered', {
        rule_type: rule.ruleType,
        action:
          action === 'accept'
            ? 'accepted'
            : action === 'reject'
              ? 'rejected'
              : action === 'review_keep'
                ? 'reviewed'
                : 'expired',
      });
      decisionMutation.mutate({
        userId,
        rule,
        action,
        effectiveOn: today,
        requestId: createSelfRuleRequestId(),
      });
    },
    archive: (rule) => {
      if (userId === null) return;
      archiveMutation.mutate({
        userId,
        rule,
        archived: true,
        effectiveOn: today,
        requestId: createSelfRuleRequestId(),
      });
    },
    restore: (rule) => {
      if (userId === null) return;
      archiveMutation.mutate({
        userId,
        rule,
        archived: false,
        effectiveOn: today,
        requestId: createSelfRuleRequestId(),
      });
    },
    isLoading: userId !== null && query.isPending,
    isRefreshingCandidates: syncMutation.isPending,
    isPending: decisionMutation.isPending || archiveMutation.isPending,
    isQueued: decisionMutation.isPaused || archiveMutation.isPaused,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
  };
}
