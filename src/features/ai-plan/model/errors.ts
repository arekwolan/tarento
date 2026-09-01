import type { TranslationKey } from '@/i18n/keys';

/**
 * Powody, dla których generowanie planu może się nie udać.
 *
 * Każdy ma osobny komunikat, bo każdy wymaga od użytkownika czegoś innego:
 * przy braku sieci ma poczekać, przy limicie wrócić jutro, przy złej
 * odpowiedzi modelu po prostu spróbować jeszcze raz.
 */
export type AiPlanErrorCode =
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_input'
  | 'not_configured'
  | 'upstream_failed'
  | 'invalid_model_output'
  | 'unknown';

export type AiPlanErrorKey = Extract<TranslationKey, `aiPlan.errors.${string}`>;

const ERROR_KEYS: Record<AiPlanErrorCode, AiPlanErrorKey> = {
  offline: 'aiPlan.errors.offline',
  timeout: 'aiPlan.errors.timeout',
  unauthorized: 'aiPlan.errors.unauthorized',
  rate_limited: 'aiPlan.errors.rateLimited',
  invalid_input: 'aiPlan.errors.invalidInput',
  not_configured: 'aiPlan.errors.notConfigured',
  upstream_failed: 'aiPlan.errors.upstreamFailed',
  invalid_model_output: 'aiPlan.errors.invalidModelOutput',
  unknown: 'aiPlan.errors.unknown',
};

export class AiPlanError extends Error {
  readonly code: AiPlanErrorCode;

  constructor(code: AiPlanErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiPlanError';
    this.code = code;
  }
}

export function aiPlanErrorKey(error: unknown): AiPlanErrorKey {
  if (error instanceof AiPlanError) return ERROR_KEYS[error.code];
  return ERROR_KEYS.unknown;
}

export type AiSuggestErrorKey = Extract<
  TranslationKey,
  `aiPlan.suggest.errors.${string}`
>;

/**
 * Ten sam zestaw przyczyn, inny zestaw komunikatów.
 *
 * Podpowiedź jest dodatkiem do formularza, nie osobnym ekranem: użytkownik
 * stoi nad polami, które i tak może wypełnić sam. Dlatego trzy komunikaty
 * zamiast dziewięciu i każdy kończy się tym, co da się zrobić bez modelu
 * (CLAUDE.md, reguła 9).
 */
export function aiSuggestErrorKey(error: unknown): AiSuggestErrorKey {
  if (error instanceof AiPlanError) {
    if (error.code === 'offline') return 'aiPlan.suggest.errors.offline';
    if (error.code === 'rate_limited') return 'aiPlan.suggest.errors.rateLimited';
  }

  return 'aiPlan.suggest.errors.failed';
}

/** Kod błędu z ciała odpowiedzi funkcji. Nieznany kod nie przecieka na ekran. */
export function toErrorCode(value: unknown, status: number): AiPlanErrorCode {
  const known: readonly AiPlanErrorCode[] = [
    'unauthorized',
    'rate_limited',
    'invalid_input',
    'not_configured',
    'upstream_failed',
    'invalid_model_output',
  ];

  if (typeof value === 'string') {
    const match = known.find((code) => code === value);
    if (match !== undefined) return match;
  }

  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 504) return 'timeout';
  if (status >= 500) return 'upstream_failed';

  return 'unknown';
}
