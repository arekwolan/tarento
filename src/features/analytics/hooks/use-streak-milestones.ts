import { useEffect } from 'react';
import { createMMKV } from 'react-native-mmkv';

import { trackEvent } from '@/features/analytics/api/telemetry';
import { reachedMilestone } from '@/features/analytics/model/events';
import type { HabitStreak } from '@/features/habits/model/habit';

const milestoneStorage = createMMKV({ id: 'tarento.milestones' });

function lastReported(key: string): number {
  return milestoneStorage.getNumber(key) ?? 0;
}

/**
 * Zgłasza przekroczenie progu serii.
 *
 * Ostatnio zgłoszony próg trzymamy lokalnie, bo inaczej każde wejście na
 * ekran wysyłałoby to samo zdarzenie od nowa. Zapisujemy tylko liczbę —
 * żadnej treści nawyku.
 */
export function useHabitStreakMilestones(
  streaks: ReadonlyMap<string, HabitStreak>,
): void {
  useEffect(() => {
    for (const [habitId, streak] of streaks) {
      const milestone = reachedMilestone(streak.currentStreak);
      if (milestone === null) continue;

      const key = `habit:${habitId}`;
      if (milestone <= lastReported(key)) continue;

      milestoneStorage.set(key, milestone);
      trackEvent('streak_milestone', { days: milestone, scope: 'habit' });
    }
  }, [streaks]);
}

/** To samo dla serii liczonej na poziomie dnia — zna ją ekran postępów. */
export function useDayStreakMilestone(dayStreak: number): void {
  useEffect(() => {
    const milestone = reachedMilestone(dayStreak);
    if (milestone === null) return;

    const key = 'day';
    if (milestone <= lastReported(key)) return;

    milestoneStorage.set(key, milestone);
    trackEvent('streak_milestone', { days: milestone, scope: 'day' });
  }, [dayStreak]);
}
