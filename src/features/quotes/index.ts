export { useDailyQuote } from '@/features/quotes/api/use-daily-quote';
export type { UseDailyQuoteResult } from '@/features/quotes/api/use-daily-quote';
export {
  registerQuoteMutationDefaults,
  useQuoteFavorite,
} from '@/features/quotes/api/use-quote-favorite';
export type { UseQuoteFavoriteResult } from '@/features/quotes/api/use-quote-favorite';
export {
  useFavoriteQuotes,
  useQuoteHistory,
} from '@/features/quotes/api/use-quote-collections';
export type {
  QuoteHistoryEntry,
  UseFavoriteQuotesResult,
  UseQuoteHistoryResult,
} from '@/features/quotes/api/use-quote-collections';
export { quoteKeys } from '@/features/quotes/api/keys';
export { pickQuoteIndex } from '@/features/quotes/model/quote';
export type { Quote } from '@/features/quotes/model/quote';
