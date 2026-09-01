import { z } from 'zod';

import { toDataError } from '@/lib/data-error';
import { nowIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/**
 * Ślad po propozycji zdjęcia nawyku z listy.
 *
 * Wiersz powstaje w chwili, gdy pytanie pada. Dzięki temu „raz na dziewięćdziesiąt
 * dni" obowiązuje także wtedy, gdy użytkownik nic nie odpowie — a odpowiedź
 * („Zdejmij z listy" albo „Zostaw") kończy pytanie od razu.
 */

const COLUMNS = 'id, habit_id, user_id, offered_at, accepted_at, declined_at';

const offerRowSchema = z
  .object({
    id: z.string(),
    habit_id: z.string(),
    user_id: z.string(),
    offered_at: z.string(),
    accepted_at: z.string().nullable(),
    declined_at: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    offeredAt: row.offered_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
  }));

export type RetirementOffer = z.infer<typeof offerRowSchema>;

export async function fetchLastRetirementOffer(
  habitId: string,
): Promise<RetirementOffer | null> {
  const { data, error } = await supabase
    .from('habit_retirements')
    .select(COLUMNS)
    .eq('habit_id', habitId)
    .order('offered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return offerRowSchema.parse(data);
}

export async function recordRetirementOffer(input: {
  habitId: string;
  userId: string;
}): Promise<RetirementOffer> {
  const { data, error } = await supabase
    .from('habit_retirements')
    .insert({ habit_id: input.habitId, user_id: input.userId })
    .select(COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return offerRowSchema.parse(data);
}

/**
 * Odpowiedź użytkownika.
 *
 * `accepted` zdejmuje nawyk z listy, `declined` zostawia go na niej. Obie
 * kończą pytanie — różnią się tym, co znaczą w telemetrii, a nie tym, jak
 * długo milczymy.
 */
export async function decideRetirementOffer(
  offerId: string,
  decision: 'accepted' | 'declined' | 'pending',
): Promise<void> {
  const timestamp = nowIso();

  const { error } = await supabase
    .from('habit_retirements')
    .update({
      accepted_at: decision === 'accepted' ? timestamp : null,
      declined_at: decision === 'declined' ? timestamp : null,
    })
    .eq('id', offerId);

  if (error !== null) throw toDataError(error);
}
