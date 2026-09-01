import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLogicalToday } from '@/features/auth';
import { useRestDays } from '@/features/day-budget';
import { useHabits, useHabitsProgress, useTodayTasks } from '@/features/habits';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { Habit } from '@/features/habits/model/habit';
import {
  cancelAllReminders,
  cancelReminders,
  getNotificationPermission,
  getScheduledReminders,
  scheduleReminders,
} from '@/features/notifications/api/notifications-api';
import {
  buildReminderPlan,
  diffReminders,
  type ReminderContent,
} from '@/features/notifications/model/plan';
import { useQuietWeek } from '@/features/notifications/hooks/use-quiet-week';
import { useRemindersEnabled } from '@/features/notifications/hooks/use-reminders-enabled';
import { nowMs, systemTimeZone } from '@/lib/date';

/**
 * Strefa urządzenia, odświeżana przy powrocie aplikacji na wierzch.
 *
 * Po przelocie przez pół świata zaplanowane instanty wskazują złą porę dnia,
 * więc zmiana strefy musi wymusić przeplanowanie.
 */
function useDeviceTimeZone(): string {
  const [timeZone, setTimeZone] = useState(systemTimeZone);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setTimeZone((previous) => {
        const current = systemTimeZone();
        return current === previous ? previous : current;
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return timeZone;
}

/**
 * Utrzymuje zaplanowane powiadomienia w zgodzie z rzeczywistością.
 *
 * Uruchamia się przy starcie aplikacji i po każdej zmianie, która ma wpływ
 * na plan: edycji nawyku, odhaczeniu, przejściu doby, zmianie strefy,
 * przestawieniu globalnego przełącznika. Zamiast kasować i planować od zera
 * porównuje stan systemu z oczekiwanym i rusza tylko różnicę.
 */
export function useReminderReconcile(): void {
  const { t } = useTranslation();
  const today = useLogicalToday();
  const timeZone = useDeviceTimeZone();
  const { isEnabled } = useRemindersEnabled();
  const { endsOn: quietUntil } = useQuietWeek();
  const { habits } = useHabits();
  const { tasks } = useTodayTasks();
  const { completedCounts } = useHabitsProgress();
  const { restDays, isRest } = useRestDays();

  const settledToday = useMemo(
    () =>
      new Set(
        tasks
          .filter(
            (task) => task.isCompleted || task.isSkipped || task.planState === 'overflow',
          )
          .map((task) => task.habit.id),
      ),
    [tasks],
  );

  // Sygnatura planu: gdy się nie zmienia, nie ma czego uzgadniać.
  const signature = useMemo(
    () =>
      JSON.stringify([
        today,
        timeZone,
        isEnabled,
        quietUntil,
        [...settledToday].sort(),
        restDays.map((day) => [day.weekday, day.restDate]),
        habits.map((habit) => [
          habit.id,
          habit.title,
          habit.unit,
          habit.reminderTime,
          habit.scheduleType,
          habit.scheduleDays,
          habit.startValue,
          habit.incrementValue,
          habit.targetValue,
          habit.progressionMode,
          habit.archivedAt,
          completedCounts.get(habit.id) ?? 0,
        ]),
      ]),
    [
      today,
      timeZone,
      isEnabled,
      quietUntil,
      settledToday,
      habits,
      completedCounts,
      restDays,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const content = (habit: Habit, target: number): ReminderContent => {
      const unitKey = targetUnitKey(habit.unit);
      const targetLabel =
        habit.unit === 'none'
          ? null
          : `${formatTargetValue(target)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

      return {
        // Konkret zamiast ogolnika: "Medytacja — 3 min", nie "Czas na nawyk".
        title: targetLabel === null ? habit.title : `${habit.title} — ${targetLabel}`,
        body: t('notifications.body'),
      };
    };

    void (async () => {
      // Cichy tydzień gasi przypomnienia tak samo jak wyłączony przełącznik —
      // i tak samo o tym milczy. Po jego dacie plan wraca sam, bo sygnatura
      // zmieni się razem z `quietUntil`.
      if (!isEnabled || quietUntil !== null) {
        await cancelAllReminders();
        return;
      }

      if ((await getNotificationPermission()) !== 'granted') return;

      const expected = buildReminderPlan({
        habits,
        completedCounts,
        settledToday,
        isRestDay: isRest,
        today,
        timeZone,
        now: new Date(nowMs()),
        content,
      });

      const scheduled = await getScheduledReminders();
      if (cancelled) return;

      const { toCancel, toSchedule } = diffReminders(expected, scheduled);

      await cancelReminders(toCancel);
      if (cancelled) return;

      await scheduleReminders(toSchedule);
    })();

    return () => {
      cancelled = true;
    };
    // signature niesie wszystko, co wpływa na plan — reszta zależności
    // zmienia tożsamość przy każdym renderze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
