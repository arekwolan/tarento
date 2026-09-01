import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { quoteKeys } from '@/features/quotes/api/keys';
import { fetchFavoriteQuotes, fetchQuoteHistory } from '@/features/quotes/api/quotes-api';
import type { Quote } from '@/features/quotes/model/quote';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { STALE_TIME } from '@/lib/query-client';

export type UseFavoriteQuotesResult = {
  quotes: Quote[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/** Cytaty, przy których użytkownik zostawił serce. */
export function useFavoriteQuotes(): UseFavoriteQuotesResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: quoteKeys.favoriteList(userId ?? 'anonymous'),
    queryFn: fetchFavoriteQuotes,
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    quotes: query.data ?? [],
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}

export type QuoteHistoryEntry = { shownOn: IsoDate; quote: Quote };

export type UseQuoteHistoryResult = {
  entries: QuoteHistoryEntry[];
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/** Cytaty pokazane wcześniej, od najnowszego. */
export function useQuoteHistory(): UseQuoteHistoryResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: quoteKeys.history(userId ?? 'anonymous'),
    queryFn: fetchQuoteHistory,
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
