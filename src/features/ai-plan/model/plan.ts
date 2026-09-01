import { z } from 'zod';

import {
  DEFAULT_HABIT_FORM,
  type HabitFormValues,
} from '@/features/habits/model/habit-form';

/**
 * Odbicie responseSchema z funkcji brzegowej.
 *
 * Model dostaje schemat wymuszony przez Gemini, ale to nie zwalnia klienta
 * z walidacji: odpowiedź przechodzi przez sieć, funkcję i bazę, a każde
 * z tych miejsc może się zmienić niezależnie. Zod jest tu ostatnią bramką
 * przed wrzuceniem czegoś do interfejsu.
 *
 * Zmiana kształtu wymaga zmiany w supabase/functions/generate-daily-plan/schema.ts.
 */

export const MAX_PLAN_ITEMS = 5;

export const planItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  rationale: z.string().trim().max(400).default(''),
  unit: z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']),
  start_value: z.number().finite().nonnegative(),
  increment_value: z.number().finite().nonnegative(),
  target_value: z.number().finite().positive().optional(),
  time_of_day: z.enum(['morning', 'afternoon', 'evening']),
  category: z.enum(['mindfulness', 'health', 'focus', 'learning', 'relationships']),
});

export const planProposalSchema = z.object({
  summary: z.string().trim().max(400),
  items: z.array(planItemSchema).max(MAX_PLAN_ITEMS),
});

export type PlanItem = z.infer<typeof planItemSchema>;
export type PlanProposal = z.infer<typeof planProposalSchema>;

export const generatePlanResponseSchema = z.object({
  plan: planProposalSchema,
  generation_id: z.string().nullable(),
  remaining: z.number().int().nonnegative(),
});

export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

/**
 * Propozycja modelu → wartości formularza nawyku.
 *
 * Harmonogram zostaje domyślny (codziennie): model dostaje pytanie o plan
 * dnia, nie o tygodniowy rozkład, więc zgadywanie dni byłoby wymyślaniem.
 */
export function toHabitFormValues(item: PlanItem): HabitFormValues {
  return {
    ...DEFAULT_HABIT_FORM,
    title: item.title,
    description: item.rationale,
    unit: item.unit,
    category: item.category,
    startValue: String(item.start_value),
    incrementValue: String(item.increment_value),
    targetValue: item.target_value === undefined ? '' : String(item.target_value),
    timeOfDay: item.time_of_day,
  };
}
