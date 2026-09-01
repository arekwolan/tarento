import { invokeAiFunction } from '@/features/ai-plan/api/invoke';
import { AiPlanError } from '@/features/ai-plan/model/errors';
import {
  pathFitResponseSchema,
  type PathFitResponse,
} from '@/features/ai-plan/model/path-fit-proposal';

const FUNCTION_NAME = 'suggest-path-fit';

/**
 * Prosi funkcję brzegową o dopasowanie ścieżki.
 *
 * Wysyłamy sam identyfikator ścieżki. Definicję etapów, okno użytkownika,
 * listę jego nawyków i werdykt bramki budżetowej funkcja składa sama —
 * gdyby werdykt szedł z klienta, „mieści się" byłoby deklaracją, a nie
 * rachunkiem.
 *
 * Wywoływane raz, przy zapisie. Nie codziennie i nie przy każdym etapie.
 */
export async function requestPathFit(pathId: string): Promise<PathFitResponse> {
  const data = await invokeAiFunction(FUNCTION_NAME, { path_id: pathId });

  const parsed = pathFitResponseSchema.safeParse(data);
  if (!parsed.success) throw new AiPlanError('invalid_model_output');

  return parsed.data;
}
