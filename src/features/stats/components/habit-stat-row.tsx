import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BarChart } from 'react-native-gifted-charts';

import { Card, Text } from '@/components/ui';
import { formatPercent } from '@/features/stats/components/summary-cards';
import type { HabitStat } from '@/features/stats/model/stats';
import { useTheme } from '@/theme/theme-provider';

const CHART_HEIGHT = 28;
const BAR_WIDTH = 5;
const BAR_SPACING = 3;

/** Nietrafiony dzień zostawia niski kikut — pusty słupek gubi się w tle. */
const MISSED_BAR_VALUE = 0.28;
const STREAK_VISIBLE_FROM = 2;

export type HabitStatRowProps = {
  title: string;
  stat: HabitStat;
};

/**
 * Jedna pozycja listy nawyków na ekranie postępów: mini-wykres ostatnich dni,
 * skuteczność i seria.
 *
 * Wykonany dzień dostaje akcent, nietrafiony neutralny obrys — pominięcie
 * i porażka nigdy nie są czerwone.
 */
export function HabitStatRow({ title, stat }: HabitStatRowProps) {
  const { t } = useTranslation();
  const { color } = useTheme();

  const adherence30 = stat.scheduled30 === 0 ? null : stat.completed30 / stat.scheduled30;

  const bars = stat.recentDays.map((completed) => ({
    value: completed ? 1 : MISSED_BAR_VALUE,
    frontColor: completed ? color('accent-fill') : color('streak-0'),
  }));

  return (
    <Card className="gap-3">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text variant="bodyLg" className="flex-1">
          {title}
        </Text>
        <Text variant="num" tone="secondary">
          {formatPercent(adherence30)}
        </Text>
      </View>

      {bars.length === 0 ? null : (
        <BarChart
          data={bars}
          height={CHART_HEIGHT}
          barWidth={BAR_WIDTH}
          spacing={BAR_SPACING}
          initialSpacing={0}
          barBorderRadius={2}
          maxValue={1}
          hideRules
          hideYAxisText
          hideAxesAndRules
          disableScroll
          xAxisThickness={0}
          yAxisThickness={0}
        />
      )}

      <View className="flex-row items-center gap-3">
        <Text variant="caption" tone="tertiary">
          {t('stats.habits.last30', {
            completed: stat.completed30,
            scheduled: stat.scheduled30,
          })}
        </Text>

        {stat.currentStreak >= STREAK_VISIBLE_FROM ? (
          <Text
            variant="num"
            tone="accent"
            accessibilityLabel={t('stats.habits.streak', { days: stat.currentStreak })}
          >
            {t('stats.streak.days', { days: stat.currentStreak })}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
