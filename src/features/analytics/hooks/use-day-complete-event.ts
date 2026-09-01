import { useEffect, useRef } from 'react';

import { trackEvent } from '@/features/analytics/api/telemetry';
import type { TodayTask } from '@/features/habits/model/today-task';
import { isDayComplete } from '@/features/habits/model/grouping';
import type { IsoDate } from '@/lib/date';

/**
 * Zgłasza domknięcie dnia dokładnie raz na dobę.
 *
 * Bez pamięci ostatniego zgłoszonego dnia zdarzenie leciałoby przy każdym
 * wejściu na ekran po odhaczeniu ostatniej pozycji.
 */
export function useDayCompleteEvent(tasks: readonly TodayTask[], date: IsoDate): void {
  const reportedFor = useRef<IsoDate | null>(null);

  useEffect(() => {
    if (reportedFor.current === date) return;
    if (!isDayComplete(tasks)) return;

    reportedFor.current = date;
    trackEvent('day_all_complete', {
      completed: tasks.filter((task) => task.isCompleted).length,
      skipped: tasks.filter((task) => task.isSkipped).length,
    });
  }, [tasks, date]);
}
