import { useMutation } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { letterKeys } from '@/features/letters/api/keys';
import { writeLetter } from '@/features/letters/api/letters-api';
import { LETTER_DELAY_DAYS } from '@/features/letters/model/letter';
import { toDataError, type DataError } from '@/lib/data-error';
import { addDays } from '@/lib/date';
import { queryClient } from '@/lib/query-client';

export type UseWriteLetterResult = {
  /** Zapisuje list z terminem doręczenia za rok. `false` przy błędzie. */
  write: (body: string) => Promise<boolean>;
  isPending: boolean;
  error: DataError | null;
};

/**
 * Zapis listu do siebie za rok.
 *
 * Termin liczymy od doby logicznej, nie od zegara serwera — list napisany
 * o 1:30 w nocy należy do dnia, który użytkownik właśnie domyka.
 */
export function useWriteLetter(): UseWriteLetterResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const mutation = useMutation({
    mutationFn: (body: string) =>
      writeLetter({
        userId: userId ?? '',
        body,
        writtenOn: today,
        deliverOn: addDays(today, LETTER_DELAY_DAYS),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: letterKeys.all });
    },
  });

  return {
    write: async (body) => {
      const trimmed = body.trim();
      if (userId === null || trimmed === '') return false;

      try {
        await mutation.mutateAsync(trimmed);
        return true;
      } catch {
        return false;
      }
    },
    isPending: mutation.isPending,
    error: mutation.error === null ? null : toDataError(mutation.error),
  };
}
