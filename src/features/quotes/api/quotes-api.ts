import {
  pickQuoteIndex,
  quoteRowSchema,
  type Quote,
} from '@/features/quotes/model/quote';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const QUOTE_COLUMNS =
  'id, content, author, source_book, language, tags, is_public_domain';

/** Kod Postgresa dla naruszenia unikalności — tu: wyścig dwóch urządzeń. */
const UNIQUE_VIOLATION = '23505';

/** Cytat już przypisany do tego dnia, albo null. */
async function fetchAssignedQuote(date: IsoDate): Promise<Quote | null> {
  const { data, error } = await supabase
    .from('daily_quotes')
    .select(`quotes (${QUOTE_COLUMNS})`)
    .eq('shown_on', date)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return quoteRowSchema.parse(data.quotes);
}

/** Identyfikatory cytatów, które użytkownik już kiedyś widział. */
async function fetchSeenQuoteIds(): Promise<string[]> {
  const { data, error } = await supabase.from('daily_quotes').select('quote_id');

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => row.quote_id);
}

/**
 * Kandydaci na cytat dnia: aktywne, w języku użytkownika, jeszcze
 * niepokazane. Kolejność po id jest stabilna, żeby losowanie było
 * powtarzalne między urządzeniami.
 */
async function fetchCandidates(
  language: string,
  seenIds: readonly string[],
): Promise<Quote[]> {
  let query = supabase
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('is_active', true)
    .eq('language', language)
    .order('id', { ascending: true });

  if (seenIds.length > 0) {
    query = query.not('id', 'in', `(${seenIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error !== null) throw toDataError(error);

  return quoteRowSchema.array().parse(data);
}

/** Wszystkie aktywne cytaty — używane, gdy użytkownik zobaczył już każdy. */
async function fetchAllActive(language: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('is_active', true)
    .eq('language', language)
    .order('id', { ascending: true });

  if (error !== null) throw toDataError(error);

  return quoteRowSchema.array().parse(data);
}

/**
 * Cytat na wskazany dzień. Jeśli nie ma jeszcze wpisu, wybiera nowy
 * i zapisuje go, żeby kolejne wejścia tego dnia dały ten sam wynik.
 *
 * Wybór jest deterministyczny (hash z userId i daty), więc dwa urządzenia
 * ustalą ten sam cytat niezależnie od siebie. Gdyby mimo to trafiły na
 * wyścig, UNIQUE (user_id, shown_on) rozstrzyga go po stronie bazy, a my
 * czytamy zwycięzcę.
 */
export async function ensureDailyQuote(
  userId: string,
  date: IsoDate,
  language: string,
): Promise<Quote | null> {
  const assigned = await fetchAssignedQuote(date);
  if (assigned !== null) return assigned;

  const seenIds = await fetchSeenQuoteIds();
  const unseen = await fetchCandidates(language, seenIds);
  const pool = unseen.length > 0 ? unseen : await fetchAllActive(language);

  const index = pickQuoteIndex(`${userId}:${date}`, pool.length);
  const chosen = index === -1 ? null : pool[index];
  if (chosen === undefined || chosen === null) return null;

  const { error } = await supabase
    .from('daily_quotes')
    .insert({ user_id: userId, quote_id: chosen.id, shown_on: date });

  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) {
      // Inne urządzenie zdążyło pierwsze — bierzemy jego wybór.
      return fetchAssignedQuote(date);
    }
    throw toDataError(error);
  }

  return chosen;
}

/** Cytaty polubione przez użytkownika, od najnowszego polubienia. */
export async function fetchFavoriteQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quote_favorites')
    .select(`quotes (${QUOTE_COLUMNS})`)
    .order('created_at', { ascending: false });

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => quoteRowSchema.parse(row.quotes));
}

/** Historia cytatów dnia, od najnowszego. */
export async function fetchQuoteHistory(): Promise<{ shownOn: IsoDate; quote: Quote }[]> {
  const { data, error } = await supabase
    .from('daily_quotes')
    .select(`shown_on, quotes (${QUOTE_COLUMNS})`)
    .order('shown_on', { ascending: false })
    .limit(60);

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => ({
    shownOn: row.shown_on,
    quote: quoteRowSchema.parse(row.quotes),
  }));
}
