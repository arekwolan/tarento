import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Divider, Text } from '@/components/ui';
import type { PathPractice, PathStage } from '@/features/paths/model/schemas';

export type StageCardProps = {
  stage: PathStage;
  /** Praktyki tego etapu, w kolejności. */
  practices: readonly PathPractice[];
};

/**
 * Etap na ekranie ścieżki: nazwa, opis, minuty i to, co dochodzi.
 *
 * Każda praktyka pokazuje „po co", nie „jak" — na ekranie wyboru liczy się
 * powód, instrukcja przyda się dopiero, gdy praktyka będzie już na liście.
 *
 * Bez stałych wysokości i bez kolumn: przy fontScale 1.3 lista sześciu
 * praktyk musi móc urosnąć w dół.
 */
export function StageCard({ stage, practices }: StageCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="title">
          {t('path.stage', { ordinal: stage.ordinal, name: stage.name })}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t('path.stageMinutes', { minutes: stage.dailyMinutesP50 })}
        </Text>
      </View>

      <Text variant="body" tone="secondary">
        {stage.description}
      </Text>

      {stage.environmentSetup === null ? null : (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t('path.stageSetup')}
          </Text>
          <Text variant="body" tone="secondary">
            {stage.environmentSetup}
          </Text>
        </View>
      )}

      {practices.length === 0 ? null : (
        <>
          <Divider />
          <View className="gap-3">
            {practices.map((practice) => (
              <View key={practice.id} className="gap-1">
                <Text variant="bodyLg">{practice.title}</Text>
                <Text variant="caption" tone="secondary">
                  {practice.why}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {stage.transitionCriterion === null ? null : (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t('path.stageTransition')}
          </Text>
          <Text variant="caption" tone="secondary">
            {stage.transitionCriterion}
          </Text>
        </View>
      )}
    </Card>
  );
}
