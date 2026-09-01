import { z } from 'zod';

import type { HabitParams } from '@/features/habits/api/habits-api';
import { toDataError } from '@/lib/data-error';
import { nowIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/**
 * Ślad po propozycji zmniejszenia nawyku.
 *
 * Wiersz powstaje w chwili, gdy pytanie pada — nie wtedy, gdy pada odpowiedź.
 * Dzięki temu `offered_at` naprawdę znaczy „pytaliśmy" i pytanie nie wraca
 * przy każdym wejściu w szczegóły nawyku.
 */

const COLUMNS = 'id, habit_id, user_id, offered_at, accepted_at, from_params, to_params';

const habitParamsSchema = z.object({
  start_value: z.number(),
  increment_value: z.number(),
  schedule_type: z.enum(['daily', 'weekdays', 'custom']),
  schedule_days: z.array(z.number().int().min(0).max(6)).nullable(),
});

const offerRowSchema = z
  .object({
    id: z.string(),
    habit_id: z.string(),
    user_id: z.string(),
    offered_at: z.string(),
    accepted_at: z.string().nullable(),
    from_params: habitParamsSchema,
    to_params: habitParamsSchema.nullable(),
  })
  .transform((row) => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    offeredAt: row.offered_at,
    acceptedAt: row.accepted_at,
    fromParams: toHabitParams(row.from_params),
  }));

export type DownshiftOffer = z.infer<typeof offerRowSchema>;

type ParamsRow = z.infer<typeof habitParamsSchema>;

function toHabitParams(row: ParamsRow): HabitParams {
  return {
    startValue: row.start_value,
    incrementValue: row.increment_value,
    scheduleType: row.schedule_type,
    scheduleDays: row.schedule_days,
  };
}

/** camelCase w TypeScripcie, snake_case w bazie — także wewnątrz jsonb. */
function toParamsRow(params: HabitParams): ParamsRow {
  return {
    start_value: params.startValue,
    increment_value: params.incrementValue,
    schedule_type: params.scheduleType,
    schedule_days: params.scheduleType === 'custom' ? params.scheduleDays : null,
  };
}

/** Ostatnia propozycja dla nawyku. `null`, gdy jeszcze żadnej nie było. */
export async function fetchLastDownshiftOffer(
  habitId: string,
): Promise<DownshiftOffer | null> {
  const { data, error } = await supabase
    .from('habit_downshifts')
    .select(COLUMNS)
    .eq('habit_id', habitId)
    .order('offered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return offerRowSchema.parse(data);
}

export async function recordDownshiftOffer(input: {
  habitId: string;
  userId: string;
  fromParams: HabitParams;
}): Promise<DownshiftOffer> {
  const { data, error } = await supabase
    .from('habit_downshifts')
    .insert({
      habit_id: input.habitId,
      user_id: input.userId,
      from_params: toParamsRow(input.fromParams),
    })
    .select(COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return offerRowSchema.parse(data);
}

/** Propozycja zastosowana: zapisujemy, na co, i kiedy. */
export async function acceptDownshiftOffer(
  offerId: string,
  toParams: HabitParams,
): Promise<void> {
  const { error } = await supabase
    .from('habit_downshifts')
    .update({ accepted_at: nowIso(), to_params: toParamsRow(toParams) })
    .eq('id', offerId);

  if (error !== null) throw toDataError(error);
}

/**
 * Cofnięcie.
 *
 * Czyścimy `accepted_at`, a `offered_at` zostaje: propozycję pokazano, więc
 * nie ma wracać przez kolejne trzydzieści dni — ale przyjęta nie została
 * i telemetria ma o tym mówić prawdę.
 */
export async function revertDownshiftOffer(offerId: string): Promise<void> {
  const { error } = await supabase
    .from('habit_downshifts')
    .update({ accepted_at: null })
    .eq('id', offerId);

  if (error !== null) throw toDataError(error);
}
