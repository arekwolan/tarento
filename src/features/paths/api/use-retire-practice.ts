import { useMutation } from '@tanstack/react-query';

import { useLogicalToday } from '@/features/auth';
import { habitKeys } from '@/features/habits';
import { pathKeys } from '@/features/paths/api/keys';
import { setPathPracticeRetired } from '@/features/paths/api/path-actions-api';
import { queryClient } from '@/lib/query-client';

export type UseRetirePracticeResult = {
  /** Przywraca zdjęte praktyki na listę — pod akcję „Cofnij" w toaście. */
  restore: (habitIds: readonly string[]) => void;
  isPending: boolean;
};

/**
 * Cofnięcie wycofania praktyki.
 *
 * Wycofanie samo w sobie robi przejście etapu; tutaj jest tylko droga
 * powrotna. Użytkownik może chcieć zatrzymać nawyk, który ścieżka uznała za
 * wsiąknięty w rutynę — i to jego decyzja, nie ścieżki.
 */
export function useRetirePractice(): UseRetirePracticeResult {
  const today = useLogicalToday();

  const mutation = useMutation({
    mutationFn: async (habitIds: readonly string[]) => {
      for (const habitId of habitIds) {
        await setPathPracticeRetired(habitId, false, today);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: habitKeys.all });
      void queryClient.invalidateQueries({ queryKey: pathKeys.all });
    },
  });

  return {
    restore: (habitIds) => {
      if (habitIds.length === 0) return;
      mutation.mutate(habitIds);
    },
    isPending: mutation.isPending,
  };
}
