import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Card, EmptyState, Skeleton, Text, usePressClass } from '@/components/ui';
import { readingSourceKey } from '@/features/paths/components/reading-source';
import type { PathReading, PathStage } from '@/features/paths/model/schemas';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';

export type StageReadingsProps = {
  stage: PathStage;
  readings: readonly PathReading[];
  isLoading: boolean;
  hasError: boolean;
  onOpen: (reading: PathReading) => void;
};

function ReadingCard({
  reading,
  onOpen,
}: {
  reading: PathReading;
  onOpen: (reading: PathReading) => void;
}) {
  const { t } = useTranslation();
  const pressClass = usePressClass();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('path.readings.openLabel', { title: reading.title })}
      onPress={() => {
        onOpen(reading);
      }}
      style={CONTINUOUS_CURVE}
      className={cn(
        'min-h-12 gap-2 rounded-md border border-border bg-surface p-4',
        pressClass,
      )}
    >
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        <Text variant="caption" tone="tertiary">
          {t('path.readings.week', { week: reading.week })}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t(readingSourceKey(reading.sourceKind))}
        </Text>
      </View>
      <Text variant="bodyLg">{reading.title}</Text>
      {reading.author === null ? null : (
        <Text variant="caption" tone="secondary">
          {reading.author}
        </Text>
      )}
    </Pressable>
  );
}

export function StageReadings({
  stage,
  readings,
  isLoading,
  hasError,
  onOpen,
}: StageReadingsProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="title" accessibilityRole="header">
          {t('path.readings.sectionTitle')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('path.readings.currentStage', {
            ordinal: stage.ordinal,
            name: stage.name,
          })}
        </Text>
      </View>

      {isLoading ? (
        <Card className="gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-32" />
        </Card>
      ) : readings.length > 0 ? (
        readings.map((reading) => (
          <ReadingCard key={reading.id} reading={reading} onOpen={onOpen} />
        ))
      ) : hasError ? (
        <Banner tone="danger" message={t('path.readings.error')} />
      ) : (
        <Card>
          <EmptyState
            className="flex-none"
            icon="book-outline"
            title={t('path.readings.empty.title')}
            description={t('path.readings.empty.description')}
          />
        </Card>
      )}
    </View>
  );
}
