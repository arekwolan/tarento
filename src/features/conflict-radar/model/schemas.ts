import { z } from 'zod';

export const protocolConflictTypeSchema = z.enum(['capacity', 'execution', 'rule']);
export const protocolConflictDecisionSchema = z.enum([
  'context_split',
  'reject_incoming',
  'reject_existing',
]);
export const protocolConflictContextSchema = z.enum([
  'workday',
  'free',
  'night_shift',
  'care',
  'custom',
  'morning',
  'afternoon',
  'evening',
]);

export const protocolConflictSchema = z
  .object({
    id: z.string().uuid(),
    type: protocolConflictTypeSchema,
    stage_id: z.string().uuid().nullable(),
    incoming_practice_id: z.string().uuid().nullable(),
    incoming_title: z.string().nullable(),
    existing_habit_id: z.string().uuid().nullable(),
    existing_title: z.string().nullable(),
    note_a_id: z.string().uuid().nullable(),
    note_a_text: z.string().max(500).nullable(),
    note_b_id: z.string().uuid().nullable(),
    note_b_text: z.string().max(500).nullable(),
    description: z.string().max(180).nullable(),
    confidence: z.enum(['medium', 'high']).nullable(),
    day_kinds: z.array(
      z.enum(['workday', 'free', 'night_shift', 'care', 'custom']),
    ),
    time_of_day: z.enum(['morning', 'afternoon', 'evening']).nullable(),
    required_minutes: z.number().int().min(0).nullable(),
    available_minutes: z.number().int().min(0).nullable(),
    decision: protocolConflictDecisionSchema.nullable(),
    context_a: protocolConflictContextSchema.nullable(),
    context_b: protocolConflictContextSchema.nullable(),
  })
  .strict()
  .transform((row) => ({
    id: row.id,
    type: row.type,
    stageId: row.stage_id,
    incomingPracticeId: row.incoming_practice_id,
    incomingTitle: row.incoming_title,
    existingHabitId: row.existing_habit_id,
    existingTitle: row.existing_title,
    noteAId: row.note_a_id,
    noteAText: row.note_a_text,
    noteBId: row.note_b_id,
    noteBText: row.note_b_text,
    description: row.description,
    confidence: row.confidence,
    dayKinds: row.day_kinds,
    timeOfDay: row.time_of_day,
    requiredMinutes: row.required_minutes,
    availableMinutes: row.available_minutes,
    decision: row.decision,
    contextA: row.context_a,
    contextB: row.context_b,
  }));

export const protocolConflictReviewSchema = z
  .object({
    review_id: z.string().uuid(),
    semantic_status: z.enum(['complete', 'unavailable', 'not_needed']),
    conflicts: z.array(protocolConflictSchema),
  })
  .strict()
  .transform((row) => ({
    reviewId: row.review_id,
    semanticStatus: row.semantic_status,
    conflicts: row.conflicts,
  }));

export type ProtocolConflict = z.infer<typeof protocolConflictSchema>;
export type ProtocolConflictReview = z.infer<typeof protocolConflictReviewSchema>;
export type ProtocolConflictType = z.infer<typeof protocolConflictTypeSchema>;
export type ProtocolConflictDecision = z.infer<
  typeof protocolConflictDecisionSchema
>;
export type ProtocolConflictContext = z.infer<typeof protocolConflictContextSchema>;

export function canActivateConflictReview(
  review: ProtocolConflictReview | null,
): boolean {
  return (
    review !== null &&
    review.conflicts.every(
      (conflict) =>
        conflict.decision !== null && conflict.decision !== 'reject_incoming',
    )
  );
}
