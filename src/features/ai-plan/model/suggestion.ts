import { z } from 'zod';

import { planItemSchema, type PlanItem } from '@/features/ai-plan/model/plan';
import { estimateUnitMinutes } from '@/features/habits/model/today-task';

/**
 * Podpowiedź do formularza nawyku: jedno zdanie użytkownika → od jednej do
 * trzech gotowych propozycji.
 *
 * Odbicie odpowiedzi funkcji supabase/functions/suggest-habit. Walidacja po
 * stronie klienta nie jest nadmiarowa: odpowiedź przechodzi przez sieć,
 * funkcję i bazę, a każde z tych miejsc zmienia się niezależnie.
 */

export const MAX_SUGGESTIONS = 3;

/**
 * Dlaczego lista bywa pusta.
 *
 * `out_of_scope` i `unclear` to dla użytkownika dwie różne sytuacje —
 * pierwsza mówi „tego ta aplikacja nie robi", druga „napisz to inaczej".
 * Wspólny komunikat na obie byłby mylący w obu.
 */
export const suggestStatusSchema = z.enum(['ok', 'out_of_scope', 'unclear']);
export type SuggestStatus = z.infer<typeof suggestStatusSchema>;

export const suggestHabitResponseSchema = z.object({
  candidates: z.array(planItemSchema).max(MAX_SUGGESTIONS),
  status: suggestStatusSchema,
  /** Wiersz w ai_generations. `null`, gdy ślad się nie zapisał. */
  generation_id: z.string().nullable(),
  remaining: z.number().int().nonnegative(),
});

export type SuggestHabitResponse = z.infer<typeof suggestHabitResponseSchema>;

/**
 * Szacowany dzienny koszt propozycji w minutach.
 *
 * Liczony tu, a nie po stronie modelu: liczba, którą model podaje o samym
 * sobie, jest oceną wystawioną sobie, a ta sama arytmetyka rozstrzyga potem
 * o suficie dnia (`estimateUnitMinutes`).
 */
export function suggestionMinutes(item: PlanItem): number {
  return Math.max(1, Math.round(estimateUnitMinutes(item.unit, item.start_value)));
}
