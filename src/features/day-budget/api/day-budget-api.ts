import {
  draftBusySpans,
  weeklyRotation,
  type DayShapeDraft,
} from '@/features/day-budget/model/day-shape';
import {
  dayBlockRowSchema,
  dayRotationRowSchema,
  dayTemplateRowSchema,
  type DayBlock,
  type DayBlockKind,
  type DayRotation,
  type DayTemplate,
  type DayTemplateKind,
} from '@/features/day-budget/model/schemas';
import { toDataError } from '@/lib/data-error';
import { nowIso, type IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/** Wszystkie zapytania do Supabase w tym feature żyją w tym pliku. */

const TEMPLATE_COLUMNS =
  'id, user_id, name, kind, wake_time, sleep_time, self_minutes, sort_order, ' +
  'archived_at, created_at, updated_at';

const BLOCK_COLUMNS =
  'id, template_id, user_id, label, kind, start_time, end_time, archived_at';

const ROTATION_COLUMNS = 'id, user_id, anchor_date, template_ids, created_at, updated_at';

/** Aktywne szablony doby zalogowanego użytkownika. Archiwum nie wchodzi. */
export async function fetchDayTemplates(): Promise<DayTemplate[]> {
  const { data, error } = await supabase
    .from('day_templates')
    .select(TEMPLATE_COLUMNS)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error !== null) throw toDataError(error);

  return dayTemplateRowSchema.array().parse(data);
}

/**
 * Aktywne bloki wszystkich szablonów naraz.
 *
 * Jedno zapytanie zamiast osobnego na każdy dzień: bloków jest najwyżej
 * kilkadziesiąt (28 szablonów × kilka pasów), a dzięki temu przewijanie
 * kalendarza w przód nie generuje ruchu ani nie wymaga sieci.
 */
export async function fetchDayBlocks(): Promise<DayBlock[]> {
  const { data, error } = await supabase
    .from('day_blocks')
    .select(BLOCK_COLUMNS)
    .is('archived_at', null)
    .order('start_time', { ascending: true });

  if (error !== null) throw toDataError(error);

  return dayBlockRowSchema.array().parse(data);
}

/** Rotacja użytkownika. `null`, dopóki nie przejdzie onboardingu kształtu dnia. */
export async function fetchDayRotation(): Promise<DayRotation | null> {
  const { data, error } = await supabase
    .from('day_rotations')
    .select(ROTATION_COLUMNS)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return dayRotationRowSchema.parse(data);
}

// Zapis kształtu dnia -------------------------------------------------------

export type DayTemplateWriteInput = {
  name: string;
  kind: DayTemplateKind;
  wakeTime: string;
  sleepTime: string;
  selfMinutes: number;
  sortOrder: number;
};

export type DayBlockWriteInput = {
  templateId: string;
  kind: DayBlockKind;
  startTime: string;
  endTime: string;
  label?: string | null;
};

export async function createDayTemplate(
  userId: string,
  input: DayTemplateWriteInput,
): Promise<DayTemplate> {
  const { data, error } = await supabase
    .from('day_templates')
    .insert({
      user_id: userId,
      name: input.name,
      kind: input.kind,
      wake_time: input.wakeTime,
      sleep_time: input.sleepTime,
      self_minutes: input.selfMinutes,
      sort_order: input.sortOrder,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return dayTemplateRowSchema.parse(data);
}

export async function createDayBlocks(
  userId: string,
  rows: readonly DayBlockWriteInput[],
): Promise<DayBlock[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from('day_blocks')
    .insert(
      rows.map((row) => ({
        user_id: userId,
        template_id: row.templateId,
        kind: row.kind,
        start_time: row.startTime,
        end_time: row.endTime,
        label: row.label ?? null,
      })),
    )
    .select(BLOCK_COLUMNS);

  if (error !== null) throw toDataError(error);

  return dayBlockRowSchema.array().parse(data);
}

/**
 * Rotacja jest jedna na użytkownika (UNIQUE na user_id), więc zapis to upsert.
 * To nie są dane historyczne — nadpisanie niczego nie zabiera.
 */
export async function upsertDayRotation(
  userId: string,
  anchorDate: IsoDate,
  templateIds: readonly string[],
): Promise<DayRotation> {
  const { data, error } = await supabase
    .from('day_rotations')
    .upsert(
      { user_id: userId, anchor_date: anchorDate, template_ids: [...templateIds] },
      { onConflict: 'user_id' },
    )
    .select(ROTATION_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return dayRotationRowSchema.parse(data);
}

/**
 * Archiwizuje bieżący kształt dnia (CLAUDE.md, reguła krytyczna 4 — nie
 * kasujemy).
 *
 * Wołane przed zapisem nowego: bez tego ponowienie po nieudanej próbie
 * zostawiłoby drugi komplet szablonów, do którego rotacja już nie prowadzi.
 */
export async function archiveDayShape(): Promise<void> {
  const archivedAt = nowIso();

  const blocks = await supabase
    .from('day_blocks')
    .update({ archived_at: archivedAt })
    .is('archived_at', null);

  if (blocks.error !== null) throw toDataError(blocks.error);

  const templates = await supabase
    .from('day_templates')
    .update({ archived_at: archivedAt })
    .is('archived_at', null);

  if (templates.error !== null) throw toDataError(templates.error);
}

export type SaveDayShapeInput = {
  userId: string;
  /** Dzień, od którego liczy się rotacja — wynik useLogicalToday(). */
  anchorDate: IsoDate;
  draft: DayShapeDraft;
  /** Nazwy szablonów przychodzą z i18n; w bazie zostają w języku onboardingu. */
  workdayName: string;
  freeName: string;
};

/**
 * Cały zapis kroku „kształt dnia": dwa szablony (roboczy z pasami i wolny bez
 * nich) plus siedmiodniowa rotacja.
 *
 * Klient nie ma transakcji, więc kolejność jest istotna: szablony muszą
 * istnieć, zanim wskaże je rotacja. Przy błędzie w połowie użytkownik zostaje
 * bez rotacji, a ponowienie zaczyna od archiwizacji i układa komplet od nowa.
 */
export async function saveDayShape(input: SaveDayShapeInput): Promise<void> {
  const { draft, userId } = input;

  await archiveDayShape();

  const shape = {
    wakeTime: draft.wakeTime,
    sleepTime: draft.sleepTime,
    selfMinutes: draft.selfMinutes,
  };

  const workday = await createDayTemplate(userId, {
    ...shape,
    name: input.workdayName,
    kind: 'workday',
    sortOrder: 0,
  });

  // Dzień wolny kopiuje pobudkę, sen i deklarację, ale nie ma zajętych pasów —
  // zaawansowana konfiguracja trafi do ustawień, nie do onboardingu.
  const free = await createDayTemplate(userId, {
    ...shape,
    name: input.freeName,
    kind: 'free',
    sortOrder: 1,
  });

  await createDayBlocks(
    userId,
    draftBusySpans(draft).map((span) => ({
      templateId: workday.id,
      kind: 'work' as const,
      startTime: span.startTime,
      endTime: span.endTime,
    })),
  );

  await upsertDayRotation(
    userId,
    input.anchorDate,
    weeklyRotation(input.anchorDate, workday.id, free.id),
  );
}
