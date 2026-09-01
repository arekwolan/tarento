import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { fetchDayNote, saveDayNote } from '@/features/journal/api/day-notes-api';
import { journalKeys } from '@/features/journal/api/keys';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type UseDayNoteResult = {
  /** Treść wpisu z dzisiaj. Pusty string, gdy jeszcze nic nie ma. */
  body: string;
  isLoading: boolean;
  isSaving: boolean;
  /** Zapis przy utracie fokusu. Puste pole kasuje wpis. */
  save: (body: string) => void;
};

/**
 * Linia o dzisiejszym dniu.
 *
 * Jeden wpis na dobę logiczną: klucz zapytania niesie datę, więc po północy
 * pole samo robi się puste, bez czyszczenia stanu przez komponent.
 */
export function useDayNote(): UseDayNoteResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();

  const query = useQuery({
    queryKey: journalKeys.note(userId ?? 'anonymous', today),
    queryFn: () => fetchDayNote(today),
    enabled: userId !== null,
    staleTime: STALE_TIME.habits,
  });

  const mutation = useMutation({
    mutationFn: (body: string) =>
      saveDayNote({ userId: userId ?? '', date: today, body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: journalKeys.all });
    },
  });

  const save = useCallback(
    (body: string) => {
      if (userId === null) return;
      if (body.trim() === (query.data?.body ?? '')) return;

      mutation.mutate(body);
    },
    [userId, query.data, mutation],
  );

  return {
    body: query.data?.body ?? '',
    isLoading: query.isPending && userId !== null,
    isSaving: mutation.isPending,
    save,
  };
}
