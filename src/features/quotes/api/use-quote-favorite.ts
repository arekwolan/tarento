import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { quoteKeys } from '@/features/quotes/api/keys';
import {
  addQuoteFavorite,
  fetchFavoriteQuoteIds,
  removeQuoteFavorite,
} from '@/features/quotes/api/quote-favorites-api';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient, STALE_TIME } from '@/lib/query-client';

type ToggleFavoriteVariables = {
  userId: string;
  quoteId: string;
  /** Stan w chwili kliknięcia — decyduje, czy dodajemy, czy zdejmujemy. */
  wasFavorite: boolean;
};

type ToggleFavoriteContext = { previousIds: string[] | undefined };

const toggleFavorite: MutationFunction<void, ToggleFavoriteVariables> = async (
  variables,
) => {
  if (variables.wasFavorite) {
    await removeQuoteFavorite(variables.quoteId);
    return;
  }

  await addQuoteFavorite(variables.userId, variables.quoteId);
};

const toggleFavoriteDefaults = {
  mutationFn: toggleFavorite,

  async onMutate(variables: ToggleFavoriteVariables): Promise<ToggleFavoriteContext> {
    const key = quoteKeys.favorites(variables.userId);
    await queryClient.cancelQueries({ queryKey: key });

    const previousIds = queryClient.getQueryData<string[]>(key);

    queryClient.setQueryData<string[]>(key, (current = []) =>
      variables.wasFavorite
        ? current.filter((id) => id !== variables.quoteId)
        : [...current, variables.quoteId],
    );

    return { previousIds };
  },

  onError(
    _error: unknown,
    variables: ToggleFavoriteVariables,
    context: ToggleFavoriteContext | undefined,
  ) {
    if (context === undefined) return;
    queryClient.setQueryData(quoteKeys.favorites(variables.userId), context.previousIds);
  },

  onSettled(_data: void, _error: unknown, variables: ToggleFavoriteVariables) {
    void queryClient.invalidateQueries({
      queryKey: quoteKeys.favorites(variables.userId),
    });
  },
};

/** Rejestruje mutację polubienia, żeby przetrwała restart w kolejce offline. */
export function registerQuoteMutationDefaults(): void {
  queryClient.setMutationDefaults(quoteKeys.toggleFavorite(), toggleFavoriteDefaults);
}

export type UseQuoteFavoriteResult = {
  isFavorite: (quoteId: string) => boolean;
  toggle: (quoteId: string) => void;
  isPending: boolean;
  error: DataError | null;
};

/** Ulubione cytaty użytkownika z optymistycznym przełączaniem. */
export function useQuoteFavorite(): UseQuoteFavoriteResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const favorites = useQuery({
    queryKey: quoteKeys.favorites(userId ?? 'anonymous'),
    queryFn: fetchFavoriteQuoteIds,
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
  });

  const mutation = useMutation<
    void,
    Error,
    ToggleFavoriteVariables,
    ToggleFavoriteContext
  >({
    mutationKey: quoteKeys.toggleFavorite(),
  });

  const favoriteIds = favorites.data ?? [];

  return {
    isFavorite: (quoteId: string) => favoriteIds.includes(quoteId),
    toggle: (quoteId: string) => {
      if (userId === null) return;
      mutation.mutate({ userId, quoteId, wasFavorite: favoriteIds.includes(quoteId) });
    },
    isPending: mutation.isPending,
    error:
      favorites.error !== null
        ? toDataError(favorites.error)
        : mutation.error === null
          ? null
          : toDataError(mutation.error),
  };
}
