import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { templateKeys } from '@/features/templates/api/keys';
import { fetchHabitTemplates } from '@/features/templates/api/templates-api';
import type {
  HabitTemplate,
  TemplateCategory,
} from '@/features/templates/model/template';
import { toDataError, type DataError } from '@/lib/data-error';
import { STALE_TIME } from '@/lib/query-client';

const FALLBACK_LANGUAGE = 'pl';

export type UseHabitTemplatesResult = {
  templates: HabitTemplate[];
  /** Kategorie faktycznie obecne w katalogu, w kolejności do wyświetlenia. */
  availableCategories: TemplateCategory[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/**
 * Katalog szablonów, opcjonalnie zawężony do kategorii.
 *
 * Filtrowanie idzie po stronie klienta: katalog to kilkanaście pozycji,
 * a jedno zapytanie w cache'u obsługuje wszystkie zakładki.
 */
export function useHabitTemplates(
  category?: TemplateCategory | null,
): UseHabitTemplatesResult {
  const { profile } = useAuth();
  const language = profile?.locale ?? FALLBACK_LANGUAGE;

  const query = useQuery({
    queryKey: templateKeys.list(language),
    queryFn: () => fetchHabitTemplates(language),
    staleTime: STALE_TIME.reference,
  });

  const all = useMemo(() => query.data ?? [], [query.data]);

  const availableCategories = useMemo(() => {
    const seen = new Set<TemplateCategory>();
    for (const template of all) {
      if (template.category !== null) seen.add(template.category);
    }
    return [...seen];
  }, [all]);

  const templates = useMemo(
    () =>
      category === undefined || category === null
        ? all
        : all.filter((template) => template.category === category),
    [all, category],
  );

  return {
    templates,
    availableCategories,
    isLoading: query.isPending,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
