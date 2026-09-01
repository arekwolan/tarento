import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import { fetchPathOrigin } from '@/features/paths/api/paths-api';
import type { PathOrigin } from '@/features/paths/model/schemas';
import { STALE_TIME } from '@/lib/query-client';

export type UsePathOriginResult = {
  /** `null` dla nawyku dodanego ręcznie i dopóki odpowiedź nie dojdzie. */
  origin: PathOrigin | null;
};

/**
 * Skąd wziął się nawyk.
 *
 * Jedyne miejsce, w którym pochodzenie ze ścieżki jest w ogóle widoczne —
 * na liście „Dziś" pozycja ze ścieżki niczym się nie różni od dodanej ręcznie.
 * Błąd zapytania nie ma tu czego zgłaszać: brak jednej linii w szczegółach
 * nie jest stanem, o którym trzeba informować.
 *
 * @param stageId `habit.sourceStageId` albo `null`
 */
export function usePathOrigin(stageId: string | null): UsePathOriginResult {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const query = useQuery({
    queryKey: pathKeys.origin(userId, stageId ?? 'none'),
    queryFn: () => fetchPathOrigin(stageId ?? ''),
    enabled: stageId !== null,
    staleTime: STALE_TIME.reference,
  });

  return { origin: query.data ?? null };
}
