import { countGenerations, resolveAdmin } from '../_shared/admin.ts';
import { loadUserContext } from '../_shared/context.ts';
import { callGemini, geminiConfig, hashPrompt } from '../_shared/gemini.ts';
import {
  bearerToken,
  errorResponse,
  jsonResponse,
  preflightResponse,
} from '../_shared/http.ts';
import {
  isHabitUnit,
  isTimeOfDay,
  toPlanItem,
  type HabitUnit,
  type PlanItem,
  type TimeOfDay,
} from '../_shared/plan-item.ts';
import {
  daysPerWeek,
  isScheduleType,
  toWeekdays,
  type ScheduleType,
} from '../_shared/schedule.ts';
import { validateDownshift, validateProposal } from '../_shared/validate-proposal.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { DOWNSHIFT_RESPONSE_SCHEMA } from './schema.ts';

/**
 * Mniejsza wersja nawyku, który nie wchodzi.
 *
 * Wariant deterministyczny (połowa wartości, zerowy przyrost) jest tu w pełni
 * wystarczający. Model dokłada dwie rzeczy: zdanie wyjaśniające i wybór dni
 * tygodnia oparty na tym, kiedy użytkownikowi realnie wychodzi.
 *
 * DECYZJA DO WERYFIKACJI: jeśli po dwóch tygodniach okaże się, że model nie
 * bije mnożnika 0.5, wytnij wywołanie modelu z tej funkcji i zostaw samo
 * `deterministicProposal()`. Cała reszta przepływu — ekran, arkusz, cofnięcie,
 * telemetria — działa wtedy bez zmiany ani jednej linii.
 */

const GENERATION_KIND = 'downshift';
const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Ile dni historii wchodzi do rozbicia po dniach tygodnia. */
const HISTORY_DAYS = 28;

type Habit = {
  id: string;
  title: string;
  unit: HabitUnit;
  startValue: number;
  incrementValue: number;
  scheduleType: ScheduleType;
  scheduleDays: number[] | null;
  timeOfDay: TimeOfDay;
};

type Proposal = PlanItem & {
  schedule_type: ScheduleType;
  schedule_days: number[] | null;
};

type WeekdayRow = { dow: number; scheduled: number; completed: number };

/** Wiersz z Postgresa → kształt, na którym da się pracować bez rzutowania. */
function toHabit(row: unknown): Habit | null {
  if (typeof row !== 'object' || row === null) return null;

  const raw = row as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  if (!isHabitUnit(raw.unit)) return null;
  if (typeof raw.start_value !== 'number' || typeof raw.increment_value !== 'number') {
    return null;
  }

  return {
    id: raw.id,
    title: raw.title,
    unit: raw.unit,
    startValue: raw.start_value,
    incrementValue: raw.increment_value,
    scheduleType: isScheduleType(raw.schedule_type) ? raw.schedule_type : 'daily',
    scheduleDays: toWeekdays(raw.schedule_days),
    // Nawyk bez przypisanej pory dnia dostaje wieczór: propozycja i tak nie
    // zmienia pory, a PlanItem musi mieć tu wartość.
    timeOfDay: isTimeOfDay(raw.time_of_day) ? raw.time_of_day : 'evening',
  };
}

/** Dni tygodnia, w które nawyk wypada. 0 = niedziela. */
function scheduledWeekdays(habit: Habit): number[] {
  switch (habit.scheduleType) {
    case 'weekdays':
      return [1, 2, 3, 4, 5];
    case 'custom':
      return habit.scheduleDays ?? [];
    case 'daily':
      return [0, 1, 2, 3, 4, 5, 6];
  }
}

/**
 * Wariant deterministyczny.
 *
 * Mirror `deterministicDownshift()` z src/features/habits/model/downshift.ts —
 * ta sama kolejność: najpierw połowa wartości startowej, a gdy nie ma czego
 * dzielić, co drugi dzień z dotychczasowego harmonogramu.
 */
function deterministicProposal(habit: Habit): Proposal {
  const base: PlanItem = {
    title: habit.title,
    rationale: '',
    unit: habit.unit,
    start_value: habit.startValue,
    increment_value: 0,
    time_of_day: habit.timeOfDay,
    // Kategoria nie wpływa na nic w tym przepływie: klient przepisuje
    // wyłącznie wartości i harmonogram, a nawyk ma już swoją.
    category: 'focus',
  };

  const halved = Math.max(1, Math.floor(habit.startValue * 0.5));

  if (halved < habit.startValue) {
    return {
      ...base,
      start_value: halved,
      schedule_type: habit.scheduleType,
      schedule_days: habit.scheduleType === 'custom' ? scheduledWeekdays(habit) : null,
    };
  }

  const days = scheduledWeekdays(habit);

  return {
    ...base,
    schedule_type: 'custom',
    schedule_days: days.filter((_, index) => index % 2 === 0),
  };
}

function readProposal(value: unknown, habit: Habit): Proposal | null {
  const item = toPlanItem(value);
  if (item === null) return null;

  const raw = value as Record<string, unknown>;
  const scheduleType = isScheduleType(raw.schedule_type)
    ? raw.schedule_type
    : habit.scheduleType;
  const scheduleDays =
    scheduleType === 'custom'
      ? (toWeekdays(raw.schedule_days) ?? scheduledWeekdays(habit))
      : null;

  // Tytuł należy do użytkownika: model układa mniejszą wersję tego nawyku,
  // a nie inny nawyk pod tą samą etykietą.
  return {
    ...item,
    title: habit.title,
    schedule_type: scheduleType,
    schedule_days: scheduleDays,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 405);

  const resolved = await resolveAdmin(bearerToken(request));
  if (resolved === 'not_configured') return errorResponse('not_configured', 503);
  if (resolved === 'unauthorized') return errorResponse('unauthorized', 401);

  const { admin, userId } = resolved;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('invalid_input', 400);
  }

  const habitId = typeof body.habit_id === 'string' ? body.habit_id : '';
  if (habitId === '') return errorResponse('invalid_input', 400);

  // Filtr po user_id, mimo klucza service_role: funkcja omija RLS, więc to
  // jedyne miejsce, w którym sprawdza się, czyj to nawyk.
  const { data: habitRow } = await admin
    .from('habits')
    .select(
      'id, title, unit, start_value, increment_value, schedule_type, schedule_days, time_of_day',
    )
    .eq('id', habitId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .is('retired_at', null)
    .maybeSingle();

  const habit = toHabit(habitRow);
  if (habit === null) return errorResponse('invalid_input', 400);

  const used = await countGenerations(
    admin,
    userId,
    GENERATION_KIND,
    RATE_LIMIT_WINDOW_MS,
  );
  if (used === null) return errorResponse('upstream_failed', 502);

  if (used >= RATE_LIMIT_PER_DAY) {
    return jsonResponse(
      { error: 'rate_limited', limit: RATE_LIMIT_PER_DAY, remaining: 0 },
      429,
      { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
    );
  }

  const config = geminiConfig();
  if (config === null) return errorResponse('not_configured', 503);

  const { data: weekdayRows } = await admin.rpc('habit_weekday_completion', {
    p_habit_id: habitId,
    p_days: HISTORY_DAYS,
  });

  const weekdays: WeekdayRow[] = Array.isArray(weekdayRows) ? weekdayRows : [];
  const scheduled = weekdays.reduce((sum, row) => sum + row.scheduled, 0);
  const completed = weekdays.reduce((sum, row) => sum + row.completed, 0);

  const context = await loadUserContext(admin, userId);

  // Bez własnego tytułu: reguła duplikatu ma pilnować, że propozycja nie
  // powiela innego nawyku, a nie że nawyk jest podobny do samego siebie.
  const otherTitles = context.habits
    .map((entry) => entry.title)
    .filter((title) => title !== habit.title);

  const original = {
    unit: habit.unit,
    start_value: habit.startValue,
    increment_value: habit.incrementValue,
    days_per_week: daysPerWeek(habit.scheduleType, habit.scheduleDays),
  };

  const promptInput = {
    title: habit.title,
    unit: habit.unit,
    startValue: habit.startValue,
    incrementValue: habit.incrementValue,
    scheduleType: habit.scheduleType,
    scheduleDays: habit.scheduleDays,
    timeOfDay: habit.timeOfDay,
    weekdays,
    completed,
    scheduled,
  };

  let proposal: Proposal | null = null;
  let rejectedReason: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let retryReason = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callGemini({
      config,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(promptInput, retryReason),
      responseSchema: DOWNSHIFT_RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 512,
    });

    if (!result.ok) {
      return errorResponse(
        result.reason,
        result.reason === 'upstream_failed' ? 502 : 422,
      );
    }

    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;

    const candidate = readProposal(result.value, habit);

    if (candidate === null) {
      rejectedReason = 'not_smaller';
      retryReason = 'Odpowiedź nie miała wymaganych pól.';
      continue;
    }

    const violation =
      validateProposal([candidate], {
        allocatedMinutes: context.allocatedMinutes,
        existingTitles: otherTitles,
      }) ??
      validateDownshift(original, {
        unit: candidate.unit,
        start_value: candidate.start_value,
        increment_value: candidate.increment_value,
        days_per_week: daysPerWeek(candidate.schedule_type, candidate.schedule_days),
      });

    if (violation === null) {
      proposal = candidate;
      rejectedReason = null;
      break;
    }

    rejectedReason = violation.rule;
    retryReason = violation.message;
  }

  // Wariant deterministyczny zamiast błędu: użytkownik nacisnął „Zmniejsz",
  // więc dostaje mniejszą wersję nawyku, choćby najprostszą z możliwych.
  if (proposal === null) proposal = deterministicProposal(habit);

  const { data: generation } = await admin
    .from('ai_generations')
    .insert({
      user_id: userId,
      kind: GENERATION_KIND,
      model: config.model,
      prompt_hash: await hashPrompt(habitId),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response: proposal,
      rejected_reason: rejectedReason,
    })
    .select('id')
    .single();

  return jsonResponse(
    {
      proposal,
      generation_id: generation?.id ?? null,
      remaining: Math.max(0, RATE_LIMIT_PER_DAY - used - 1),
    },
    200,
  );
});
