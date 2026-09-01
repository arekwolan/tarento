import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { dayBudgetKeys } from '@/features/day-budget/api/keys';
import {
  addRestDate,
  addRestWeekday,
  removeRestDay,
} from '@/features/day-budget/api/rest-days-api';
import { habitKeys } from '@/features/habits';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { queryClient } from '@/lib/query-client';

/**
 * Dzień pusty zmienia nie tylko listę na dziś: seria przeskakuje tę datę,
 * więc liczby przy nawykach też są już nieaktualne.
 *
 * Statystyk nie czyścimy stąd celowo — mają staleTime 0 i odświeżają się
 * przy każdym wejściu na ekran, a import w tę stronę zapętliłby feature'y
 * (statystyki już czytają dni puste).
 */
function invalidateRestDays(): void {
  void queryClient.invalidateQueries({ queryKey: dayBudgetKeys.all });
  void queryClient.invalidateQueries({ queryKey: habitKeys.all });
}

export type UseToggleRestDayResult = {
  /** Włącza albo wyłącza cykliczny dzień pusty. */
  setWeekday: (weekday: number, isRest: boolean, existingId: string | null) => void;
  /** Robi z dzisiaj dzień pusty. Zwraca id wiersza albo null przy błędzie. */
  makeRestDay: (date: IsoDate) => Promise<string | null>;
  /** Cofa deklarację — po id z `makeRestDay()` albo z listy. */
  undoRestDay: (id: string) => void;
  isPending: boolean;
  error: DataError | null;
};

export function useToggleRestDay(): UseToggleRestDayResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const addWeekday = useMutation({
    mutationFn: (weekday: number) => addRestWeekday(userId ?? '', weekday),
    onSuccess: invalidateRestDays,
  });

  const addDate = useMutation({
    mutationFn: (date: IsoDate) => addRestDate(userId ?? '', date),
    onSuccess: invalidateRestDays,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeRestDay(id),
    onSuccess: invalidateRestDays,
  });

  const firstError = addWeekday.error ?? addDate.error ?? remove.error;

  return {
    setWeekday: (weekday, isRest, existingId) => {
      if (userId === null) return;

      if (isRest) {
        addWeekday.mutate(weekday);
        return;
      }
      if (existingId !== null) remove.mutate(existingId);
    },
    makeRestDay: async (date) => {
      if (userId === null) return null;

      try {
        const created = await addDate.mutateAsync(date);
        return created.id;
      } catch {
        return null;
      }
    },
    undoRestDay: (id) => {
      remove.mutate(id);
    },
    isPending: addWeekday.isPending || addDate.isPending || remove.isPending,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
  };
}
