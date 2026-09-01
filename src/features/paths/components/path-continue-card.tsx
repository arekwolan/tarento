import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Skeleton, Text } from '@/components/ui';
import type { PathContinue } from '@/features/paths/model/reading';

export type PathContinueCardProps = {
  continuation: PathContinue;
  onPress: (continuation: PathContinue) => void;
};

/** Pierwsza sekcja Biblioteki — tylko dla ścieżki aktywnej w tej chwili. */
export function PathContinueCard({ continuation, onPress }: PathContinueCardProps) {
  const { t } = useTranslation();

  return (
    <Card variant="raised" className="gap-3">
      <Text variant="label" tone="secondary">
        {t('path.continue.title')}
      </Text>

      <View className="gap-1">
        <Text variant="title">{continuation.title}</Text>
        <Text variant="body" tone="secondary">
          {t('path.stage', {
            ordinal: continuation.stage.ordinal,
            name: continuation.stage.name,
          })}
        </Text>
        <Text variant="caption" tone="accent">
          {t('path.continue.progress', {
            current: continuation.stage.ordinal,
            total: continuation.totalStages,
          })}
        </Text>
      </View>

      <Button
        label={t('path.continue.action')}
        onPress={() => {
          onPress(continuation);
        }}
      />
    </Card>
  );
}

export function PathContinueSkeleton() {
  return (
    <Card variant="raised" className="gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-full rounded-md" />
    </Card>
  );
}
