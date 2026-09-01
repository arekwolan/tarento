/**
 * Nagłówki i odpowiedzi wspólne dla funkcji brzegowych.
 *
 * Wydzielone, bo kopia CORS-a w każdej funkcji kończy się tym, że jedna z nich
 * po cichu przestaje odpowiadać na preflight.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Kody błędów, na które klient ma osobne komunikaty. */
export type ErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_input'
  | 'not_configured'
  | 'upstream_failed'
  | 'invalid_model_output'
  | 'method_not_allowed';

export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function errorResponse(
  code: ErrorCode,
  status: number,
  extraHeaders: HeadersInit = {},
): Response {
  return jsonResponse({ error: code }, status, extraHeaders);
}

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Token sesji z nagłówka Authorization.
 *
 * Sam nagłówek może nieść klucz anon, który przechodzi weryfikację platformy —
 * dopiero getUser() odróżnia realną sesję od żądania bez zalogowanego
 * użytkownika. Tu wyciągamy wyłącznie string.
 */
export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}
