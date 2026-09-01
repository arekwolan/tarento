import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

/** Identyfikatory cytatów polubionych przez użytkownika. */
export async function fetchFavoriteQuoteIds(): Promise<string[]> {
  const { data, error } = await supabase.from('quote_favorites').select('quote_id');

  if (error !== null) throw toDataError(error);

  return (data ?? []).map((row) => row.quote_id);
}

export async function addQuoteFavorite(userId: string, quoteId: string): Promise<void> {
  const { error } = await supabase
    .from('quote_favorites')
    .insert({ user_id: userId, quote_id: quoteId });

  if (error !== null) throw toDataError(error);
}

/**
 * Zdjęcie serduszka. Fizyczny DELETE jest tu na miejscu — to cofnięcie
 * gestu, a nie kasowanie historii (CLAUDE.md, reguła krytyczna 4).
 */
export async function removeQuoteFavorite(quoteId: string): Promise<void> {
  const { error } = await supabase
    .from('quote_favorites')
    .delete()
    .eq('quote_id', quoteId);

  if (error !== null) throw toDataError(error);
}
