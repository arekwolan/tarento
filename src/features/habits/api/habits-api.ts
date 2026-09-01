import {
  habitLogRowSchema,
  habitRowSchema,
  type Habit,
  type HabitLog,
  type HabitLogStatus,
  type HabitStreak,
} from '@/features/habits/model/habit';
import type {
  HabitRevisionReason,
  HabitRevisionSource,
} from '@/features/habits/model/revision';
import { dayPlanSchema, type DayPlan } from '@/features/habits/model/day-plan';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/** Wszystkie zapytania do Supabase w tym feature żyją w tym pliku. */

const HABIT_COLUMNS =
  'id, user_id, title, description, icon, color, unit, category, start_value, increment_value, ' +
  'target_value, progression_mode, schedule_type, schedule_days, reminder_time, ' +
  'time_of_day, source_book, source_author, sort_order, source_path_id, ' +
  'source_stage_id, started_on, retired_at, archived_at, created_at, updated_at';

const LOG_COLUMNS =
  'id, habit_id, user_id, log_date, status, target_value, value_completed, note, completed_at';

/**
 * Aktywne nawyki zalogowanego użytkownika.
 *
 * Odpadają dwa rodzaje nieaktywnych: zarchiwizowane przez użytkownika
 * (`archived_at`) i zdjęte z listy przez ścieżkę (`retired_at`). Oba wiersze
 * zostają w bazie i dalej liczą się w statystykach oraz w mapie dni.
 */
export async function fetchActiveHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_COLUMNS)
    .is('archived_at', null)
    .is('retired_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error !== null) throw toDataError(error);

  return habitRowSchema.array().parse(data);
}

export async function fetchLogsForDate(date: IsoDate): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select(LOG_COLUMNS)
    .eq('log_date', date);

  if (error !== null) throw toDataError(error);

  return habitLogRowSchema.array().parse(data);
}

/**
 * Wpisy jednego nawyku od podanej daty.
 *
 * Osobno od `fetchLogsForDate`, bo pytanie jest odwrotne: tam jeden dzień
 * i wszystkie nawyki, tu jeden nawyk i wiele dni. Zakres jest ograniczony
 * datą, a nie liczbą wierszy — historia nawyku prowadzonego od roku nie ma
 * prawa jechać na telefon w całości.
 */
export async function fetchHabitLogsSince(
  habitId: string,
  from: IsoDate,
): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select(LOG_COLUMNS)
    .eq('habit_id', habitId)
    .gte('log_date', from)
    .order('log_date', { ascending: false });

  if (error !== null) throw toDataError(error);

  return habitLogRowSchema.array().parse(data);
}

/**
 * Liczba wykonań każdego nawyku sprzed podanej daty — wejście do progresji
 * w trybie 'completion'. Jedno zapytanie zamiast historii wszystkich logów.
 */
export async function fetchHabitsProgress(before: IsoDate): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_habits_progress', { p_before: before });

  if (error !== null) throw toDataError(error);

  return new Map((data ?? []).map((row) => [row.habit_id, row.completed_count]));
}

/** Historyczna liczba oczekiwanych okazji pod progresję calendar i prognozy. */
export async function fetchHabitPlanProgress(
  before: IsoDate,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_habit_plan_progress', {
    p_before: before,
  });

  if (error !== null) throw toDataError(error);

  return new Map((data ?? []).map((row) => [row.habit_id, row.expected_count]));
}

/** Idempotentnie pobiera albo tworzy kanoniczny snapshot planu. */
export async function ensureDayPlan(date: IsoDate): Promise<DayPlan> {
  const { data, error } = await supabase.rpc('ensure_day_plan', {
    p_plan_date: date,
  });

  if (error !== null) throw toDataError(error);

  return dayPlanSchema.parse(data);
}

export async function fetchHabitStreak(
  habitId: string,
  today: IsoDate,
): Promise<HabitStreak> {
  const { data, error } = await supabase.rpc('get_habit_streak_for_day', {
    p_habit_id: habitId,
    p_today: today,
  });

  if (error !== null) throw toDataError(error);

  const row = data?.[0];
  return {
    currentStreak: row?.current_streak ?? 0,
    longestStreak: row?.longest_streak ?? 0,
  };
}

export type UpsertHabitLogInput = {
  habitId: string;
  userId: string;
  date: IsoDate;
  status: HabitLogStatus;
  /** Snapshot celu na ten dzień — zapisujemy go razem z wpisem. */
  targetValue: number;
  valueCompleted?: number | null;
  note?: string | null;
};

/**
 * Zapisuje wpis na dany dzień. UNIQUE (habit_id, log_date) w bazie sprawia,
 * że powtórne odhaczenie nadpisuje wpis zamiast tworzyć drugi.
 */
export async function upsertHabitLog(input: UpsertHabitLogInput): Promise<HabitLog> {
  const { data, error } = await supabase.rpc('upsert_habit_log_for_plan', {
    p_habit_id: input.habitId,
    p_log_date: input.date,
    p_status: input.status,
    p_target_value: input.targetValue,
    p_value_completed: input.valueCompleted ?? undefined,
    p_note: input.note ?? undefined,
  });

  if (error !== null) throw toDataError(error);

  return habitLogRowSchema.parse(data);
}

/**
 * Cofnięcie odhaczenia. To jedyne miejsce, gdzie kasujemy log — nie jest to
 * usuwanie historii, tylko wycofanie pomyłki z bieżącego dnia
 * (CLAUDE.md, reguła krytyczna 4).
 */
export async function deleteHabitLog(habitId: string, date: IsoDate): Promise<void> {
  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habitId)
    .eq('log_date', date);

  if (error !== null) throw toDataError(error);
}

/**
 * Kasuje wszystkie wpisy użytkownika z jednego dnia.
 *
 * To jest cofnięcie dnia, a nie kasowanie historii: ludzie okłamują serię,
 * potem czują się źle z tym kłamstwem, a potem rezygnują. Czysty sposób na
 * korektę utrzymuje dane prawdziwymi. Polityka DELETE na habit_logs istnieje
 * dokładnie po to (patrz komentarz w migracji habits).
 */
export async function deleteLogsForDate(date: IsoDate): Promise<void> {
  const { error } = await supabase.from('habit_logs').delete().eq('log_date', date);

  if (error !== null) throw toDataError(error);
}

/** Przywraca skasowane wpisy — pod akcję „Cofnij" w toaście. */
export async function restoreHabitLogs(logs: readonly HabitLog[]): Promise<void> {
  if (logs.length === 0) return;

  const { error } = await supabase.from('habit_logs').upsert(
    logs.map((log) => ({
      habit_id: log.habitId,
      user_id: log.userId,
      log_date: log.logDate,
      status: log.status,
      target_value: log.targetValue,
      value_completed: log.valueCompleted,
      note: log.note,
    })),
    { onConflict: 'habit_id,log_date' },
  );

  if (error !== null) throw toDataError(error);
}

/** Serie wszystkich aktywnych nawyków naraz — wersja dla list. */
export async function fetchHabitsStreaks(
  today: IsoDate,
): Promise<Map<string, HabitStreak>> {
  const { data, error } = await supabase.rpc('get_habits_streaks_for_day', {
    p_today: today,
  });

  if (error !== null) throw toDataError(error);

  return new Map(
    (data ?? []).map((row) => [
      row.habit_id,
      { currentStreak: row.current_streak, longestStreak: row.longest_streak },
    ]),
  );
}

// Zapis nawyku ---------------------------------------------------------------

/** Pola, które użytkownik ustawia w formularzu. */
export type HabitWriteInput = {
  title: string;
  description: string | null;
  icon: string | null;
  unit: Habit['unit'];
  category: Habit['category'];
  startValue: number;
  incrementValue: number;
  targetValue: number | null;
  progressionMode: Habit['progressionMode'];
  scheduleType: Habit['scheduleType'];
  scheduleDays: number[] | null;
  reminderTime: string | null;
  timeOfDay: Habit['timeOfDay'];
  sourceBook: string | null;
  sourceAuthor: string | null;
};

function toRow(input: HabitWriteInput) {
  return {
    title: input.title,
    description: input.description,
    icon: input.icon,
    unit: input.unit,
    category: input.category,
    start_value: input.startValue,
    increment_value: input.incrementValue,
    target_value: input.targetValue,
    progression_mode: input.progressionMode,
    schedule_type: input.scheduleType,
    schedule_days: input.scheduleType === 'custom' ? input.scheduleDays : null,
    reminder_time: input.reminderTime,
    time_of_day: input.timeOfDay,
    source_book: input.sourceBook,
    source_author: input.sourceAuthor,
  };
}

export async function fetchHabit(habitId: string): Promise<Habit | null> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_COLUMNS)
    .eq('id', habitId)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return habitRowSchema.parse(data);
}

export async function createHabit(
  userId: string,
  input: HabitWriteInput,
): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ ...toRow(input), user_id: userId })
    .select(HABIT_COLUMNS)
    .single();

  if (error !== null) throw toDataError(error);

  return habitRowSchema.parse(data);
}

/**
 * Zmiana ustawień nawyku.
 *
 * Świadomie nie dotyka habit_logs. Każdy wpis niesie własny snapshot celu,
 * więc podniesienie poprzeczki dziś nie przepisuje tego, co użytkownik
 * zrobił w zeszłym tygodniu.
 */
export async function updateHabit(
  habitId: string,
  input: HabitWriteInput,
  revision: HabitDefinitionRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('update_habit_with_revision', {
    p_habit_id: habitId,
    p_values: toRow(input),
    p_source: revision.source,
    p_reason: revision.reason,
    p_effective_on: revision.effectiveOn,
    p_idempotency_key: revision.requestId,
    p_expected_updated_at: revision.expectedUpdatedAt,
  });

  if (error !== null) throw toDataError(error);

  return habitRowSchema.parse(data);
}

/**
 * Nawyki zdjęte z listy.
 *
 * Osobne zapytanie, bo to inna lista i inne pytanie: `fetchActiveHabits`
 * odpowiada „co odhaczam", a to — „co zbudowałem". Archiwum tu nie wchodzi:
 * zdjęcie z listy nie jest usunięciem.
 */
export async function fetchRetiredHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_COLUMNS)
    .is('archived_at', null)
    .not('retired_at', 'is', null)
    .order('retired_at', { ascending: false });

  if (error !== null) throw toDataError(error);

  return habitRowSchema.array().parse(data);
}

/**
 * Zdejmuje nawyk z listy albo przywraca go na nią.
 *
 * `retired_at` znaczy „zdjęte z listy, historia zostaje" — tak samo, jak gdy
 * robi to ścieżka wycofująca praktykę. Wpisów w habit_logs nie dotykamy:
 * seria zamraża się w dniu zdjęcia (public.get_habit_streak), a nie zeruje.
 */
export type HabitLifecycleRevisionInput = {
  effectiveOn: IsoDate;
  requestId: string;
  expectedUpdatedAt: string;
};

export async function setHabitRetired(
  habitId: string,
  retired: boolean,
  revision: HabitLifecycleRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('set_habit_lifecycle_with_revision', {
    p_habit_id: habitId,
    p_state: retired ? 'retired' : 'active',
    p_effective_on: revision.effectiveOn,
    p_idempotency_key: revision.requestId,
    p_expected_updated_at: revision.expectedUpdatedAt,
  });

  if (error !== null) throw toDataError(error);

  return habitRowSchema.parse(data);
}

/**
 * Zmiana samych parametrów nawyku: wartości i harmonogramu.
 *
 * Wąsko, zamiast przez `updateHabit`: propozycja zmniejszenia dotyka czterech
 * kolumn i nie ma prawa przepisać tytułu, opisu ani przypomnienia przy okazji.
 * Wpisów w habit_logs nie dotyka tak samo jak edycja — każdy z nich niesie
 * własny snapshot celu.
 */
export type HabitParams = {
  startValue: number;
  incrementValue: number;
  scheduleType: Habit['scheduleType'];
  scheduleDays: number[] | null;
};

export type HabitDefinitionRevisionInput = {
  source: Extract<HabitRevisionSource, 'user' | 'downshift' | 'calibration' | 'day_fit'>;
  reason: Extract<
    HabitRevisionReason,
    'user_edit' | 'difficult_period' | 'time_calibration' | 'day_fit'
  >;
  effectiveOn: IsoDate;
  requestId: string;
  expectedUpdatedAt: string;
};

export async function updateHabitParams(
  habitId: string,
  params: HabitParams,
  revision: HabitDefinitionRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('update_habit_with_revision', {
    p_habit_id: habitId,
    p_values: {
      start_value: params.startValue,
      increment_value: params.incrementValue,
      schedule_type: params.scheduleType,
      schedule_days: params.scheduleType === 'custom' ? params.scheduleDays : null,
    },
    p_source: revision.source,
    p_reason: revision.reason,
    p_effective_on: revision.effectiveOn,
    p_idempotency_key: revision.requestId,
    p_expected_updated_at: revision.expectedUpdatedAt,
  });

  if (error !== null) throw toDataError(error);

  return habitRowSchema.parse(data);
}

/**
 * Archiwizacja zamiast usunięcia (CLAUDE.md, reguła krytyczna 4).
 * Nawyk znika z list, ale logi i serie zostają nietknięte.
 */
export async function archiveHabit(
  habitId: string,
  revision: HabitLifecycleRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('set_habit_lifecycle_with_revision', {
    p_habit_id: habitId,
    p_state: 'archived',
    p_effective_on: revision.effectiveOn,
    p_idempotency_key: revision.requestId,
    p_expected_updated_at: revision.expectedUpdatedAt,
  });

  if (error !== null) throw toDataError(error);
  return habitRowSchema.parse(data);
}

/**
 * Odwrócenie archiwizacji — pod akcję „Cofnij" w toaście.
 *
 * Archiwizacja jest miękka, więc cofnięcie to wyzerowanie znacznika. Logi
 * i serie nigdy nie znikały, więc nie ma czego odtwarzać.
 */
export async function unarchiveHabit(
  habitId: string,
  revision: HabitLifecycleRevisionInput,
): Promise<Habit> {
  const { data, error } = await supabase.rpc('set_habit_lifecycle_with_revision', {
    p_habit_id: habitId,
    p_state: 'unarchived',
    p_effective_on: revision.effectiveOn,
    p_idempotency_key: revision.requestId,
    p_expected_updated_at: revision.expectedUpdatedAt,
  });

  if (error !== null) throw toDataError(error);
  return habitRowSchema.parse(data);
}
