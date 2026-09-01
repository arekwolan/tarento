import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { letterKeys } from '@/features/letters/api/keys';
import { fetchDueLetter, markLetterDelivered } from '@/features/letters/api/letters-api';
import type { Letter } from '@/features/letters/model/letter';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type UseDueLetterResult = {
  /** List sprzed roku, jeśli dziś przypada jego termin. Zwykle `null`. */
  letter: Letter | null;
  /** Zamyka list: stempluje go jako pokazany, więc więcej nie wróci. */
  dismiss: () => void;
};

/**
 * List, który dziś ma wrócić do autora.
 *
 * Sprawdzane przy wejściu na ekran „Dziś", nie powiadomieniem push: list ma
 * zastać użytkownika, a nie go wywołać. Błędu nie zgłaszamy — brak listu
 * i nieudane zapytanie wyglądają na ekranie tak samo, czyli nijak, a to jest
 * poprawne zachowanie dla czegoś, co zdarza się raz na rok.
 */
export function useDueLetter(): UseDueLetterResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: letterKeys.due(userId ?? 'anonymous', today),
    queryFn: () => fetchDueLetter(today),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });

  const mutation = useMutation({
    mutationFn: (letterId: string) => markLetterDelivered(letterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: letterKeys.all });
    },
  });

  const letter = query.data ?? null;

  return {
    letter,
    dismiss: () => {
      if (letter === null) return;
      mutation.mutate(letter.id);
    },
  };
}
