import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';

export type PaceCardProps = {
  /** Ile dni z okna domknięto w całości. */
  done: number;
  /** Długość okna w dniach. */
  total: number;
  longestStreak: number;
};

/**
 * Główna liczba ekranu postępów: proporcja, nie seria.
 *
 * Proporcja przeżywa pominięty dzień, seria umiera — a ekran, który po jednym
 * słabym dniu pokazuje zero, mówi nieprawdę o dwóch miesiącach pracy. Seria
 * zostaje, ale schodzi pod spód: na ekranie „Dziś" wciąż jest główna, bo tam
 * wypada moment kamienia milowego.
 */
export function PaceCard({ done, total, longestStreak }: PaceCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <View
        className="gap-1"
        accessible
        accessibilityLabel={t('stats.pace.accessibility', { done, total })}
      >
        <Text variant="display">{String(done)}</Text>
        <Text variant="num" tone="secondary">
          {t('stats.pace.window', { total })}
        </Text>
      </View>

      <Text variant="caption" tone="tertiary">
        {t('stats.pace.longest', { days: longestStreak })}
      </Text>
    </Card>
  );
}
