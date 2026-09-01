import { invokeAiFunction } from '@/features/ai-plan/api/invoke';
import { AiPlanError } from '@/features/ai-plan/model/errors';
import {
  suggestHabitResponseSchema,
  type SuggestHabitResponse,
} from '@/features/ai-plan/model/suggestion';
import { nowIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'suggest-habit';

/** Limit jest też w funkcji — tutaj po to, żeby nie płacić za oczywiste odrzucenie. */
export const MAX_INTENT_LENGTH = 200;

/**
 * Zamiar → propozycje.
 *
 * Wysyłamy wyłącznie zdanie użytkownika. Okno dnia, lista nawyków i liczba
 * pozycji dokładane są po stronie funkcji — gdyby szły z aplikacji, budżet
 * dałoby się rozszerzyć podmieniając ciało żądania.
 */
export async function suggestHabit(intent: string): Promise<SuggestHabitResponse> {
  const data = await invokeAiFunction(FUNCTION_NAME, {
    intent: intent.trim().slice(0, MAX_INTENT_LENGTH),
  });

  const parsed = suggestHabitResponseSchema.safeParse(data);
  if (!parsed.success) {
    // Funkcja oddała coś, czego nie umiemy pokazać — z punktu widzenia
    // użytkownika to ten sam problem co zepsuty JSON od modelu.
    throw new AiPlanError('invalid_model_output');
  }

  return parsed.data;
}

/**
 * Oznacza propozycję jako użytą.
 *
 * Bez tego za trzy miesiące nie da się powiedzieć, czy podpowiedzi są coś
 * warte. Telemetria nigdy nie blokuje użytkownika: nieudany zapis znika po
 * cichu, bo formularz jest już wypełniony i to jest jedyna rzecz, na której
 * użytkownikowi zależy.
 *
 * Klient ma grant wyłącznie na kolumny accepted_at i rejected_reason —
 * licznik kosztów zostaje sterowany przez funkcję (migracja ai_suggestions).
 */
export async function markSuggestionAccepted(generationId: string): Promise<void> {
  await supabase
    .from('ai_generations')
    .update({ accepted_at: nowIso() })
    .eq('id', generationId);
}
