import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { useDayStreakMilestone } from '@/features/analytics';
import { useHabits, useRetiredHabits } from '@/features/habits';
import { DayUndoSheet } from '@/features/stats/components/day-undo-sheet';
import { ForecastCard } from '@/features/stats/components/forecast-card';
import { Heatmap } from '@/features/stats/components/heatmap';
import { HabitStatRow } from '@/features/stats/components/habit-stat-row';
import { ObservationLine } from '@/features/stats/components/observation-line';
import { PaceCard } from '@/features/stats/components/pace-card';
import { AdherenceCard, BuiltCard } from '@/features/stats/components/summary-cards';
import { PACE_WINDOW_DAYS, useForecasts, useStats } from '@/features/stats';
import { SelfKnowledgeSection } from '@/features/self-knowledge';
import { compareIsoDates, type IsoDate, type SupportedLocale } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';

function StatsSkeleton() {
  return (
    <View
      className="gap-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
    </View>
  );
}

/**
 * Ekran postępów otwiera się obserwacją, a nie wykresem.
 *
 * Kolejność jest tu całym produktem: jedno zdanie, potem proporcja („23
 * z ostatnich 30 dni"), potem prognoza, a wykresy dopiero pod tym — dla
 * chętnych. Seria schodzi do drugiego planu; na ekranie „Dziś" zostaje
 * główna, bo tam wypada moment kamienia milowego.
 */
export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const { show: showToast } = useToast();
  const { habits } = useHabits();
  const { builtCount } = useRetiredHabits();
  const forecasts = useForecasts();
  const {
    today,
    observation,
    completeDays,
    heatmap,
    streaks,
    adherence7,
    adherence30,
    habitStats,
    hasHistory,
    isLoading,
    isRefreshing,
    refetch,
  } = useStats();

  useDayStreakMilestone(streaks.current);

  /** Dzień wybrany długim przytrzymaniem w mapie — wejście do cofnięcia. */
  const [undoDate, setUndoDate] = useState<IsoDate | null>(null);

  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';
  const titleById = new Map(habits.map((habit) => [habit.id, habit.title]));

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refetch}
          tintColor={color('text-tertiary')}
          colors={[color('text-primary')]}
          progressBackgroundColor={color('surface')}
        />
      }
    >
      <Text variant="titleLg" accessibilityRole="header">
        {t('stats.title')}
      </Text>

      {isLoading ? <StatsSkeleton /> : null}

      {!isLoading && !hasHistory ? (
        <EmptyState
          icon="stats-chart-outline"
          title={t('stats.empty.title')}
          description={t('stats.empty.description')}
        />
      ) : null}

      {!isLoading && hasHistory ? (
        <>
          <ObservationLine observation={observation} />

          <PaceCard
            done={completeDays}
            total={PACE_WINDOW_DAYS}
            longestStreak={streaks.longest}
          />

          <ForecastCard entries={forecasts} locale={locale} />

          <Heatmap
            weeks={heatmap}
            today={today}
            locale={locale}
            onLongPressDay={(day) => {
              // Przyszłość nie ma czego cofać.
              if (compareIsoDates(day, today) > 0) return;
              setUndoDate(day);
            }}
          />
          <AdherenceCard last7={adherence7} last30={adherence30} />
          {builtCount === 0 ? null : <BuiltCard count={builtCount} />}

          {habitStats.length === 0 ? null : (
            <View className="gap-3">
              <Text variant="label" tone="secondary" className="mt-5">
                {t('stats.habits.title')}
              </Text>
              {habitStats.map((stat) => (
                <HabitStatRow
                  key={stat.habitId}
                  title={titleById.get(stat.habitId) ?? ''}
                  stat={stat}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {!isLoading ? <SelfKnowledgeSection locale={locale} /> : null}

      <DayUndoSheet
        date={undoDate}
        locale={locale}
        onClose={() => {
          setUndoDate(null);
        }}
        onCleared={(undo) => {
          showToast({
            message: t('stats.dayUndo.toast'),
            action: { label: t('common.undo'), onPress: undo },
          });
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
