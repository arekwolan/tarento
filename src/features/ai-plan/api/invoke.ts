import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { AiPlanError, toErrorCode } from '@/features/ai-plan/model/errors';
import { supabase } from '@/lib/supabase';

/**
 * Wywołanie funkcji brzegowej AI.
 *
 * Wspólne dla wszystkich trzech zastosowań modelu, bo wszystkie mają ten sam
 * kontrakt błędu: kod w ciele odpowiedzi, ten sam zestaw przyczyn i ten sam
 * limit czasu. Klient odpuszcza wcześniej niż funkcja, żeby nie wisieć bez
 * końca na ekranie, którego użytkownik nie może opuścić.
 *
 * Klucz modelu nigdy nie przechodzi przez to wywołanie — aplikacja wysyła
 * wyłącznie intencję i własny token sesji (CLAUDE.md, reguła krytyczna 1).
 */

const CLIENT_TIMEOUT_MS = 30_000;

/** Wyciąga kod błędu z odpowiedzi funkcji, nie ufając jej kształtowi. */
async function readErrorCode(context: unknown, fallbackStatus: number) {
  if (!(context instanceof Response)) return toErrorCode(null, fallbackStatus);

  try {
    const body: unknown = await context.json();
    const code =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error: unknown }).error
        : null;

    return toErrorCode(code, context.status);
  } catch {
    return toErrorCode(null, context.status);
  }
}

export async function invokeAiFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CLIENT_TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      signal: controller.signal,
    });

    if (error !== null) {
      if (error instanceof FunctionsHttpError) {
        throw new AiPlanError(await readErrorCode(error.context, 500));
      }
      if (error instanceof FunctionsFetchError) {
        throw new AiPlanError('offline');
      }
      throw new AiPlanError('upstream_failed');
    }

    return data;
  } catch (caught) {
    if (caught instanceof AiPlanError) throw caught;

    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new AiPlanError('timeout');
    }

    if (caught instanceof TypeError) {
      throw new AiPlanError('offline');
    }

    throw new AiPlanError('unknown');
  } finally {
    clearTimeout(timeout);
  }
}
