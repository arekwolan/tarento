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
  checkPathFit,
  deterministicPathFit,
  toPathFit,
  type PathFit,
} from '../_shared/path-fit.ts';
import {
  validatePathFit,
  type FitPractice,
  type FitStage,
} from '../_shared/validate-proposal.ts';
import { buildUserPrompt, SYSTEM_PROMPT, type FitPromptPractice } from './prompt.ts';
import { PATH_FIT_RESPONSE_SCHEMA } from './schema.ts';

/**
 * Dopasowanie ścieżki do kontekstu użytkownika.
 *
 * Raz, przy zapisie — nie codziennie i nie przy każdym etapie. Ryzyko jest
 * małe z dwóch powodów naraz: wynik przechodzi przez ekran przeglądu, na
 * którym użytkownik widzi każdą różnicę, i istnieje wariant deterministyczny,
 * przy którym ścieżka działa w całości bez ani jednego wywołania modelu.
 */

const GENERATION_KIND = 'path_fit';
const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type StageRow = {
  id: string;
  ordinal: number;
  name: string;
  daily_minutes_p50: number;
};

type PracticeRow = {
  id: string;
  stage_id: string;
  title: string;
  unit: string;
  start_value: number;
  time_of_day: string | null;
  is_optional: boolean;
};

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

  const pathId = typeof body.path_id === 'string' ? body.path_id : '';
  if (pathId === '') return errorResponse('invalid_input', 400);

  const { data: pathRow } = await admin
    .from('paths')
    .select('id, title')
    .eq('id', pathId)
    .eq('is_published', true)
    .maybeSingle();

  if (pathRow === null || pathRow === undefined) {
    return errorResponse('invalid_input', 400);
  }

  const { data: stageRows } = await admin
    .from('path_stages')
    .select('id, ordinal, name, daily_minutes_p50')
    .eq('path_id', pathId)
    .order('ordinal', { ascending: true });

  const stages: StageRow[] = Array.isArray(stageRows) ? stageRows : [];
  if (stages.length === 0) return errorResponse('invalid_input', 400);

  const { data: practiceRows } = await admin
    .from('path_practices')
    .select('id, stage_id, title, unit, start_value, time_of_day, is_optional')
    .in(
      'stage_id',
      stages.map((stage) => stage.id),
    )
    .order('sort_order', { ascending: true });

  const practices: PracticeRow[] = Array.isArray(practiceRows) ? practiceRows : [];

  const context = await loadUserContext(admin, userId);

  const fitStages: FitStage[] = stages.map((stage) => ({
    id: stage.id,
    ordinal: stage.ordinal,
    dailyMinutesP50: stage.daily_minutes_p50,
  }));
  const fitPractices: FitPractice[] = practices.map((practice) => ({
    id: practice.id,
    stageId: practice.stage_id,
    startValue: practice.start_value,
  }));

  const { verdict } = checkPathFit(fitStages, context.allocatedMinutes);
  const fallback = deterministicPathFit(verdict);

  const used = await countGenerations(
    admin,
    userId,
    GENERATION_KIND,
    RATE_LIMIT_WINDOW_MS,
  );

  // Limit i brak sekretów nie są tu błędem: ścieżka ma się zapisać bez modelu,
  // więc oddajemy wariant deterministyczny i kończymy.
  const config = geminiConfig();
  if (used === null || used >= RATE_LIMIT_PER_DAY || config === null) {
    return jsonResponse({ fit: fallback, generation_id: null, remaining: 0 }, 200);
  }

  const stageOrdinalById = new Map(stages.map((stage) => [stage.id, stage.ordinal]));
  const promptPractices: FitPromptPractice[] = practices.map((practice) => ({
    id: practice.id,
    stageOrdinal: stageOrdinalById.get(practice.stage_id) ?? 1,
    title: practice.title,
    unit: practice.unit,
    startValue: practice.start_value,
    timeOfDay: practice.time_of_day,
    isOptional: practice.is_optional,
  }));

  const promptInput = {
    pathTitle: typeof pathRow.title === 'string' ? pathRow.title : '',
    stages: stages.map((stage) => ({
      ordinal: stage.ordinal,
      name: stage.name,
      dailyMinutesP50: stage.daily_minutes_p50,
    })),
    practices: promptPractices,
    habits: context.habits,
    allocatedMinutes: context.allocatedMinutes,
    verdict,
  };

  let fit: PathFit | null = null;
  let rejectedReason: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let retryReason = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callGemini({
      config,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(promptInput, retryReason),
      responseSchema: PATH_FIT_RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 1024,
    });

    if (!result.ok) {
      // Także tutaj bez błędu na ekranie: zapis na ścieżkę ma iść dalej.
      return jsonResponse({ fit: fallback, generation_id: null, remaining: 0 }, 200);
    }

    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;

    const candidate = toPathFit(result.value);

    if (candidate === null) {
      rejectedReason = 'fit_adjust';
      retryReason = 'Odpowiedź nie miała wymaganych pól.';
      continue;
    }

    const violation = validatePathFit(candidate, {
      allocatedMinutes: context.allocatedMinutes,
      stages: fitStages,
      practices: fitPractices,
    });

    if (violation === null) {
      // Werdykt bramki jest nadrzędny wobec zdania modelu: przy `lite` wariant
      // lekki obowiązuje niezależnie od tego, co model wpisał w pole.
      fit = { ...candidate, lite: candidate.lite || verdict === 'lite' };
      rejectedReason = null;
      break;
    }

    rejectedReason = violation.rule;
    retryReason = violation.message;
  }

  const finalFit = fit ?? fallback;

  const { data: generation } = await admin
    .from('ai_generations')
    .insert({
      user_id: userId,
      kind: GENERATION_KIND,
      model: config.model,
      prompt_hash: await hashPrompt(pathId),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response: finalFit,
      rejected_reason: rejectedReason,
    })
    .select('id')
    .single();

  return jsonResponse(
    {
      fit: finalFit,
      generation_id: generation?.id ?? null,
      remaining: Math.max(0, RATE_LIMIT_PER_DAY - used - 1),
    },
    200,
  );
});
