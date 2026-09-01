import { countGenerations, resolveAdmin } from '../_shared/admin.ts';
import { callGemini, geminiConfig, hashPrompt } from '../_shared/gemini.ts';
import {
  bearerToken,
  errorResponse,
  jsonResponse,
  preflightResponse,
} from '../_shared/http.ts';
import { loadBookLabContext, type BookLabContext } from './context.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { BOOK_LAB_PROMPT_VERSION, BOOK_LAB_RESPONSE_SCHEMA } from './schema.ts';
import {
  parseBookLabRequest,
  validateBookLabModelResult,
  type BookLabDraft,
  type BookLabModelResult,
  type BookLabRequestInput,
} from './validator.ts';

const GENERATION_KIND = 'book_lab';
const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_GENERATION_MS = 2 * 60 * 1000;

type StoredProject = {
  id: string;
  status: string;
  generated_draft: unknown;
  path_id: string | null;
  base_path_id: string | null;
  source_title: string;
  source_author: string;
  desired_change: string;
  locale: string;
  updated_at: string;
};

type StoredEnvelope = {
  status: BookLabModelResult['status'];
  draft: BookLabDraft | null;
};

const PROJECT_COLUMNS =
  'id, status, generated_draft, path_id, base_path_id, source_title, ' +
  'source_author, desired_change, locale, updated_at';

function projectMatchesInput(
  project: StoredProject,
  input: BookLabRequestInput,
): boolean {
  return (
    project.base_path_id === input.basePathId &&
    project.source_title === input.sourceTitle &&
    project.source_author === input.sourceAuthor &&
    project.desired_change === input.desiredChange &&
    project.locale === input.locale
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedEnvelope(value: unknown): StoredEnvelope | null {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => ['status', 'draft'].includes(key))
  ) {
    return null;
  }
  const status = value.status;
  const draft = value.draft;
  if (status !== 'ok' && status !== 'out_of_scope' && status !== 'unsafe') return null;
  const validated = validateBookLabModelResult(
    status === 'ok' && isRecord(draft)
      ? { status, ...draft }
      : { status, title: '', summary: '', stages: [] },
    { safeMinutes: 45, noteOrdinals: [1, 2, 3, 4, 5, 6, 7], noteTexts: [] },
  );
  return 'rule' in validated ? null : validated;
}

function successResponse(
  project: StoredProject,
  envelope: StoredEnvelope,
  context: BookLabContext,
  remaining: number | null,
): Response {
  return jsonResponse(
    {
      project_id: project.id,
      path_id: project.path_id,
      status: envelope.status,
      draft: envelope.draft,
      context,
      remaining,
    },
    200,
  );
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

  const input = parseBookLabRequest(raw);
  if (input === null) return errorResponse('invalid_input', 400);

  if (input.basePathId !== null) {
    const { data: base } = await admin
      .from('paths')
      .select('id')
      .eq('id', input.basePathId)
      .eq('owner_id', userId)
      .eq('origin_kind', 'private')
      .maybeSingle();
    if (base === null) return errorResponse('invalid_input', 400);
  }

  const context = await loadBookLabContext(admin, userId);
  if (context.safeMinutes < 1) {
    return jsonResponse(
      {
        project_id: null,
        path_id: null,
        status: 'insufficient_budget',
        draft: null,
        context,
        remaining: null,
      },
      200,
    );
  }

  const { data: existingValue } = await admin
    .from('book_lab_projects')
    .select(PROJECT_COLUMNS)
    .eq('owner_id', userId)
    .eq('request_key', input.requestId)
    .maybeSingle();
  const existing = existingValue as StoredProject | null;
  if (existing !== null && !projectMatchesInput(existing, input)) {
    return errorResponse('invalid_input', 409);
  }
  const cached = existing === null ? null : storedEnvelope(existing.generated_draft);
  if (existing !== null && cached !== null && existing.status !== 'archived') {
    return successResponse(existing, cached, context, null);
  }
  if (
    existing?.status === 'generating' &&
    Date.parse(existing.updated_at) > Date.now() - STALE_GENERATION_MS
  ) {
    return errorResponse('upstream_failed', 409);
  }
  if (existing?.status === 'archived') return errorResponse('invalid_input', 400);

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

  let project: StoredProject;
  if (existing === null) {
    const { data: created, error } = await admin
      .from('book_lab_projects')
      .insert({
        owner_id: userId,
        request_key: input.requestId,
        base_path_id: input.basePathId,
        source_title: input.sourceTitle,
        source_author: input.sourceAuthor,
        desired_change: input.desiredChange,
        locale: input.locale,
        prompt_version: BOOK_LAB_PROMPT_VERSION,
        status: 'generating',
      })
      .select(PROJECT_COLUMNS)
      .single();
    if (error !== null || created === null) {
      // Wyścig dwóch identycznych requestów kończy się jednym projektem.
      const { data: winner } = await admin
        .from('book_lab_projects')
        .select(PROJECT_COLUMNS)
        .eq('owner_id', userId)
        .eq('request_key', input.requestId)
        .maybeSingle();
      const winnerProject = winner as StoredProject | null;
      const winnerEnvelope =
        winnerProject === null ? null : storedEnvelope(winnerProject.generated_draft);
      if (winnerProject !== null && winnerEnvelope !== null) {
        return successResponse(winnerProject, winnerEnvelope, context, null);
      }
      return errorResponse('upstream_failed', 409);
    }
    project = created as StoredProject;

    const { error: notesError } = await admin.from('book_lab_notes').insert(
      input.notes.map((note) => ({
        project_id: project.id,
        owner_id: userId,
        ordinal: note.ordinal,
        content: note.content,
        source_locator: note.sourceLocator,
      })),
    );
    if (notesError !== null) {
      await admin
        .from('book_lab_projects')
        .update({ status: 'failed' })
        .eq('id', project.id);
      return errorResponse('upstream_failed', 502);
    }
  } else {
    project = existing;
    const { data: storedNotes, error: storedNotesError } = await admin
      .from('book_lab_notes')
      .select('ordinal, content, source_locator')
      .eq('project_id', project.id)
      .is('archived_at', null)
      .order('ordinal');
    if (storedNotesError !== null) return errorResponse('upstream_failed', 502);
    if (storedNotes.length === 0) {
      const { error: notesError } = await admin.from('book_lab_notes').insert(
        input.notes.map((note) => ({
          project_id: project.id,
          owner_id: userId,
          ordinal: note.ordinal,
          content: note.content,
          source_locator: note.sourceLocator,
        })),
      );
      if (notesError !== null) return errorResponse('upstream_failed', 502);
    } else if (
      storedNotes.length !== input.notes.length ||
      storedNotes.some((note, index) => {
        const expected = input.notes[index];
        return (
          expected === undefined ||
          note.ordinal !== expected.ordinal ||
          note.content !== expected.content ||
          note.source_locator !== expected.sourceLocator
        );
      })
    ) {
      return errorResponse('invalid_input', 409);
    }
    await admin
      .from('book_lab_projects')
      .update({ status: 'generating' })
      .eq('id', project.id);
  }

  let result: BookLabModelResult | null = null;
  let rejectedReason: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let retryReason = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const model = await callGemini({
      config,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(
        {
          desiredChange: input.desiredChange,
          notes: input.notes,
          locale: input.locale,
          context,
        },
        retryReason,
      ),
      responseSchema: BOOK_LAB_RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 3072,
    });
    if (!model.ok) {
      await admin
        .from('book_lab_projects')
        .update({ status: 'failed' })
        .eq('id', project.id);
      return errorResponse(model.reason, model.reason === 'upstream_failed' ? 502 : 422);
    }

    inputTokens = model.inputTokens;
    outputTokens = model.outputTokens;
    const validated = validateBookLabModelResult(model.value, {
      safeMinutes: context.safeMinutes,
      noteOrdinals: input.notes.map((note) => note.ordinal),
      noteTexts: input.notes.map((note) => note.content),
    });
    if (!('rule' in validated)) {
      result = validated;
      rejectedReason = null;
      break;
    }

    rejectedReason = validated.rule;
    retryReason = validated.message;
  }

  if (result === null) {
    await admin
      .from('book_lab_projects')
      .update({ status: 'failed' })
      .eq('id', project.id);
    await admin.from('ai_generations').insert({
      user_id: userId,
      kind: GENERATION_KIND,
      model: config.model,
      prompt_hash: await hashPrompt(input.requestId),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response: { status: 'rejected', stage_count: 0 },
      rejected_reason: rejectedReason,
    });
    return errorResponse('invalid_model_output', 422);
  }

  const envelope: StoredEnvelope = { status: result.status, draft: result.draft };
  await admin
    .from('book_lab_projects')
    .update({ status: 'generated', generated_draft: envelope })
    .eq('id', project.id);

  // Tylko koszt i wynik walidacji. Prywatny tytuł, notatki i tekst draftu nie
  // trafiają do tabeli używanej do pomiaru wywołań AI.
  await admin.from('ai_generations').insert({
    user_id: userId,
    kind: GENERATION_KIND,
    model: config.model,
    prompt_hash: await hashPrompt(input.requestId),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    response: { status: result.status, stage_count: result.draft?.stages.length ?? 0 },
    rejected_reason: rejectedReason,
  });

  project = { ...project, status: 'generated', generated_draft: envelope };
  return successResponse(
    project,
    envelope,
    context,
    Math.max(0, RATE_LIMIT_PER_DAY - used - 1),
  );
});
