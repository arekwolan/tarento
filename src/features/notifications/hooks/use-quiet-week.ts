import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { useRestDays } from '@/features/day-budget';
import { habitKeys } from '@/features/habits';
import { notificationKeys } from '@/features/notifications/api/keys';
import {
  endQuietWeekEarly,
  fetchLatestQuietWeek,
  startQuietWeek,
} from '@/features/notifications/api/quiet-weeks-api';
import {
  nextQuietWeek,
  QUIET_WEEK_DAYS,
  quietWeekEndsOn,
  shouldEnterQuietWeek,
} from '@/features/notifications/model/quiet';
import { fetchDailySummary } from '@/features/stats';
import { addDays, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

/**
 * Cichy tydzień.
 *
 * Wchodzi sam i milczy o tym: nie ma powiadomienia, banera ani modala.
 * Kończy się datą, a nie zapisem — dzięki temu przypomnienia wracają nawet
 * wtedy, gdy użytkownik nie otworzy aplikacji siódmego dnia.
 *
 * Jedyny ślad, jaki zostawia w interfejsie, to linia w ustawieniach.
 */

export type UseQuietWeekResult = {
  /** Data, do której przypomnienia są wyciszone. `null`, gdy działają. */
  endsOn: IsoDate | null;
  /** „Włącz teraz" — kończy wyciszenie przed czasem. */
  endNow: () => void;
  isEnding: boolean;
};

export function useQuietWeek(): UseQuietWeekResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const { isRest } = useRestDays();

  const enabled = userId !== null;
  const from = addDays(today, -QUIET_WEEK_DAYS);
  const isStarting = useRef(false);

  const weekQuery = useQuery({
    queryKey: notificationKeys.quietWeek(userId ?? 'anonymous'),
    queryFn: fetchLatestQuietWeek,
    enabled,
    staleTime: STALE_TIME.habits,
  });

  const signalQuery = useQuery({
    queryKey: notificationKeys.quietSignal(userId ?? 'anonymous', from),
    queryFn: () => fetchDailySummary(from, addDays(today, -1)),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  const latest = weekQuery.data ?? null;
  const endsOn = quietWeekEndsOn(latest, today);

  useEffect(() => {
    if (!enabled || userId === null || isStarting.current) return;
    if (endsOn !== null) return;
    if (weekQuery.isPending || signalQuery.isPending) return;

    const days = signalQuery.data ?? [];
    const decision = shouldEnterQuietWeek(days, today, {
      lastQuietWeekOn: latest?.startedOn ?? null,
      isRestDay: isRest,
    });

    if (!decision) return;

    isStarting.current = true;

    // Bez komunikatu, bez toasta, bez powiadomienia. Aplikacja po prostu
    // milknie — i to jest cała funkcja.
    void startQuietWeek({ userId, ...nextQuietWeek(today) })
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
          queryClient.invalidateQueries({ queryKey: habitKeys.dayPlan(userId, today) }),
          queryClient.invalidateQueries({ queryKey: ['stats'] }),
        ]),
      )
      .catch(() => {
        isStarting.current = false;
      });
  }, [
    enabled,
    userId,
    endsOn,
    today,
    isRest,
    latest,
    weekQuery.isPending,
    signalQuery.isPending,
    signalQuery.data,
  ]);

  const endMutation = useMutation({
    mutationFn: endQuietWeekEarly,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      if (userId !== null) {
        void queryClient.invalidateQueries({
          queryKey: habitKeys.dayPlan(userId, today),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const endNow = useCallback(() => {
    if (latest === null) return;
    endMutation.mutate(latest.id);
  }, [latest, endMutation]);

  return { endsOn, endNow, isEnding: endMutation.isPending };
}
