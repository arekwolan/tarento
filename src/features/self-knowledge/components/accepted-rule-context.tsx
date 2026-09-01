import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Chip, Text } from '@/components/ui';
import { trackEvent } from '@/features/analytics';
import { useHabits } from '@/features/habits';
import { useSelfRules } from '@/features/self-knowledge/api/use-self-rules';
import { SelfRuleStatement } from '@/features/self-knowledge/components/self-rule-statement';

/** Jawny, wyłączalny kontekst. Nie zmienia samodzielnie żadnego pola planu. */
export function AcceptedRuleContext() {
  const { t } = useTranslation();
  const { habits } = useHabits();
  const { accepted } = useSelfRules();
  const [disabledIds, setDisabledIds] = useState<readonly string[]>([]);
  const titleById = new Map(habits.map((habit) => [habit.id, habit.title]));
  const visible = accepted.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <Card variant="outlined" className="gap-3">
      <View className="gap-1">
        <Text variant="label" tone="secondary">
          {t('selfKnowledge.context.title')}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t('selfKnowledge.context.description')}
        </Text>
      </View>
      {visible.map((rule) => {
        const enabled = !disabledIds.includes(rule.id);
        return (
          <View key={rule.id} className="gap-2">
            {enabled ? (
              <SelfRuleStatement
                rule={rule}
                habitTitle={titleById.get(rule.subjectHabitId) ?? t('common.habit')}
                compact
              />
            ) : null}
            <Chip
              label={t(
                enabled
                  ? 'selfKnowledge.context.disable'
                  : 'selfKnowledge.context.enable',
              )}
              selected={enabled}
              accessibilityLabel={t('selfKnowledge.context.accessibility', {
                state: t(
                  enabled
                    ? 'selfKnowledge.context.enabled'
                    : 'selfKnowledge.context.disabled',
                ),
              })}
              onPress={() => {
                trackEvent('self_rule_context_toggled', {
                  rule_type: rule.ruleType,
                  action: enabled ? 'disabled' : 'enabled',
                });
                setDisabledIds((current) =>
                  enabled
                    ? [...current, rule.id]
                    : current.filter((id) => id !== rule.id),
                );
              }}
            />
          </View>
        );
      })}
    </Card>
  );
}
