import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Text, useToast } from '@/components/ui';
import { useHabits } from '@/features/habits';
import { SelfRuleCard } from '@/features/self-knowledge/components/self-rule-card';
import { useSelfRules } from '@/features/self-knowledge/api/use-self-rules';
import type { SupportedLocale } from '@/lib/date';

export type SelfKnowledgeSectionProps = { locale: SupportedLocale };

export function SelfKnowledgeSection({ locale }: SelfKnowledgeSectionProps) {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const { habits } = useHabits();
  const {
    rules,
    candidates,
    refreshCandidates,
    decide,
    archive,
    restore,
    isLoading,
    isRefreshingCandidates,
    isPending,
    error,
  } = useSelfRules();
  const titleById = new Map(habits.map((habit) => [habit.id, habit.title]));
  const visible = rules.filter(
    (rule) => rule.status === 'candidate' || rule.status === 'accepted',
  );

  if (isLoading) {
    return (
      <View className="mt-6 gap-3">
        <Text variant="title" accessibilityRole="header">
          {t('selfKnowledge.title')}
        </Text>
        <Card>
          <Text variant="body" tone="secondary">
            {t('common.loading')}
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View className="mt-6 gap-3">
      <View className="gap-1">
        <Text variant="title" accessibilityRole="header">
          {t('selfKnowledge.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('selfKnowledge.description')}
        </Text>
      </View>

      {error === null ? null : <Banner tone="danger" message={t('selfKnowledge.error')} />}

      {visible.length === 0 ? (
        <Card className="gap-3">
          <Text variant="body" tone="secondary">
            {t(
              candidates.length === 0
                ? 'selfKnowledge.empty'
                : 'selfKnowledge.noVisibleRules',
            )}
          </Text>
          <Button
            label={t('selfKnowledge.actions.analyze')}
            variant="secondary"
            loading={isRefreshingCandidates}
            disabled={isRefreshingCandidates}
            onPress={refreshCandidates}
          />
        </Card>
      ) : (
        <>
          <Button
            label={t('selfKnowledge.actions.recheck')}
            variant="secondary"
            loading={isRefreshingCandidates}
            disabled={isRefreshingCandidates || isPending}
            onPress={refreshCandidates}
          />
          {visible.map((rule) => (
            <SelfRuleCard
              key={rule.id}
              rule={rule}
              habitTitle={titleById.get(rule.subjectHabitId) ?? t('common.habit')}
              locale={locale}
              isPending={isPending}
              onDecide={(decision) => {
                decide(rule, decision);
              }}
              onDelete={() => {
                archive(rule);
                showToast({
                  message: t('selfKnowledge.deleted'),
                  action: {
                    label: t('common.undo'),
                    onPress: () => {
                      restore(rule);
                    },
                  },
                });
              }}
            />
          ))}
        </>
      )}
    </View>
  );
}
