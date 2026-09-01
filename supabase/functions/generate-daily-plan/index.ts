import { createClient } from 'jsr:@supabase/supabase-js@2';

import { buildUserPrompt, SYSTEM_PROMPT, type PlanRequestInput } from './prompt.ts';
import { MAX_PLAN_ITEMS, PLAN_RESPONSE_SCHEMA } from './schema.ts';

/**
 * Generowanie propozycji planu dnia.
 *
 * Funkcja istnieje po jednym powodzie: klucz Gemini nie ma prawa znaleźć się
 * w aplikacji mobilnej. Bundle jest w całości odczytywalny, więc każdy klucz
 * w kliencie jest kluczem publicznym. Tutaj leży po stronie serwera, a klient
 * wysyła wyłącznie intencję.
 *
 * Kolejność sprawdzeń jest celowa: najpierw tożsamość, potem limit, dopiero
 * na końcu płatne wywołanie modelu.
 */

const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 25_000;
const GENERATION_KIND = 'daily_plan';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Kody błędów, na które klient ma osobne komunikaty. */
type ErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_input'
  | 'not_configured'
  | 'upstream_failed'
  | 'invalid_model_output'
  | 'method_not_allowed';

function jsonResponse(body: unknown, status: number, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function errorResponse(code: ErrorCode, status: number, extraHeaders: HeadersInit = {}) {
  return jsonResponse({ error: code }, status, extraHeaders);
}

type RawInput = Record<string, unknown>;

/**
 * Wejście od klienta.
 *
 * Przycinamy długości, bo pola formularza trafiają wprost do promptu —
 * bez limitu ktoś mógłby wkleić megabajt tekstu i zapłacilibyśmy za tokeny.
 */
function parseInput(body: RawInput): PlanRequestInput | null {
  const goal = typeof body.goal === 'string' ? body.goal.trim().slice(0, 500) : '';
  if (goal === '') return null;

  const rawMinutes =
    typeof body.availableMinutes === 'number' ? body.availableMinutes : 15;
  const availableMinutes = Math.min(240, Math.max(1, Math.round(rawMinutes)));

  const timeOfDay =
    typeof body.timeOfDay === 'string' &&
    ['morning', 'afternoon', 'evening'].includes(body.timeOfDay)
      ? body.timeOfDay
      : 'morning';

  const preferences =
    typeof body.preferences === 'string' ? body.preferences.trim().slice(0, 500) : '';

  const existingHabits = Array.isArray(body.existingHabits)
    ? body.existingHabits
        .filter((value): value is string => typeof value === 'string')
        .slice(0, 20)
        .map((value) => value.trim().slice(0, 120))
    : [];

  return { goal, availableMinutes, timeOfDay, preferences, existingHabits };
}

async function callGemini(
  apiKey: string,
  model: string,
  input: PlanRequestInput,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, GEMINI_TIMEOUT_MS);

  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
          generationConfig: {
            // Wymuszenie JSON-a schematem. Bez tego trzeba by wyłuskiwać
            // obiekt z prozy, a model co jakiś czas dopisuje zdanie wstępu.
            responseMimeType: 'application/json',
            responseSchema: PLAN_RESPONSE_SCHEMA,
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

type GeminiPayload = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

/** Skrót wejścia — pozwala liczyć powtórki bez trzymania treści promptu. */
async function hashPrompt(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  // 1. Tożsamość ------------------------------------------------------------
  //
  // Nagłówek Authorization może nieść sam klucz anon, który przechodzi
  // weryfikację platformy. Dopiero getUser() odróżnia realną sesję od
  // żądania bez zalogowanego użytkownika.
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (token === '') {
    return errorResponse('unauthorized', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (supabaseUrl === '' || serviceRoleKey === '') {
    return errorResponse('not_configured', 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user ?? null;

  if (userError !== null || user === null) {
    return errorResponse('unauthorized', 401);
  }

  // 2. Limit ----------------------------------------------------------------
  //
  // Okno kroczące zamiast kalendarzowej doby: użytkownik podróżujący między
  // strefami nie dostaje w ten sposób dodatkowej puli o północy.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error: countError } = await admin
    .from('ai_generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', GENERATION_KIND)
    .gte('created_at', windowStart);

  if (countError !== null) {
    return errorResponse('upstream_failed', 502);
  }

  const used = count ?? 0;
  if (used >= RATE_LIMIT_PER_DAY) {
    return jsonResponse(
      { error: 'rate_limited', limit: RATE_LIMIT_PER_DAY, remaining: 0 },
      429,
      { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
    );
  }

  // 3. Wejście --------------------------------------------------------------
  let body: RawInput;
  try {
    body = (await request.json()) as RawInput;
  } catch {
    return errorResponse('invalid_input', 400);
  }

  const input = parseInput(body);
  if (input === null) {
    return errorResponse('invalid_input', 400);
  }

  // 4. Model ----------------------------------------------------------------
  //
  // Nazwa modelu w zmiennej środowiskowej: Google wygasza modele co kilka
  // miesięcy, a podmiana stringa nie powinna wymagać wydania aplikacji.
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const model = Deno.env.get('GEMINI_MODEL') ?? '';

  if (apiKey === '' || model === '') {
    return errorResponse('not_configured', 503);
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await callGemini(apiKey, model, input);
  } catch {
    // Obejmuje też przerwanie po przekroczeniu limitu czasu.
    return errorResponse('upstream_failed', 504);
  }

  if (!geminiResponse.ok) {
    return errorResponse('upstream_failed', 502);
  }

  const payload = (await geminiResponse.json()) as GeminiPayload;
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let plan: unknown;
  try {
    plan = JSON.parse(text);
  } catch {
    // Schemat powinien to wykluczyć, ale nie budujemy na "powinien".
    return errorResponse('invalid_model_output', 422);
  }

  if (
    typeof plan !== 'object' ||
    plan === null ||
    !Array.isArray((plan as { items?: unknown }).items)
  ) {
    return errorResponse('invalid_model_output', 422);
  }

  const planObject = plan as { summary?: unknown; items: unknown[] };
  const trimmed = {
    summary: typeof planObject.summary === 'string' ? planObject.summary : '',
    // Twardy sufit po stronie serwera — prompt i schemat to za mało,
    // gdy stawką jest długość listy pokazywanej użytkownikowi.
    items: planObject.items.slice(0, MAX_PLAN_ITEMS),
  };

  // 5. Ślad w bazie ---------------------------------------------------------
  //
  // Zapisujemy zużycie tokenów i skrót wejścia, nie treść promptu.
  const { data: generation } = await admin
    .from('ai_generations')
    .insert({
      user_id: user.id,
      kind: GENERATION_KIND,
      model,
      prompt_hash: await hashPrompt(buildUserPrompt(input)),
      input_tokens: payload.usageMetadata?.promptTokenCount ?? null,
      output_tokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      response: trimmed,
    })
    .select('id')
    .single();

  // 6. Odpowiedź ------------------------------------------------------------
  //
  // Propozycja, nie zapis. Nawyki powstaną dopiero wtedy, gdy użytkownik
  // przejrzy listę, poprawi ją i naciśnie akceptuj.
  return jsonResponse(
    {
      plan: trimmed,
      generation_id: generation?.id ?? null,
      remaining: Math.max(0, RATE_LIMIT_PER_DAY - used - 1),
    },
    200,
  );
});
