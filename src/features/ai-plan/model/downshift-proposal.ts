import { z } from 'zod';

import { planItemSchema } from '@/features/ai-plan/model/plan';

/**
 * Propozycja mniejszej wersji nawyku.
 *
 * Ten sam PlanItem co wszędzie, plus harmonogram: „codziennie → pon/śr/pt"
 * bywa jedynym sensownym zmniejszeniem nawyku, którego wartości nie da się
 * już podzielić.
 *
 * Odbicie odpowiedzi funkcji supabase/functions/suggest-downshift.
 */
export const downshiftProposalSchema = planItemSchema.extend({
  schedule_type: z.enum(['daily', 'weekdays', 'custom']),
  schedule_days: z.array(z.number().int().min(0).max(6)).nullable(),
});

export type DownshiftProposal = z.infer<typeof downshiftProposalSchema>;

export const downshiftResponseSchema = z.object({
  proposal: downshiftProposalSchema,
  generation_id: z.string().nullable(),
  remaining: z.number().int().nonnegative(),
});

export type DownshiftResponse = z.infer<typeof downshiftResponseSchema>;
