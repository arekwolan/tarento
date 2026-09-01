import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { useRestDays } from '@/features/day-budget';
import { fetchHabitLogsSince, setHabitRetired } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import {
  decideRetirementOffer,
  fetchLastRetirementOffer,
  recordRetirementOffer,
} from '@/features/habits/api/retirement-api';
import { scheduledCompletion } from '@/features/habits/model/downshift';
import type { Habit, HabitLog } from '@/features/habits/model/habit';
import { createHabitRevisionRequestId } from '@/features/habits/model/revision';
import {
  isRetirementCandidate,
  RETIREMENT_WINDOW_DAYS,
} from '@/features/habits/model/retirement';
import { addDays, daysBetween } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

/**
 * Propozycja zdjęcia nawyku z listy.
 *
 * Ten sam kształt co propozycja zmniejszenia: wiersz w bazie powstaje w chwili
 * pokazania karty, a widoczność wynika wprost z niego. Różnica jest jedna —
 * tutaj obie odpowiedzi kończą pytanie, bo „Zostaw" też jest odpowiedzią.
 */

/** Ile dni historii pobieramy pod próbkę sześćdziesięciu dni z harmonogramu. */
const HISTORY_DAYS = RETIREMENT_WINDOW_DAYS * 3;

const EMPTY_LOGS: HabitLog[] = [];

export type UseRetirementResult = {
  isVisible: boolean;
  /** Ile z ostatnich sześćdziesięciu dni z harmonogramu zostało odhaczonych. */
  completed: number;
  scheduled: number;
  isPending: boolean;
  /** Zdejmuje nawyk z listy. Zwraca cofnięcie albo null, gdy zapis się nie udał. */
  retire: () => Promise<(() => void) | null>;
  /** „Zostaw" — nawyk zostaje, pytanie milknie na dziewięćdziesiąt dni. */
  decline: () => void;
};

export function useRetirement(habit: Habit | null): UseRetirementResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const { isRest } = useRestDays();

  const habitId = habit?.id ?? null;
  const enabled = userId !== null && habitId !== null;
  const from = addDays(today, -HISTORY_DAYS);

  const logsQuery = useQuery({
    queryKey: habitKeys.history(userId ?? 'anonymous', habitId ?? 'none', from),
    queryFn: () => fetchHabitLogsSince(habitId ?? '', from),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  const offerQuery = useQuery({
    queryKey: habitKeys.retirement(userId ?? 'anonymous', habitId ?? 'none'),
    queryFn: () => fetchLastRetirementOffer(habitId ?? ''),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  const isRecording = useRef(false);

  const logs = logsQuery.data ?? EMPTY_LOGS;
  const lastOffer = offerQuery.data ?? null;

  const openOffer =
    lastOffer !== null && daysBetween(lastOffer.offeredAt.slice(0, 10), today) === 0
      ? lastOffer
      : null;

  const completion =
    habit === null
      ? null
      : scheduledCompletion(habit, logs, today, RETIREMENT_WINDOW_DAYS, isRest);

  const isVisible =
    habit !== null &&
    !logsQuery.isPending &&
    !offerQuery.isPending &&
    isRetirementCandidate(habit, logs, today, {
      lastOffer:
        lastOffer === null
          ? null
          : {
              on: lastOffer.offeredAt.slice(0, 10),
              decided: lastOffer.acceptedAt !== null || lastOffer.declinedAt !== null,
            },
      isRestDay: isRest,
    });

  useEffect(() => {
    if (!isVisible || openOffer !== null || isRecording.current) return;
    if (habit === null || userId === null) return;

    isRecording.current = true;

    void recordRetirementOffer({ habitId: habit.id, userId })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: habitKeys.retirement(userId, habit.id),
        }),
      )
      .catch(() => {
        isRecording.current = false;
      });
  }, [isVisible, openOffer, habit, userId]);

  const retireMutation = useMutation({
    mutationFn: ({
      id,
      retired,
      expectedUpdatedAt,
      requestId,
    }: {
      id: string;
      retired: boolean;
      expectedUpdatedAt: string;
      requestId: string;
    }) =>
      setHabitRetired(id, retired, {
        effectiveOn: today,
        requestId,
        expectedUpdatedAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });

  const retire = useCallback(async () => {
    if (habit === null) return null;

    const offerId = openOffer?.id ?? null;

    try {
      const retiredHabit = await retireMutation.mutateAsync({
        id: habit.id,
        retired: true,
        expectedUpdatedAt: habit.updatedAt,
        requestId: createHabitRevisionRequestId(),
      });

      if (offerId !== null) void decideRetirementOffer(offerId, 'accepted');

      return () => {
        void retireMutation.mutateAsync({
          id: habit.id,
          retired: false,
          expectedUpdatedAt: retiredHabit.updatedAt,
          requestId: createHabitRevisionRequestId(),
        });
        if (offerId !== null) {
          void decideRetirementOffer(offerId, 'pending').then(() =>
            queryClient.invalidateQueries({ queryKey: habitKeys.all }),
          );
        }
      };
    } catch {
      return null;
    }
  }, [habit, openOffer, retireMutation]);

  const decline = useCallback(() => {
    const offerId = openOffer?.id ?? null;
    if (offerId === null || userId === null || habit === null) return;

    void decideRetirementOffer(offerId, 'declined').then(() =>
      queryClient.invalidateQueries({
        queryKey: habitKeys.retirement(userId, habit.id),
      }),
    );
  }, [openOffer, userId, habit]);

  return {
    isVisible,
    completed: completion?.completed ?? 0,
    scheduled: completion?.scheduled ?? RETIREMENT_WINDOW_DAYS,
    isPending: retireMutation.isPending,
    retire,
    decline,
  };
}
