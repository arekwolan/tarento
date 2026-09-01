import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, usePressClass } from '@/components/ui';
import type { PathCatalogEntry } from '@/features/paths/api/paths-api';
import { pathMinutes } from '@/features/paths/model/fit';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';

export type PathCardProps = {
  entry: PathCatalogEntry;
  /** Jedno zdanie stanu, np. „Jesteś na tej ścieżce". Bez akcentu. */
  note?: string;
  onPress: (slug: string) => void;
};

/**
 * Karta katalogu: tytuł, jedno zdanie i dwie liczby.
 *
 * Bez akcentu — mosiądz jest zarezerwowany dla stanu wykonania i postępu
 * (CLAUDE.md, reguła 8). Kolor pojawia się dopiero na liście „Dziś", kiedy
 * praktyka jest odhaczona; katalog jest wyborem, nie postępem.
 */
export function PathCard({ entry, note, onPress }: PathCardProps) {
  const { t } = useTranslation();
  const pressClass = usePressClass();

  const minutes = pathMinutes(entry.stages);
  const minutesLabel =
    minutes.min === minutes.max
      ? t('path.minutesFlat', { minutes: minutes.max })
      : t('path.minutes', { min: minutes.min, max: minutes.max });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.path.title}
      onPress={() => {
        onPress(entry.path.slug);
      }}
      style={CONTINUOUS_CURVE}
      className={cn(
        'min-h-12 gap-2 rounded-md border border-border bg-surface p-4',
        pressClass,
      )}
    >
      <Text variant="title">{entry.path.title}</Text>
      <Text variant="body" tone="secondary">
        {entry.path.hook}
      </Text>

      {/* Zawijanie zamiast jednej linii: przy fontScale 1.3 dwie liczby
          i tak nie zmieszczą się obok siebie. */}
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        <Text variant="caption" tone="tertiary">
          {t('path.duration', { days: entry.path.durationDays })}
        </Text>
        <Text variant="caption" tone="tertiary">
          {minutesLabel}
        </Text>
      </View>

      {note === undefined ? null : (
        <Text variant="caption" tone="secondary">
          {note}
        </Text>
      )}
    </Pressable>
  );
}
