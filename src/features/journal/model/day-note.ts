import { z } from 'zod';

import { addDays, type IsoDate } from '@/lib/date';

/**
 * Dziennik jednej linii.
 *
 * Produktem nie jest pisanie, tylko przypomnienie: zdanie wraca po roku
 * i wtedy dopiero coś znaczy. Stąd jedno pole, jeden wpis na dobę i limit
 * długości — dłuższe pole zamieniłoby to w dziennik, a dziennik bez powrotu
 * jest martwy.
 */

/** Ten sam limit co CHECK na public.day_notes.body. */
export const MAX_NOTE_LENGTH = 280;

/**
 * Po ilu dniach wpis wraca.
 *
 * Kolejność jest kolejnością priorytetu: rok bije kwartał, kwartał bije
 * miesiąc. Dziennie wraca dokładnie jeden wpis — dwa naraz zamieniłyby
 * przypomnienie w kanał.
 */
export const RECALL_OFFSETS = [365, 90, 30] as const;

export type RecallOffset = (typeof RECALL_OFFSETS)[number];

export type DayNote = {
  id: string;
  userId: string;
  noteDate: IsoDate;
  body: string;
  createdAt: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

export const dayNoteRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    note_date: isoDate,
    body: z.string(),
    created_at: z.string(),
  })
  .transform((row): DayNote => ({
    id: row.id,
    userId: row.user_id,
    noteDate: row.note_date,
    body: row.body,
    createdAt: row.created_at,
  }));

export type Recall = { note: DayNote; offset: RecallOffset };

/**
 * Wpis, który dziś wraca. `null`, gdy żadna z trzech dat nie ma wpisu.
 *
 * Czysta funkcja: dostaje wszystkie kandydatury i sam dzisiejszy dzień,
 * a rozstrzyga wyłącznie kolejność offsetów.
 */
export function pickRecall(notes: readonly DayNote[], today: IsoDate): Recall | null {
  for (const offset of RECALL_OFFSETS) {
    const day = addDays(today, -offset);
    const note = notes.find((candidate) => candidate.noteDate === day);

    if (note !== undefined) return { note, offset };
  }

  return null;
}

/** Daty, których trzeba poszukać, żeby wiedzieć, czy coś dziś wraca. */
export function recallDates(today: IsoDate): IsoDate[] {
  return RECALL_OFFSETS.map((offset) => addDays(today, -offset));
}
