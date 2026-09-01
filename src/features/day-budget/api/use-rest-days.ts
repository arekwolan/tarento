import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { dayBudgetKeys } from '@/features/day-budget/api/keys';
import { fetchRestDays } from '@/features/day-budget/api/rest-days-api';
import { isRestDay, type RestDay } from '@/features/day-budget/model/rest';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { STALE_TIME } from '@/lib/query-client';

export type UseRestDaysResult = {
  restDays: RestDay[];
  /** Czy w tym dniu aplikacja o nic nie prosi. */
  isRest: (date: IsoDate) => boolean;
  isLoading: boolean;
  error: DataError | null;
};

const EMPTY: RestDay[] = [];

/**
 * Deklaracje dni pustych.
 *
 * Wołane z kilku miejsc naraz (lista na dziś, mapa dni, powiadomienia), więc
 * odpowiedź musi iść z jednego klucza cache — inaczej ekran i harmonogram
 * powiadomień mogłyby chwilowo widzieć różne dni puste.
 */
export function useRestDays(): UseRestDaysResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: dayBudgetKeys.restDays(userId ?? 'anonymous'),
    queryFn: fetchRestDays,
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  const restDays = query.data ?? EMPTY;

  const isRest = useCallback((date: IsoDate) => isRestDay(date, restDays), [restDays]);

  return {
    restDays,
    isRest,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
  };
}
