import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { resolveAdmin } from '../_shared/admin.ts';
import { hashPrompt } from '../_shared/gemini.ts';
import {
  bearerToken,
  errorResponse,
  jsonResponse,
  preflightResponse,
} from '../_shared/http.ts';
import {
  detectDeterministicRuleConflicts,
  detectStructuralProtocolConflicts,
  PROTOCOL_DAY_KINDS,
  PROTOCOL_TIME_BANDS,
  type ProtocolDayKind,
  type ProtocolDaySlot,
  type ProtocolIncomingStage,
  type ProtocolScheduledItem,
  type ProtocolScheduleType,
  type ProtocolTimeBand,
} from '../_shared/protocol-conflicts.ts';

const ALGORITHM_VERSION = 'protocol-conflicts-local-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type RequestInput = { requestId: string; pathId: string; locale: 'pl' | 'en' };
type ReviewRow = {
  id: string;
  path_id: string;
  input_fingerprint: string;
  state_fingerprint: string;
  status: string;
  semantic_status: string;
};
type StageRow = { id: string; daily_minutes_p50: number; ordinal: number };
type PracticeRow = {
  id: string;
  stage_id: string;
  title: string;
  unit: string;
  start_value: number;
  schedule_type: string;
  schedule_days: number[] | null;
  time_of_day: string | null;
  source_note_ordinals: number[] | null;
};
type HabitRow = {
  id: string;
  title: string;
  unit: string;
  start_value: number;
  schedule_type: string;
  schedule_days: number[] | null;
  time_of_day: string | null;
  source_path_id: string | null;
  source_stage_id: string | null;
};
type ProjectRow = { id: string; path_id: string | null };
type NoteRow = { id: string; project_id: string; ordinal: number; content: string };
type ContextRow = { note_id: string; context_value: string };
type ConflictRow = {
  id: string;
  conflict_type: 'capacity' | 'execution' | 'rule';
  stage_id: string | null;
  incoming_practice_id: string | null;
  existing_habit_id: string | null;
  note_a_id: string | null;
  note_b_id: string | null;
  description: string | null;
  confidence: 'medium' | 'high' | null;
  day_kinds: string[] | null;
  time_of_day: string | null;
  required_minutes: number | null;
  available_minutes: number | null;
  decision: 'context_split' | 'reject_incoming' | 'reject_existing' | null;
  context_a: string | null;
  context_b: string | null;
};

function parseRequest(value: unknown): RequestInput | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !['request_id', 'path_id', 'locale'].includes(key),
    ) ||
    typeof input.request_id !== 'string' ||
    !UUID.test(input.request_id) ||
    typeof input.path_id !== 'string' ||
    !UUID.test(input.path_id) ||
    (input.locale !== 'pl' && input.locale !== 'en')
  ) {
    return null;
  }
  return { requestId: input.request_id, pathId: input.path_id, locale: input.locale };
}

function scheduleType(value: string): ProtocolScheduleType {
  return value === 'weekdays' || value === 'custom' ? value : 'daily';
}

function timeBand(value: string | null): ProtocolTimeBand | null {
  return PROTOCOL_TIME_BANDS.find((band) => band === value) ?? null;
}

function dayKind(value: string): ProtocolDayKind {
  return PROTOCOL_DAY_KINDS.find((kind) => kind === value) ?? 'custom';
}

function itemMinutes(unit: string, startValue: number): number {
  if (unit === 'minutes') return Math.ceil(Math.max(0, startValue));
  if (unit === 'seconds') return Math.ceil(Math.max(0, startValue) / 60);
  return 3;
}

function dayContexts(
  noteOrdinals: readonly number[] | null,
  notes: readonly NoteRow[],
  contexts: ReadonlyMap<string, string>,
): ProtocolDayKind[] | null {
  if (noteOrdinals === null) return null;
  const values = noteOrdinals.flatMap((ordinal) => {
    const note = notes.find((candidate) => candidate.ordinal === ordinal);
    const value = note === undefined ? undefined : contexts.get(note.id);
    return value !== undefined && PROTOCOL_DAY_KINDS.some((kind) => kind === value)
      ? [dayKind(value)]
      : [];
  });
  return values.length === 0 ? null : [...new Set(values)];
}

async function loadConflicts(
  admin: SupabaseClient,
  reviewId: string,
): Promise<ConflictRow[] | null> {
  const { data, error } = await admin
    .from('protocol_conflicts')
    .select(
      'id, conflict_type, stage_id, incoming_practice_id, existing_habit_id, ' +
        'note_a_id, note_b_id, description, confidence, day_kinds, time_of_day, ' +
        'required_minutes, available_minutes, decision, context_a, context_b',
    )
    .eq('review_id', reviewId)
    .is('archived_at', null)
    .order('created_at');
  return error === null ? (data as ConflictRow[]) : null;
}

function responseBody(
  review: Pick<ReviewRow, 'id' | 'semantic_status'>,
  conflicts: readonly ConflictRow[],
  practices: readonly PracticeRow[],
  habits: readonly HabitRow[],
  notes: readonly NoteRow[],
) {
  return {
    review_id: review.id,
    semantic_status: review.semantic_status,
    conflicts: conflicts.map((conflict) => ({
      id: conflict.id,
      type: conflict.conflict_type,
      stage_id: conflict.stage_id,
      incoming_practice_id: conflict.incoming_practice_id,
      incoming_title:
        practices.find((practice) => practice.id === conflict.incoming_practice_id)
          ?.title ?? null,
      existing_habit_id: conflict.existing_habit_id,
      existing_title:
        habits.find((habit) => habit.id === conflict.existing_habit_id)?.title ?? null,
      note_a_id: conflict.note_a_id,
      note_a_text:
        notes.find((note) => note.id === conflict.note_a_id)?.content ?? null,
      note_b_id: conflict.note_b_id,
      note_b_text:
        notes.find((note) => note.id === conflict.note_b_id)?.content ?? null,
      description: conflict.description,
      confidence: conflict.confidence,
      day_kinds: conflict.day_kinds ?? [],
      time_of_day: conflict.time_of_day,
      required_minutes: conflict.required_minutes,
      available_minutes: conflict.available_minutes,
      decision: conflict.decision,
      context_a: conflict.context_a,
      context_b: conflict.context_b,
    })),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 405);

  const resolved = await resolveAdmin(bearerToken(request));
  if (resolved === 'not_configured') return errorResponse('not_configured', 503);
  if (resolved === 'unauthorized') return errorResponse('unauthorized', 401);
  const { admin, userId } = resolved;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse('invalid_input', 400);
  }
  const input = parseRequest(raw);
  if (input === null) return errorResponse('invalid_input', 400);

  const { data: path } = await admin
    .from('paths')
    .select('id')
    .eq('id', input.pathId)
    .eq('owner_id', userId)
    .eq('origin_kind', 'private')
    .eq('path_kind', 'book_protocol')
    .is('archived_at', null)
    .maybeSingle();
  if (path === null) return errorResponse('invalid_input', 404);

  const inputFingerprint = await hashPrompt(
    JSON.stringify({ pathId: input.pathId, locale: input.locale }),
  );
  const { data: stateValue, error: stateError } = await admin.rpc(
    'protocol_conflict_state_fingerprint',
    { p_user_id: userId, p_path_id: input.pathId },
  );
  if (stateError !== null || typeof stateValue !== 'string') {
    return errorResponse('upstream_failed', 502);
  }

  const { data: existingValue } = await admin
    .from('protocol_conflict_reviews')
    .select('id, path_id, input_fingerprint, state_fingerprint, status, semantic_status')
    .eq('owner_id', userId)
    .eq('request_key', input.requestId)
    .maybeSingle();
  const existing = existingValue as ReviewRow | null;
  if (
    existing !== null &&
    (existing.path_id !== input.pathId ||
      existing.input_fingerprint !== inputFingerprint ||
      existing.state_fingerprint !== stateValue)
  ) {
    return errorResponse('invalid_input', 409);
  }

  const { data: stageValues, error: stagesError } = await admin
    .from('path_stages')
    .select('id, daily_minutes_p50, ordinal')
    .eq('path_id', input.pathId)
    .order('ordinal');
  const stages = (stageValues ?? []) as StageRow[];
  if (stagesError !== null || stages.length === 0) {
    return errorResponse('upstream_failed', 502);
  }
  const { data: practiceValues, error: practicesError } = await admin
    .from('path_practices')
    .select(
      'id, stage_id, title, unit, start_value, schedule_type, schedule_days, ' +
        'time_of_day, source_note_ordinals',
    )
    .in('stage_id', stages.map((stage) => stage.id))
    .order('sort_order');
  const practices = (practiceValues ?? []) as PracticeRow[];
  if (practicesError !== null || practices.length === 0) {
    return errorResponse('upstream_failed', 502);
  }

  const { data: habitValues, error: habitsError } = await admin
    .from('habits')
    .select(
      'id, title, unit, start_value, schedule_type, schedule_days, time_of_day, ' +
        'source_path_id, source_stage_id',
    )
    .eq('user_id', userId)
    .is('archived_at', null)
    .is('retired_at', null)
    .limit(50);
  const habits = (habitValues ?? []) as HabitRow[];
  if (habitsError !== null) return errorResponse('upstream_failed', 502);

  const sourcePathIds = [
    input.pathId,
    ...habits.flatMap((habit) =>
      habit.source_path_id === null ? [] : [habit.source_path_id],
    ),
  ];
  const { data: projectValues, error: projectsError } = await admin
    .from('book_lab_projects')
    .select('id, path_id')
    .eq('owner_id', userId)
    .in('path_id', [...new Set(sourcePathIds)])
    .is('archived_at', null);
  const projects = (projectValues ?? []) as ProjectRow[];
  if (projectsError !== null) return errorResponse('upstream_failed', 502);

  const projectIds = projects.map((project) => project.id);
  const { data: noteValues, error: notesError } =
    projectIds.length === 0
      ? { data: [], error: null }
      : await admin
          .from('book_lab_notes')
          .select('id, project_id, ordinal, content')
          .eq('owner_id', userId)
          .in('project_id', projectIds)
          .is('archived_at', null)
          .order('ordinal');
  const notes = (noteValues ?? []) as NoteRow[];
  if (notesError !== null) return errorResponse('upstream_failed', 502);

  const { data: contextValues, error: contextsError } =
    notes.length === 0
      ? { data: [], error: null }
      : await admin
          .from('book_lab_note_contexts')
          .select('note_id, context_value')
          .eq('owner_id', userId)
          .in('note_id', notes.map((note) => note.id));
  if (contextsError !== null) return errorResponse('upstream_failed', 502);
  const contexts = new Map(
    ((contextValues ?? []) as ContextRow[]).map((row) => [
      row.note_id,
      row.context_value,
    ]),
  );

  const activeSourceStageIds = habits.flatMap((habit) =>
    habit.source_stage_id === null ? [] : [habit.source_stage_id],
  );
  const { data: sourcePracticeValues, error: sourcePracticesError } =
    activeSourceStageIds.length === 0
      ? { data: [], error: null }
      : await admin
          .from('path_practices')
          .select(
            'id, stage_id, title, unit, start_value, schedule_type, schedule_days, ' +
              'time_of_day, source_note_ordinals',
          )
          .in('stage_id', [...new Set(activeSourceStageIds)]);
  const sourcePractices = (sourcePracticeValues ?? []) as PracticeRow[];
  if (sourcePracticesError !== null) return errorResponse('upstream_failed', 502);

  const notesForPath = (pathId: string): NoteRow[] => {
    const project = projects.find((candidate) => candidate.path_id === pathId);
    return project === undefined
      ? []
      : notes.filter((note) => note.project_id === project.id);
  };
  const incomingNotes = notesForPath(input.pathId);
  const existingItems: ProtocolScheduledItem[] = habits.map((habit) => {
    const sourcePractice = sourcePractices.find(
      (practice) => practice.stage_id === habit.source_stage_id,
    );
    const sourceNotes =
      habit.source_path_id === null ? [] : notesForPath(habit.source_path_id);
    return {
      id: habit.id,
      stageId: null,
      minutes: itemMinutes(habit.unit, habit.start_value),
      scheduleType: scheduleType(habit.schedule_type),
      scheduleDays: habit.schedule_days,
      timeOfDay: timeBand(habit.time_of_day),
      dayKinds: dayContexts(
        sourcePractice?.source_note_ordinals ?? null,
        sourceNotes,
        contexts,
      ),
    };
  });
  const incomingStages: ProtocolIncomingStage[] = stages.map((stage) => ({
    id: stage.id,
    dailyMinutes: stage.daily_minutes_p50,
    practices: practices
      .filter((practice) => practice.stage_id === stage.id)
      .map((practice) => ({
        id: practice.id,
        stageId: stage.id,
        minutes: itemMinutes(practice.unit, practice.start_value),
        scheduleType: scheduleType(practice.schedule_type),
        scheduleDays: practice.schedule_days,
        timeOfDay: timeBand(practice.time_of_day),
        dayKinds: dayContexts(
          practice.source_note_ordinals,
          incomingNotes,
          contexts,
        ),
      })),
  }));

  const { data: slotValues, error: slotsError } = await admin.rpc(
    'protocol_conflict_day_slots',
    { p_user_id: userId },
  );
  if (slotsError !== null || !Array.isArray(slotValues)) {
    return errorResponse('upstream_failed', 502);
  }
  const daySlots: ProtocolDaySlot[] = slotValues.map((slot) => ({
    dayOfWeek: Number(slot.day_of_week),
    dayKind: dayKind(String(slot.day_kind)),
    availableMinutes: Math.max(0, Number(slot.available_minutes)),
  }));

  let review = existing;
  if (review === null) {
    const { data: created, error: createError } = await admin
      .from('protocol_conflict_reviews')
      .insert({
        owner_id: userId,
        path_id: input.pathId,
        request_key: input.requestId,
        input_fingerprint: inputFingerprint,
        state_fingerprint: stateValue,
        status: 'scanning',
        semantic_status: 'pending',
        algorithm_version: ALGORITHM_VERSION,
      })
      .select('id, path_id, input_fingerprint, state_fingerprint, status, semantic_status')
      .single();
    if (createError !== null || created === null) {
      return errorResponse('upstream_failed', 409);
    }
    review = created as ReviewRow;
  }

  if (review.status === 'ready' || review.status === 'applied') {
    const cached = await loadConflicts(admin, review.id);
    return cached === null
      ? errorResponse('upstream_failed', 502)
      : jsonResponse(responseBody(review, cached, practices, habits, notes), 200);
  }

  const structural = detectStructuralProtocolConflicts(
    incomingStages,
    existingItems,
    daySlots,
  );
  if (structural.length > 0) {
    const { error } = await admin.from('protocol_conflicts').upsert(
      structural.map((conflict) => ({
        review_id: review.id,
        owner_id: userId,
        conflict_key: conflict.key,
        conflict_type: conflict.type,
        stage_id: conflict.stageId,
        incoming_practice_id: conflict.incomingPracticeId,
        existing_habit_id: conflict.existingHabitId,
        day_kinds: conflict.dayKinds,
        time_of_day: conflict.timeOfDay,
        required_minutes: conflict.requiredMinutes,
        available_minutes: conflict.availableMinutes,
      })),
      { onConflict: 'review_id,conflict_key', ignoreDuplicates: true },
    );
    if (error !== null) return errorResponse('upstream_failed', 502);
  }

  const incomingNoteMeta = practices.flatMap((practice) =>
    (practice.source_note_ordinals ?? []).flatMap((ordinal) => {
      const note = incomingNotes.find((candidate) => candidate.ordinal === ordinal);
      return note === undefined
        ? []
        : [{ note, practiceId: practice.id, stageId: practice.stage_id }];
    }),
  );
  const existingNoteMeta = habits.flatMap((habit) => {
    if (habit.source_path_id === null) return [];
    const sourcePractice = sourcePractices.find(
      (practice) => practice.stage_id === habit.source_stage_id,
    );
    const sourceNotes = notesForPath(habit.source_path_id);
    return (sourcePractice?.source_note_ordinals ?? []).flatMap((ordinal) => {
      const note = sourceNotes.find((candidate) => candidate.ordinal === ordinal);
      return note === undefined ? [] : [{ note, habitId: habit.id }];
    });
  });
  const localRuleConflicts = detectDeterministicRuleConflicts(
    existingNoteMeta.map(({ note }) => ({
      id: note.id,
      text: note.content,
      context: contexts.get(note.id) ?? null,
    })),
    incomingNoteMeta.map(({ note }) => ({
      id: note.id,
      text: note.content,
      context: contexts.get(note.id) ?? null,
    })),
  );
  if (localRuleConflicts.length > 0) {
    const description =
      input.locale === 'en'
        ? 'The notes suggest opposite actions in a similar context.'
        : 'Notatki sugerują przeciwne działania w podobnym kontekście.';
    const { error } = await admin.from('protocol_conflicts').upsert(
      localRuleConflicts.map((conflict) => {
        const incoming = incomingNoteMeta.find(
          (candidate) => candidate.note.id === conflict.noteBId,
        );
        const current = existingNoteMeta.find(
          (candidate) => candidate.note.id === conflict.noteAId,
        );
        return {
          review_id: review.id,
          owner_id: userId,
          conflict_key: `rule:${conflict.noteAId}:${conflict.noteBId}`,
          conflict_type: 'rule',
          stage_id: incoming?.stageId ?? null,
          incoming_practice_id: incoming?.practiceId ?? null,
          existing_habit_id: current?.habitId ?? null,
          note_a_id: conflict.noteAId,
          note_b_id: conflict.noteBId,
          description,
          confidence: conflict.confidence,
        };
      }),
      { onConflict: 'review_id,conflict_key', ignoreDuplicates: true },
    );
    if (error !== null) return errorResponse('upstream_failed', 502);
  }

  const semanticStatus =
    incomingNoteMeta.length === 0 || existingNoteMeta.length === 0
      ? 'not_needed'
      : 'complete';
  const { data: ready, error: readyError } = await admin
    .from('protocol_conflict_reviews')
    .update({ status: 'ready', semantic_status: semanticStatus })
    .eq('id', review.id)
    .eq('owner_id', userId)
    .select('id, semantic_status')
    .single();
  if (readyError !== null || ready === null) return errorResponse('upstream_failed', 502);
  const conflicts = await loadConflicts(admin, review.id);
  return conflicts === null
    ? errorResponse('upstream_failed', 502)
    : jsonResponse(responseBody(ready, conflicts, practices, habits, notes), 200);
});
