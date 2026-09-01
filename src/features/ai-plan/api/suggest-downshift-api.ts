import { invokeAiFunction } from '@/features/ai-plan/api/invoke';
import {
  downshiftResponseSchema,
  type DownshiftResponse,
} from '@/features/ai-plan/model/downshift-proposal';
import { AiPlanError } from '@/features/ai-plan/model/errors';

const FUNCTION_NAME = 'suggest-downshift';

/**
 * Prosi funkcję brzegową o mniejszą wersję nawyku.
 *
 * Wysyłamy sam identyfikator. Parametry nawyku i historię wykonania funkcja
 * czyta z bazy kluczem service_role — tak samo jak przy podpowiedziach
 * z intencji, i z tego samego powodu.
 */
export async function requestDownshift(habitId: string): Promise<DownshiftResponse> {
  const data = await invokeAiFunction(FUNCTION_NAME, { habit_id: habitId });

  const parsed = downshiftResponseSchema.safeParse(data);
  if (!parsed.success) throw new AiPlanError('invalid_model_output');

  return parsed.data;
}
