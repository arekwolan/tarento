import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Divider, ProgressBar, Text } from '@/components/ui';

/** Ułamek 0–1 → „73%". Brak danych pokazujemy kreską, nie zerem. */
export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/**
 * Ile nawyków użytkownik zbudował.
 *
 * Jedyna liczba w aplikacji, która ma rosnąć bez końca — i jedyna, która nie
 * mówi o tym, ile dziś odhaczono. Bez odznaki, bez poziomu, bez akcentu:
 * akcent niesie postęp dnia, a to jest zapis przeszłości.
 */
export function BuiltCard({ count }: { count: number }) {
  const { t } = useTranslation();

  return (
    <Card className="gap-2">
      <Text variant="label" tone="secondary">
        {t('stats.built.title')}
      </Text>
      <Text variant="numLg">{String(count)}</Text>
      <Text variant="caption" tone="tertiary">
        {t('stats.built.description')}
      </Text>
    </Card>
  );
}

export type AdherenceCardProps = {
  last7: number | null;
  last30: number | null;
};

export function AdherenceCard({ last7, last30 }: AdherenceCardProps) {
  const { t } = useTranslation();

  const rows = [
    { label: t('stats.adherence.last7'), value: last7 },
    { label: t('stats.adherence.last30'), value: last30 },
  ];

  return (
    <Card className="gap-4">
      <Text variant="label" tone="secondary">
        {t('stats.adherence.title')}
      </Text>

      {rows.map((row, index) => (
        <View key={row.label} className="gap-2">
          {index === 0 ? null : <Divider />}
          <View className="flex-row items-baseline justify-between gap-4">
            <Text variant="body" tone="secondary" className="flex-1">
              {row.label}
            </Text>
            <Text variant="num">{formatPercent(row.value)}</Text>
          </View>
          <ProgressBar value={row.value ?? 0} accessibilityLabel={row.label} />
        </View>
      ))}
    </Card>
  );
}
