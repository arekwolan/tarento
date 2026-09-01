import { useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { quoteKeys } from '@/features/quotes/api/keys';
import { ensureDailyQuote } from '@/features/quotes/api/quotes-api';
import type { Quote } from '@/features/quotes/model/quote';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { STALE_TIME } from '@/lib/query-client';

export type UseDailyQuoteResult = {
  quote: Quote | null;
  date: IsoDate;
  isLoading: boolean;
  error: DataError | null;
  refetch: () => void;
};

/** Domyślny język cytatów, gdy profil jeszcze nie doszedł. */
const FALLBACK_LANGUAGE = 'pl';

/**
 * Cytat na dzisiaj.
 *
 * Zapytanie ma efekt uboczny — przy pierwszym wejściu w danym dniu zapisuje
 * wybór do daily_quotes. To celowe: dopiero zapis sprawia, że cytat jest
 * stały przez całą dobę, także po wyczyszczeniu cache'u.
 *
 * Raz ustalony cytat nie zmienia się do końca dnia, więc trzymamy go jako
 * dane referencyjne, a nie „dzisiejsze".
 */
export function useDailyQuote(): UseDailyQuoteResult {
  const { user, profile } = useAuth();
  const date = useLogicalToday();
  const userId = user?.id ?? null;
  const language = profile?.locale ?? FALLBACK_LANGUAGE;

  const query = useQuery({
    queryKey: quoteKeys.daily(userId ?? 'anonymous', date),
    queryFn: () => ensureDailyQuote(userId ?? '', date, language),
    enabled: userId !== null,
    staleTime: STALE_TIME.reference,
    // Wybór jest zapisany w bazie, więc powtarzanie go po każdym powrocie
    // do aplikacji nic nie wnosi.
    refetchOnReconnect: false,
  });

  return {
    quote: query.data ?? null,
    date,
    isLoading: query.isPending && userId !== null,
    error: query.error === null ? null : toDataError(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
