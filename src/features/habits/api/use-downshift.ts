import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { requestDownshift, type DownshiftProposal } from '@/features/ai-plan';
import { useAuth, useLogicalToday } from '@/features/auth';
import { useRestDays } from '@/features/day-budget';
import {
  acceptDownshiftOffer,
  fetchLastDownshiftOffer,
  recordDownshiftOffer,
} from '@/features/habits/api/downshift-api';
import {
  fetchHabitLogsSince,
  updateHabitParams,
  type HabitParams,
} from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import {
  deterministicDownshift,
  scheduledCompletion,
  shouldOfferDownshift,
  DOWNSHIFT_WINDOW_DAYS,
} from '@/features/habits/model/downshift';
import type { Habit, HabitLog } from '@/features/habits/model/habit';
import { createHabitRevisionRequestId } from '@/features/habits/model/revision';
import { addDays, daysBetween, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

/**
 * Propozycja zmniejszenia nawyku: czy pokazać, co zaproponować, jak zastosować.
 *
 * Kolejność jest tu produktem, nie implementacją. Wiersz w `habit_downshifts`
 * powstaje w chwili, gdy karta staje się widoczna, a nie w chwili odpowiedzi —
 * dzięki temu pytanie pada raz na trzydzieści dni także wtedy, gdy użytkownik
 * je zignoruje. Widoczność wynika wprost z tego wiersza: propozycja z dzisiaj
 * i nieprzyjęta to ta, która właśnie stoi na ekranie.
 */

/**
 * Ile dni historii pobieramy.
 *
 * Czternaście dni z harmonogramu to przy nawyku raz w tygodniu prawie sto dni
 * kalendarza; sto czterdzieści daje zapas i zamyka zakres na tyle wąsko, żeby
 * nie ściągać całej historii nawyku prowadzonego od roku.
 */
const HISTORY_DAYS = DOWNSHIFT_WINDOW_DAYS * 10;

const EMPTY_LOGS: HabitLog[] = [];

export type UseDownshiftOptions = {
  /**
   * Ostatni dzień tygodnia wejściowego ścieżki, jeśli użytkownik ją prowadzi.
   *
   * Wchodzi parametrem, a nie własnym zapytaniem: feature nawyków nie zna
   * ścieżek, a ścieżki znają nawyki — import w drugą stronę zamknąłby cykl
   * między dwoma publicznymi API.
   */
  reentryUntil: IsoDate | null;
};

export type UseDownshiftResult = {
  /** Czy pokazać kartę propozycji. */
  isVisible: boolean;
  /** Ile dni z próbki zostało odhaczonych. */
  completed: number;
  /** Wielkość próbki — do komunikatu „{{completed}} z {{scheduled}} dni". */
  scheduled: number;
  /** Propozycja gotowa do pokazania w arkuszu. `null`, dopóki nikt nie pytał. */
  proposal: DownshiftProposal | null;
  isRequesting: boolean;
  isApplying: boolean;
  /** Prosi o propozycję i otwiera arkusz. */
  request: () => void;
  /** Zamyka arkusz bez zmiany. */
  dismiss: () => void;
  /** Zapisuje zmianę. Cofnięcie odbywa się przez wspólny preview historii. */
  apply: () => Promise<boolean>;
};

function toParams(habit: Habit): HabitParams {
  return {
    startValue: habit.startValue,
    incrementValue: habit.incrementValue,
    scheduleType: habit.scheduleType,
    scheduleDays: habit.scheduleDays === null ? null : [...habit.scheduleDays],
  };
}

function proposalToParams(proposal: DownshiftProposal): HabitParams {
  return {
    startValue: proposal.start_value,
    incrementValue: proposal.increment_value,
    scheduleType: proposal.schedule_type,
    scheduleDays: proposal.schedule_days,
  };
}

export function useDownshift(
  habit: Habit | null,
  options: UseDownshiftOptions,
): UseDownshiftResult {
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
    queryKey: habitKeys.downshift(userId ?? 'anonymous', habitId ?? 'none'),
    queryFn: () => fetchLastDownshiftOffer(habitId ?? ''),
    enabled,
    staleTime: STALE_TIME.habits,
  });

  const [proposal, setProposal] = useState<DownshiftProposal | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const isRecording = useRef(false);

  const logs = logsQuery.data ?? EMPTY_LOGS;
  const lastOffer = offerQuery.data ?? null;

  /** Wiersz z dzisiaj: pod niego podpina się zastosowanie i cofnięcie. */
  const openOffer =
    lastOffer !== null && daysBetween(lastOffer.offeredAt.slice(0, 10), today) === 0
      ? lastOffer
      : null;

  const completion =
    habit === null ? null : scheduledCompletion(habit, logs, today, undefined, isRest);

  const isVisible =
    habit !== null &&
    !logsQuery.isPending &&
    !offerQuery.isPending &&
    shouldOfferDownshift(habit, logs, today, {
      lastOffer:
        lastOffer === null
          ? null
          : {
              on: lastOffer.offeredAt.slice(0, 10),
              accepted: lastOffer.acceptedAt !== null,
            },
      reentryUntil: options.reentryUntil,
      isRestDay: isRest,
    });

  /**
   * Zapis „pytaliśmy" idzie w chwili pokazania karty.
   *
   * Wprost przez warstwę api, a nie przez useMutation: obiekt mutacji zmienia
   * tożsamość przy każdym renderze i wciągnięty do zależności efektu kazałby
   * mu chodzić w kółko.
   */
  useEffect(() => {
    if (!isVisible || openOffer !== null || isRecording.current) return;
    if (habit === null || userId === null) return;

    isRecording.current = true;

    void recordDownshiftOffer({ habitId: habit.id, userId, fromParams: toParams(habit) })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: habitKeys.downshift(userId, habit.id),
        }),
      )
      .catch(() => {
        // Nieudany zapis śladu nie ma prawa zabrać użytkownikowi propozycji —
        // najwyżej pytanie wróci przy kolejnym wejściu na ekran.
        isRecording.current = false;
      });
  }, [isVisible, openOffer, habit, userId]);

  const applyMutation = useMutation({
    mutationFn: ({
      id,
      params,
      expectedUpdatedAt,
      requestId,
    }: {
      id: string;
      params: HabitParams;
      expectedUpdatedAt: string;
      requestId: string;
    }) =>
      updateHabitParams(id, params, {
        source: 'downshift',
        reason: 'difficult_period',
        effectiveOn: today,
        requestId,
        expectedUpdatedAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });

  const request = useCallback(() => {
    if (habit === null) return;

    setIsRequesting(true);

    void requestDownshift(habit.id)
      .then((response) => {
        setProposal(response.proposal);
      })
      .catch(() => {
        // Wariant deterministyczny zamiast komunikatu o błędzie: użytkownik
        // nacisnął „Zmniejsz", więc dostaje mniejszą wersję nawyku także
        // wtedy, gdy model jest nieosiągalny (IDEAS.md §C).
        const change = deterministicDownshift(habit);
        if (change === null) return;

        setProposal({
          title: habit.title,
          rationale: '',
          unit: habit.unit,
          start_value: change.startValue,
          increment_value: change.incrementValue,
          time_of_day: habit.timeOfDay ?? 'evening',
          category: habit.category ?? 'focus',
          schedule_type: change.scheduleType,
          schedule_days: change.scheduleDays,
        });
      })
      .finally(() => {
        setIsRequesting(false);
      });
  }, [habit]);

  const dismiss = useCallback(() => {
    setProposal(null);
  }, []);

  const apply = useCallback(async () => {
    if (habit === null || proposal === null) return false;

    const after = proposalToParams(proposal);
    const offerId = openOffer?.id ?? null;

    try {
      await applyMutation.mutateAsync({
        id: habit.id,
        params: after,
        expectedUpdatedAt: habit.updatedAt,
        requestId: createHabitRevisionRequestId(),
      });

      setProposal(null);

      if (offerId !== null) {
        void acceptDownshiftOffer(offerId, after).then(() =>
          queryClient.invalidateQueries({ queryKey: habitKeys.all }),
        );
      }

      return true;
    } catch {
      return false;
    }
  }, [habit, proposal, openOffer, applyMutation]);

  return {
    isVisible,
    completed: completion?.completed ?? 0,
    scheduled: completion?.scheduled ?? DOWNSHIFT_WINDOW_DAYS,
    proposal,
    isRequesting,
    isApplying: applyMutation.isPending,
    request,
    dismiss,
    apply,
  };
}
