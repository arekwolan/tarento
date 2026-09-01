import { z } from 'zod';

/**
 * Dopasowanie ścieżki do doby użytkownika.
 *
 * Odbicie odpowiedzi funkcji supabase/functions/suggest-path-fit oraz kształt
 * zapisywany w `user_paths.fit`. Ten sam obiekt czyta potem migracja
 * (public.materialize_path_practice) — zmiana kształtu dotyka trzech miejsc
 * naraz i żadnego nie wolno pominąć.
 */

const adjustmentSchema = z.object({
  practiceId: z.string(),
  startValue: z.number().finite().positive(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']),
});

export const pathFitSchema = z.object({
  lite: z.boolean(),
  skip: z.array(z.string()),
  adjust: z.array(adjustmentSchema),
  note: z.string(),
});

export const pathFitResponseSchema = z.object({
  fit: pathFitSchema,
  generation_id: z.string().nullable(),
  remaining: z.number().int().nonnegative(),
});

export type PathFitResponse = z.infer<typeof pathFitResponseSchema>;
