import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { dayBudgetKeys } from '@/features/day-budget/api/keys';
import {
  fetchDayBlocks,
  fetchDayRotation,
  fetchDayTemplates,
} from '@/features/day-budget/api/day-budget-api';
import type {
  DayBlock,
  DayTemplate,
  TimeWindow,
} from '@/features/day-budget/model/schemas';
import {
  allocatedWindow,
  budgetCeiling,
  templateForDate,
} from '@/features/day-budget/model/windows';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { STALE_TIME } from '@/lib/query-client';

export type UseDayBudgetResult = {
  /** Szablon obowiązujący tego dnia. `null`, gdy użytkownik nie ma jeszcze rotacji. */
  template: DayTemplate | null;
  /** Zajęte pasy tego szablonu. */
  blocks: DayBlock[];
  /** Jedno okno, które widzi użytkownik. `null`, gdy dzień nie ma wolnej dziury. */
  allocatedWindow: TimeWindow | null;
  /** Sufit propozycji: 60% zadeklarowanego okna. 0 bez szablonu. */
  ceiling: number;
  /** Pierwsze ładowanie, nie ma jeszcze czego pokazać. */
  isLoading: boolean;
  /** Dane są, ale lecą w tle świeże. */
  isRefreshing: boolean;
  error: DataError | null;
  refetch: () => void;
};

const EMPTY_TEMPLATES: DayTemplate[] = [];
const EMPTY_BLOCKS: DayBlock[] = [];

/**
 * Budżet czasu na wskazany dzień.
 *
 * Trzy zapytania niezależne od daty (rotacja, szablony, bloki) i cała reszta
 * liczona w pamięci — przejście na inny dzień nie dotyka sieci.
 *
 * @param date dzień w kalendarzu; podawaj wynik useLogicalToday(), nie datę
 *   urządzenia (CLAUDE.md, reguła krytyczna 2)
 */
export function useDayBudget(date: IsoDate): UseDayBudgetResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = userId !== null;
  const keyUserId = userId ?? 'anonymous';

  const [rotationQuery, templatesQuery, blocksQuery] = useQueries({
    queries: [
      {
        queryKey: dayBudgetKeys.rotation(keyUserId),
        queryFn: fetchDayRotation,
        enabled,
        staleTime: STALE_TIME.habits,
      },
      {
        queryKey: dayBudgetKeys.templates(keyUserId),
        queryFn: fetchDayTemplates,
        enabled,
        staleTime: STALE_TIME.habits,
      },
      {
        queryKey: dayBudgetKeys.blocks(keyUserId),
        queryFn: fetchDayBlocks,
        enabled,
        staleTime: STALE_TIME.habits,
      },
    ],
  });

  const rotation = rotationQuery.data ?? null;
  const templates = templatesQuery.data ?? EMPTY_TEMPLATES;
  const allBlocks = blocksQuery.data ?? EMPTY_BLOCKS;

  const derived = useMemo(() => {
    const templateId = rotation === null ? null : templateForDate(rotation, date);
    const template =
      templateId === null
        ? null
        : (templates.find((candidate) => candidate.id === templateId) ?? null);

    // Rotacja może wskazywać szablon, który w międzyczasie trafił do archiwum.
    // Dzień bez szablonu nie ma okna — i tak ma to wyglądać, dopóki
    // użytkownik nie poprawi rotacji.
    if (template === null) {
      return { template: null, blocks: EMPTY_BLOCKS, allocatedWindow: null, ceiling: 0 };
    }

    const blocks = allBlocks.filter((block) => block.templateId === template.id);

    return {
      template,
      blocks,
      allocatedWindow: allocatedWindow(template, blocks),
      ceiling: budgetCeiling(template),
    };
  }, [rotation, templates, allBlocks, date]);

  const firstError = rotationQuery.error ?? templatesQuery.error ?? blocksQuery.error;

  return {
    ...derived,
    isLoading:
      enabled &&
      (rotationQuery.isPending || templatesQuery.isPending || blocksQuery.isPending),
    isRefreshing:
      !rotationQuery.isPending &&
      (rotationQuery.isFetching || templatesQuery.isFetching || blocksQuery.isFetching),
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
    refetch: () => {
      void rotationQuery.refetch();
      void templatesQuery.refetch();
      void blocksQuery.refetch();
    },
  };
}
