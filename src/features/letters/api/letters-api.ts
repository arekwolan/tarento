import { letterRowSchema, type Letter } from '@/features/letters/model/letter';
import { toDataError } from '@/lib/data-error';
import { nowIso, type IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/** Wszystkie zapytania o listy żyją w tym pliku. */

const LETTER_COLUMNS = 'id, user_id, body, written_on, deliver_on, delivered_at';

/**
 * Najstarszy list, którego termin już minął, a który jeszcze się nie pokazał.
 *
 * `lte` zamiast `eq`: użytkownik mógł nie otworzyć aplikacji dokładnie w dniu
 * doręczenia, a list nie ma prawa przepaść dlatego, że ktoś wziął urlop.
 */
export async function fetchDueLetter(today: IsoDate): Promise<Letter | null> {
  const { data, error } = await supabase
    .from('letters')
    .select(LETTER_COLUMNS)
    .is('delivered_at', null)
    .lte('deliver_on', today)
    .order('deliver_on', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return letterRowSchema.parse(data);
}

/** Doręczone listy do refleksji, od ostatnio pokazanych. */
export async function fetchDeliveredLetters(): Promise<Letter[]> {
  const { data, error } = await supabase
    .from('letters')
    .select(LETTER_COLUMNS)
    .not('delivered_at', 'is', null)
    .order('delivered_at', { ascending: false })
    .limit(20);

  if (error !== null) throw toDataError(error);

  return letterRowSchema.array().parse(data);
}

/** Stempluje list jako pokazany. Wołane po zamknięciu karty, nie po jej otwarciu. */
export async function markLetterDelivered(letterId: string): Promise<void> {
  const { error } = await supabase
    .from('letters')
    .update({ delivered_at: nowIso() })
    .eq('id', letterId);

  if (error !== null) throw toDataError(error);
}

export type WriteLetterInput = {
  userId: string;
  body: string;
  writtenOn: IsoDate;
  deliverOn: IsoDate;
};

export async function writeLetter(input: WriteLetterInput): Promise<Letter> {
  const { data, error } = await supabase
    .from('letters')
    .insert({
      user_id: input.userId,
      body: input.body,
      written_on: input.writtenOn,
      deliver_on: input.deliverOn,
    })
    .select(LETTER_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return letterRowSchema.parse(data);
}
