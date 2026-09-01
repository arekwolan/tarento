/**
 * Jedno wywołanie modelu, wspólne dla wszystkich funkcji brzegowych.
 *
 * Klucz czytamy z sekretów runtime'u i nigdzie go nie logujemy. Nazwa modelu
 * też siedzi w zmiennej: Google wygasza modele co kilka miesięcy, a podmiana
 * stringa nie powinna wymagać wydania aplikacji.
 */

const TIMEOUT_MS = 25_000;

export type GeminiConfig = { apiKey: string; model: string };

/** `null`, gdy sekrety nie są ustawione — wołający oddaje 'not_configured'. */
export function geminiConfig(): GeminiConfig | null {
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const model = Deno.env.get('GEMINI_MODEL') ?? '';

  return apiKey === '' || model === '' ? null : { apiKey, model };
}

export type GeminiRequest = {
  config: GeminiConfig;
  systemPrompt: string;
  userPrompt: string;
  /** Schemat odpowiedzi w podzbiorze OpenAPI przyjmowanym przez Gemini. */
  responseSchema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GeminiResult =
  | {
      ok: true;
      value: unknown;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | { ok: false; reason: 'upstream_failed' | 'invalid_model_output' };

type GeminiPayload = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export async function callGemini(request: GeminiRequest): Promise<GeminiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        `${request.config.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': request.config.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
          generationConfig: {
            // Wymuszenie JSON-a schematem. Bez tego trzeba by wyłuskiwać
            // obiekt z prozy, a model co jakiś czas dopisuje zdanie wstępu.
            responseMimeType: 'application/json',
            responseSchema: request.responseSchema,
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxOutputTokens ?? 2048,
          },
        }),
      },
    );
  } catch {
    // Obejmuje też przerwanie po przekroczeniu limitu czasu.
    return { ok: false, reason: 'upstream_failed' };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) return { ok: false, reason: 'upstream_failed' };

  const payload = (await response.json()) as GeminiPayload;
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Schemat powinien to wykluczyć, ale nie budujemy na „powinien".
    return { ok: false, reason: 'invalid_model_output' };
  }

  return {
    ok: true,
    value,
    inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
  };
}

/** Skrót wejścia — pozwala liczyć powtórki bez trzymania treści promptu. */
export async function hashPrompt(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
