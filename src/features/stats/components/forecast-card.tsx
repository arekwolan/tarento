import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits';
import type { ForecastEntry } from '@/features/stats/api/use-forecasts';
import { formatFullDay, type SupportedLocale } from '@/lib/date';

export type ForecastCardProps = {
  entries: readonly ForecastEntry[];
  locale: SupportedLocale;
};

/**
 * Prognoza zamiast oceny.
 *
 * Zamiast pokazywać, czego użytkownik nie zrobił, pokazujemy, co się stanie,
 * jeśli nic nie zmieni. Patrzenie w przód jest tanie i zmienia ton całego
 * ekranu — a nawyk bez tempa po prostu nie ma tu linii.
 */
export function ForecastCard({ entries, locale }: ForecastCardProps) {
  const { t } = useTranslation();

  if (entries.length === 0) return null;

  return (
    <Card className="gap-2">
      <Text variant="label" tone="secondary">
        {t('stats.forecast.title')}
      </Text>

      <View className="gap-2">
        {entries.map((entry) => {
          const unitKey = targetUnitKey(entry.unit);

          return (
            <Text key={entry.habitId} variant="body" tone="secondary">
              {t('stats.forecast.line', {
                title: entry.title,
                target: formatTargetValue(entry.target),
                unit: unitKey === null ? '' : ` ${t(unitKey)}`,
                date: formatFullDay(entry.date, locale),
              })}
            </Text>
          );
        })}
      </View>
    </Card>
  );
}
