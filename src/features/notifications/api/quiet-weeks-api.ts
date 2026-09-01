import { z } from 'zod';

import type { QuietWeek } from '@/features/notifications/model/quiet';
import { toDataError } from '@/lib/data-error';
import { nowIso, type IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const COLUMNS = 'id, user_id, started_on, ends_on, ended_early_at';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

const rowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    started_on: isoDate,
    ends_on: isoDate,
    ended_early_at: z.string().nullable(),
  })
  .transform((row): QuietWeek => ({
    id: row.id,
    startedOn: row.started_on,
    endsOn: row.ends_on,
    endedEarlyAt: row.ended_early_at,
  }));

/** Ostatnie wyciszenie. `null`, gdy jeszcze żadnego nie było. */
export async function fetchLatestQuietWeek(): Promise<QuietWeek | null> {
  const { data, error } = await supabase
    .from('quiet_weeks')
    .select(COLUMNS)
    .order('started_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return rowSchema.parse(data);
}

export async function startQuietWeek(input: {
  userId: string;
  startedOn: IsoDate;
  endsOn: IsoDate;
}): Promise<QuietWeek> {
  const { data, error } = await supabase
    .from('quiet_weeks')
    .insert({
      user_id: input.userId,
      started_on: input.startedOn,
      ends_on: input.endsOn,
    })
    .select(COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return rowSchema.parse(data);
}

/**
 * „Włącz teraz" z ustawień.
 *
 * Wiersz zostaje — od jego daty liczy się odstęp do kolejnego wyciszenia,
 * więc skasowanie go otworzyłoby drogę do wyciszania w kółko.
 */
export async function endQuietWeekEarly(id: string): Promise<void> {
  const { error } = await supabase
    .from('quiet_weeks')
    .update({ ended_early_at: nowIso() })
    .eq('id', id);

  if (error !== null) throw toDataError(error);
}
