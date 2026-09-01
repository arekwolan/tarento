import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth, useLogicalToday } from '@/features/auth';
import { saveDayShape } from '@/features/day-budget/api/day-budget-api';
import { dayBudgetKeys } from '@/features/day-budget/api/keys';
import type { DayShapeDraft } from '@/features/day-budget/model/day-shape';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient } from '@/lib/query-client';

export type UseSaveDayShapeResult = {
  /** Zapisuje kształt dnia. `false` oznacza błąd — ekran zostaje na miejscu. */
  save: (draft: DayShapeDraft) => Promise<boolean>;
  isPending: boolean;
  error: DataError | null;
};

/**
 * Zapis kroku „kształt dnia".
 *
 * Tryb gościa nie potrzebuje osobnej ścieżki: konto anonimowe ma własny wiersz
 * w auth.users i w profiles, więc szablony zapisują się tak samo jak dla konta
 * z mailem, a podpięcie adresu (linkEmailToCurrentUser) nie zmienia id — dane
 * przechodzą przez rejestrację nietknięte.
 */
export function useSaveDayShape(): UseSaveDayShapeResult {
  const { t } = useTranslation();
  const { user } = useAuth();
  const anchorDate = useLogicalToday();
  const userId = user?.id ?? null;

  const mutation = useMutation({
    mutationFn: (draft: DayShapeDraft) =>
      saveDayShape({
        userId: userId ?? '',
        anchorDate,
        draft,
        workdayName: t('onboarding.dayShape.workdayName'),
        freeName: t('onboarding.dayShape.freeName'),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dayBudgetKeys.all });
    },
  });

  return {
    save: async (draft) => {
      if (userId === null) return false;

      try {
        await mutation.mutateAsync(draft);
        return true;
      } catch {
        return false;
      }
    },
    isPending: mutation.isPending,
    error: mutation.error === null ? null : toDataError(mutation.error),
  };
}
