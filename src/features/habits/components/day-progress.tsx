import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProgressBar, Text } from '@/components/ui';

export type DayProgressProps = {
  done: number;
  total: number;
};

/** „3 z 5 wykonanych" plus cienki pasek. Informuje, nie świętuje. */
export function DayProgress({ done, total }: DayProgressProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <Text variant="num" tone="secondary">
        {t('today.progress.label', { done, total })}
      </Text>
      <ProgressBar
        value={total === 0 ? 0 : done / total}
        accessibilityLabel={t('today.progress.accessibility', { done, total })}
      />
    </View>
  );
}
