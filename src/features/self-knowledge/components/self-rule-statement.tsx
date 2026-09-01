import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { SelfRule } from '@/features/self-knowledge/model/self-rule';
import type { TranslationKey } from '@/i18n/keys';

const VALUE_KEYS: Record<string, TranslationKey> = {
  morning: 'selfKnowledge.values.morning',
  afternoon: 'selfKnowledge.values.afternoon',
  evening: 'selfKnowledge.values.evening',
  smaller: 'selfKnowledge.values.smaller',
  larger: 'selfKnowledge.values.larger',
  workday: 'selfKnowledge.values.workday',
  free: 'selfKnowledge.values.free',
  night_shift: 'selfKnowledge.values.nightShift',
  care: 'selfKnowledge.values.care',
  custom: 'selfKnowledge.values.custom',
  forgot: 'selfKnowledge.values.forgot',
  no_time: 'selfKnowledge.values.noTime',
  too_big: 'selfKnowledge.values.tooBig',
  wrong_time: 'selfKnowledge.values.wrongTime',
  environment: 'selfKnowledge.values.environment',
  not_today: 'selfKnowledge.values.notToday',
  minimal: 'selfKnowledge.values.minimal',
  standard: 'selfKnowledge.values.standard',
  before: 'selfKnowledge.values.before',
  after: 'selfKnowledge.values.after',
};

export type SelfRuleStatementProps = {
  rule: SelfRule;
  habitTitle: string;
  compact?: boolean;
};

export function SelfRuleStatement({
  rule,
  habitTitle,
  compact = false,
}: SelfRuleStatementProps) {
  const { t } = useTranslation();
  const preferredKey = VALUE_KEYS[rule.evidence.preferred_value];
  const comparisonValue = rule.evidence.comparison_value;
  const comparisonKey =
    comparisonValue === undefined ? undefined : VALUE_KEYS[comparisonValue];
  const preferred = preferredKey === undefined ? '' : t(preferredKey);
  const comparison = comparisonKey === undefined ? '' : t(comparisonKey);

  if (compact) {
    return (
      <Text variant="caption" tone="secondary">
        {t('selfKnowledge.context.included', { habit: habitTitle, preferred })}
      </Text>
    );
  }

  return (
    <Text variant="body" tone="secondary">
      {rule.ruleType === 'friction'
        ? t('selfKnowledge.statement.friction', {
            habit: habitTitle,
            reason: preferred,
            count: rule.evidence.preferred_opportunities,
          })
        : t('selfKnowledge.statement.comparison', {
            habit: habitTitle,
            preferred,
            preferredCompleted: rule.evidence.preferred_completed,
            preferredTotal: rule.evidence.preferred_opportunities,
            comparison,
            comparisonCompleted: rule.evidence.comparison_completed,
            comparisonTotal: rule.evidence.comparison_opportunities,
          })}
    </Text>
  );
}
