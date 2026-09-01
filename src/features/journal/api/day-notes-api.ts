import {
  dayNoteRowSchema,
  MAX_NOTE_LENGTH,
  type DayNote,
} from '@/features/journal/model/day-note';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const COLUMNS = 'id, user_id, note_date, body, created_at';

export async function fetchDayNote(date: IsoDate): Promise<DayNote | null> {
  const { data, error } = await supabase
    .from('day_notes')
    .select(COLUMNS)
    .eq('note_date', date)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return dayNoteRowSchema.parse(data);
}

/** Wpisy z konkretnych dat — pod przywołanie sprzed 30, 90 i 365 dni. */
export async function fetchNotesForDates(dates: readonly IsoDate[]): Promise<DayNote[]> {
  if (dates.length === 0) return [];

  const { data, error } = await supabase
    .from('day_notes')
    .select(COLUMNS)
    .in('note_date', [...dates]);

  if (error !== null) throw toDataError(error);

  return dayNoteRowSchema.array().parse(data);
}

/**
 * Zapisuje albo kasuje linię o dniu.
 *
 * Puste pole kasuje wiersz zamiast zapisywać pustkę: CHECK w bazie i tak nie
 * przyjąłby zera znaków, a użytkownik, który wyczyścił pole, chciał się tego
 * zdania pozbyć.
 */
export async function saveDayNote(input: {
  userId: string;
  date: IsoDate;
  body: string;
}): Promise<DayNote | null> {
  const body = input.body.trim().slice(0, MAX_NOTE_LENGTH);

  if (body === '') {
    const { error } = await supabase
      .from('day_notes')
      .delete()
      .eq('note_date', input.date);

    if (error !== null) throw toDataError(error);
    return null;
  }

  const { data, error } = await supabase
    .from('day_notes')
    .upsert(
      { user_id: input.userId, note_date: input.date, body },
      { onConflict: 'user_id,note_date' },
    )
    .select(COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return dayNoteRowSchema.parse(data);
}
