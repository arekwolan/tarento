import { invokeAiFunction } from '@/features/ai-plan/api/invoke';
import { AiPlanError } from '@/features/ai-plan/model/errors';
import {
  generatePlanResponseSchema,
  type GeneratePlanResponse,
} from '@/features/ai-plan/model/plan';

const FUNCTION_NAME = 'generate-daily-plan';

export type GeneratePlanInput = {
  goal: string;
  availableMinutes: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  preferences: string;
  existingHabits: readonly string[];
};

/**
 * Prosi funkcję brzegową o propozycję planu.
 *
 * Klucz Gemini nigdy nie przechodzi przez to wywołanie — klient wysyła
 * wyłącznie treść formularza i własny token sesji.
 */
export async function generateDailyPlan(
  input: GeneratePlanInput,
): Promise<GeneratePlanResponse> {
  const data = await invokeAiFunction(FUNCTION_NAME, {
    goal: input.goal,
    availableMinutes: input.availableMinutes,
    timeOfDay: input.timeOfDay,
    preferences: input.preferences,
    existingHabits: input.existingHabits,
  });

  const parsed = generatePlanResponseSchema.safeParse(data);
  if (!parsed.success) {
    // Funkcja oddała coś, czego nie umiemy pokazać — z punktu widzenia
    // użytkownika to ten sam problem co zepsuty JSON od modelu.
    throw new AiPlanError('invalid_model_output');
  }

  return parsed.data;
}
