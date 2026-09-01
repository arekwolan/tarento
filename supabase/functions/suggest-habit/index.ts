import { loadUserContext } from '../_shared/context.ts';
import { callGemini, geminiConfig, hashPrompt } from '../_shared/gemini.ts';
import {
  bearerToken,
  errorResponse,
  jsonResponse,
  preflightResponse,
} from '../_shared/http.ts';
import { countGenerations, resolveAdmin } from '../_shared/admin.ts';
import { toPlanItem, type PlanItem } from '../_shared/plan-item.ts';
import { budgetCeiling, validateProposal } from '../_shared/validate-proposal.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { MAX_CANDIDATES, SUGGEST_RESPONSE_SCHEMA } from './schema.ts';

/**
 * Zamiar → praktyka.
 *
 * Jedyne miejsce, w którym model naprawdę bije formularz: zamienia mgliste
 * zdanie w strukturę. Ryzyko jest ograniczone konstrukcyjnie — wynikiem jest
 * wypełniony formularz, nie zobowiązanie, a między modelem a formularzem stoi
 * walidator ze wspólnego modułu.
 *
 * Osobna funkcja, a nie gałąź w generate-daily-plan: tamta bierze cały
 * formularz celu i oddaje plan dnia na pięć pozycji, ta bierze jedno zdanie
 * i oddaje kandydatów do jednego formularza — inne wejście, inne wyjście
 * i inny sposób składania kontekstu, więc wspólny byłby tylko `Deno.serve`.
 *
 * Kolejność sprawdzeń jest celowa: najpierw tożsamość, potem limit, dopiero
 * na końcu płatne wywołanie modelu.
 */

const GENERATION_KIND = 'habit_suggestion';
const RATE_LIMIT_PER_DAY = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_INTENT_LENGTH = 200;
/** Tytuł nawyku ma w formularzu limit 80 znaków — wariant zapasowy go respektuje. */
const MAX_TITLE_LENGTH = 80;

type Status = 'ok' | 'out_of_scope' | 'unclear';

function readStatus(value: unknown): Status {
  return value === 'out_of_scope' || value === 'unclear' || value === 'ok'
    ? value
    : 'unclear';
}

function readCandidates(value: unknown): PlanItem[] {
  if (typeof value !== 'object' || value === null) return [];

  const raw = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(0, MAX_CANDIDATES)
    .map(toPlanItem)
    .filter((item): item is PlanItem => item !== null);
}

/**
 * Wariant deterministyczny.
 *
 * Odpala się dopiero po dwóch odrzuceniach z walidatora i nigdy nie zamienia
 * się w błąd na ekranie: użytkownik prosił o podpowiedź do formularza, więc
 * dostaje wypełniony formularz, choćby najprostszy z możliwych.
 *
 * Dziesięć minut, ale nigdy powyżej sufitu propozycji. Reguła 60% jest
 * strukturalna (IDEAS.md §H) i wariant zapasowy nie jest od niej wyjątkiem —
 * przy oknie piętnastu minut wychodzi z tego dziewięć, a nie dziesięć.
 */
function fallbackCandidate(intent: string, allocatedMinutes: number): PlanItem {
  return {
    title: intent.slice(0, MAX_TITLE_LENGTH).trim(),
    rationale: '',
    unit: 'minutes',
    start_value: Math.max(1, Math.min(10, budgetCeiling(allocatedMinutes))),
    increment_value: 0,
    time_of_day: 'evening',
    // Neutralny obszar: kategoria nie wynika ze zdania, a zgadywanie jej
    // byłoby jedyną rzeczą w tym wariancie, która czegoś nie wie na pewno.
    category: 'focus',
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse();
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 405);

  // 1. Tożsamość ------------------------------------------------------------
  const resolved = await resolveAdmin(bearerToken(request));
  if (resolved === 'not_configured') return errorResponse('not_configured', 503);
  if (resolved === 'unauthorized') return errorResponse('unauthorized', 401);

  const { admin, userId } = resolved;

  // 2. Wejście --------------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('invalid_input', 400);
  }

  const intent =
    typeof body.intent === 'string' ? body.intent.trim().slice(0, MAX_INTENT_LENGTH) : '';

  if (intent === '') return errorResponse('invalid_input', 400);

  // 3. Limit ----------------------------------------------------------------
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

  // 4. Kontekst -------------------------------------------------------------
  //
  // Klient go nie wysyła. Gdyby wysyłał, budżet dałoby się rozszerzyć
  // podmieniając ciało żądania.
  const context = await loadUserContext(admin, userId);

  // 5. Model, walidator, powtórka ------------------------------------------
  let status: Status = 'unclear';
  let candidates: PlanItem[] = [];
  let rejectedReason: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let retryReason = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callGemini({
      config,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(intent, context, retryReason),
      responseSchema: SUGGEST_RESPONSE_SCHEMA,
      temperature: 0.6,
      maxOutputTokens: 1024,
    });

    if (!result.ok) {
      return errorResponse(
        result.reason,
        result.reason === 'upstream_failed' ? 502 : 422,
      );
    }

    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    status = readStatus((result.value as { status?: unknown } | null)?.status);

    if (status !== 'ok') {
      candidates = [];
      break;
    }

    candidates = readCandidates(result.value);

    const violation =
      candidates.length === 0
        ? { rule: 'unclear' as const, message: 'Model nie zwrócił żadnej propozycji.' }
        : validateProposal(candidates, {
            allocatedMinutes: context.allocatedMinutes,
            existingTitles: context.habits.map((habit) => habit.title),
          });

    if (violation === null) {
      rejectedReason = null;
      break;
    }

    rejectedReason = violation.rule;
    retryReason = violation.message;

    // Druga odmowa kończy negocjacje: użytkownik dostaje wariant
    // deterministyczny, a nie komunikat o błędzie (IDEAS.md §C).
    if (attempt === 1) {
      candidates = [fallbackCandidate(intent, context.allocatedMinutes)];
    }
  }

  // 6. Ślad w bazie ---------------------------------------------------------
  //
  // Zapisujemy zużycie tokenów i skrót wejścia, nie treść promptu.
  const { data: generation } = await admin
    .from('ai_generations')
    .insert({
      user_id: userId,
      kind: GENERATION_KIND,
      model: config.model,
      prompt_hash: await hashPrompt(intent),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response: { status, candidates },
      rejected_reason: rejectedReason,
    })
    .select('id')
    .single();

  // 7. Odpowiedź ------------------------------------------------------------
  //
  // Propozycja, nie zapis. Nawyk powstanie dopiero wtedy, gdy użytkownik
  // przejrzy wypełniony formularz i naciśnie zapisz.
  return jsonResponse(
    {
      candidates,
      status,
      generation_id: generation?.id ?? null,
      remaining: Math.max(0, RATE_LIMIT_PER_DAY - used - 1),
    },
    200,
  );
});
