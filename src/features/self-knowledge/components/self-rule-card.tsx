import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Text } from '@/components/ui';
import { SelfRuleStatement } from '@/features/self-knowledge/components/self-rule-statement';
import type {
  SelfRule,
  SelfRuleDecision,
} from '@/features/self-knowledge/model/self-rule';
import { formatRelativeDay, type SupportedLocale } from '@/lib/date';

export type SelfRuleCardProps = {
  rule: SelfRule;
  habitTitle: string;
  locale: SupportedLocale;
  isPending: boolean;
  onDecide: (decision: SelfRuleDecision) => void;
  onDelete: () => void;
};

export function SelfRuleCard({
  rule,
  habitTitle,
  locale,
  isPending,
  onDecide,
  onDelete,
}: SelfRuleCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="label" tone="secondary">
          {t(`selfKnowledge.types.${rule.ruleType}`)}
        </Text>
        <SelfRuleStatement rule={rule} habitTitle={habitTitle} />
      </View>

      <Text variant="caption" tone="tertiary">
        {t('selfKnowledge.evidence', {
          count: rule.sampleSize,
          from: formatRelativeDay(rule.rangeStart, locale),
          to: formatRelativeDay(rule.rangeEnd, locale),
          version: rule.algorithmVersion,
        })}
      </Text>
      <Text variant="caption" tone="tertiary">
        {t('selfKnowledge.caution')}
      </Text>

      {rule.reviewRequiredAt === null ? null : (
        <Banner message={t('selfKnowledge.reviewRequired')} />
      )}

      {rule.status === 'candidate' ? (
        <View className="gap-2">
          <Button
            label={t('selfKnowledge.actions.accept')}
            variant="secondary"
            disabled={isPending}
            onPress={() => {
              onDecide('accept');
            }}
          />
          <Button
            label={t('selfKnowledge.actions.reject')}
            variant="ghost"
            disabled={isPending}
            onPress={() => {
              onDecide('reject');
            }}
          />
        </View>
      ) : null}

      {rule.status === 'accepted' && rule.reviewRequiredAt !== null ? (
        <View className="gap-2">
          <Button
            label={t('selfKnowledge.actions.keepAfterReview')}
            variant="secondary"
            disabled={isPending}
            onPress={() => {
              onDecide('review_keep');
            }}
          />
          <Button
            label={t('selfKnowledge.actions.expire')}
            variant="ghost"
            disabled={isPending}
            onPress={() => {
              onDecide('expire');
            }}
          />
        </View>
      ) : null}

      {rule.status === 'accepted' ? (
        <Button
          label={t('selfKnowledge.actions.delete')}
          variant="ghost"
          disabled={isPending}
          onPress={onDelete}
        />
      ) : null}
    </Card>
  );
}
