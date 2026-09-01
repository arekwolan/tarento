import { useTranslation } from 'react-i18next';

import { Card, StreakGrid, Text, type StreakGridCell } from '@/components/ui';
import type { HeatmapCell } from '@/features/stats/model/stats';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type IsoDate, type SupportedLocale } from '@/lib/date';
import type { StreakLevel } from '@/theme';

/**
 * Mapa dni na ekranie postępów.
 *
 * Cała warstwa wizualna siedzi w <StreakGrid>; tutaj zostaje wyłącznie
 * mapowanie domenowe: poziom → etykieta dostępności, dzień → podpis wiersza.
 */

/** Podpisy wierszy: pn, śr, pt. Reszta zostaje pusta, żeby nie zagracać. */
const ROW_LABELS: readonly (TranslationKey | null)[] = [
  'dayShort.mon',
  null,
  'dayShort.wed',
  null,
  'dayShort.fri',
  null,
  null,
];

const LEVEL_LABEL: Record<StreakLevel, TranslationKey> = {
  0: 'stats.heatmap.level.none',
  1: 'stats.heatmap.level.quarter',
  2: 'stats.heatmap.level.half',
  3: 'stats.heatmap.level.most',
  4: 'stats.heatmap.level.all',
};

export type HeatmapProps = {
  weeks: HeatmapCell[][];
  today: IsoDate;
  locale: SupportedLocale;
  /** Długie przytrzymanie na dniu — wejście do cofnięcia dnia. */
  onLongPressDay?: (day: IsoDate) => void;
};

export function Heatmap({ weeks, today, locale, onLongPressDay }: HeatmapProps) {
  const { t } = useTranslation();

  const gridWeeks: StreakGridCell[][] = weeks.map((week) =>
    week.map((cell) => {
      const date = formatFullDay(cell.day, locale);
      const isPending = cell.day === today && !cell.isRest;

      // Dzień pusty wygląda jak dzień bez danych, więc jedyne, co go
      // odróżnia, to etykieta dla czytnika ekranu.
      const level = cell.isRest
        ? t('rest.dayLabel')
        : t(cell.level === null ? 'stats.heatmap.level.empty' : LEVEL_LABEL[cell.level]);

      return {
        key: cell.day,
        level: cell.level,
        pending: isPending,
        accessibilityLabel: isPending
          ? t('stats.heatmap.cellToday', { date })
          : t('stats.heatmap.cell', { date, level }),
      };
    }),
  );

  return (
    <Card className="gap-4">
      <Text variant="label" tone="secondary">
        {t('stats.heatmap.title')}
      </Text>

      <StreakGrid
        weeks={gridWeeks}
        onLongPressDay={onLongPressDay}
        longPressHint={onLongPressDay === undefined ? undefined : t('stats.dayUndo.hint')}
        rowLabels={ROW_LABELS.map((key) => (key === null ? '' : t(key)))}
        legend={{
          less: t('stats.heatmap.legendLess'),
          more: t('stats.heatmap.legendMore'),
        }}
      />
    </Card>
  );
}
