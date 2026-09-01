import { z } from 'zod';

import type { IsoDate } from '@/lib/date';

export const SELF_RULE_ALGORITHM_VERSION = 'self-rules-v1';
export const SELF_RULE_WINDOW_DAYS = 120;
export const SELF_RULE_MIN_COMPARATIVE_OPPORTUNITIES = 6;
export const SELF_RULE_MIN_RATE_GAP = 0.2;
export const SELF_RULE_MIN_FRICTION_EVENTS = 3;
export const SELF_RULE_REEVALUATE_DAYS = 30;
export const SELF_RULE_MAX_CANDIDATES = 12;

export const selfRuleTypeSchema = z.enum([
  'time_of_day',
  'target_size',
  'day_type',
  'friction',
  'minimal_version',
  'revision_outcome',
]);
export type SelfRuleType = z.infer<typeof selfRuleTypeSchema>;

export const selfRuleStatusSchema = z.enum([
  'candidate',
  'accepted',
  'rejected',
  'expired',
]);
export type SelfRuleStatus = z.infer<typeof selfRuleStatusSchema>;

export const selfRuleDecisionSchema = z.enum([
  'accept',
  'reject',
  'review_keep',
  'expire',
]);
export type SelfRuleDecision = z.infer<typeof selfRuleDecisionSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const selfRuleEvidenceSchema = z.object({
  algorithm_version: z.literal(SELF_RULE_ALGORITHM_VERSION),
  rule_type: selfRuleTypeSchema,
  subject_habit_id: z.string().uuid(),
  preferred_value: z.string().min(1).max(40),
  comparison_value: z.string().min(1).max(40).optional(),
  preferred_completed: z.number().int().nonnegative(),
  preferred_opportunities: z.number().int().nonnegative(),
  comparison_completed: z.number().int().nonnegative(),
  comparison_opportunities: z.number().int().nonnegative(),
  range_start: isoDateSchema,
  range_end: isoDateSchema,
});
export type SelfRuleEvidence = z.infer<typeof selfRuleEvidenceSchema>;

export type SelfRule = {
  id: string;
  userId: string;
  ruleKey: string;
  ruleType: SelfRuleType;
  subjectHabitId: string;
  status: SelfRuleStatus;
  algorithmVersion: string;
  conclusionKey: string;
  evidence: SelfRuleEvidence;
  evidenceHash: string;
  sampleSize: number;
  rangeStart: IsoDate;
  rangeEnd: IsoDate;
  reevaluateOn: IsoDate;
  reviewRequiredAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const selfRuleRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    rule_key: z.string(),
    rule_type: selfRuleTypeSchema,
    subject_habit_id: z.string().uuid(),
    status: selfRuleStatusSchema,
    algorithm_version: z.string(),
    conclusion_key: z.string(),
    evidence_snapshot: selfRuleEvidenceSchema,
    evidence_hash: z.string().length(32),
    sample_size: z.number().int().nonnegative(),
    range_start: isoDateSchema,
    range_end: isoDateSchema,
    reevaluate_on: isoDateSchema,
    review_required_at: z.string().nullable(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform(
    (row): SelfRule => ({
      id: row.id,
      userId: row.user_id,
      ruleKey: row.rule_key,
      ruleType: row.rule_type,
      subjectHabitId: row.subject_habit_id,
      status: row.status,
      algorithmVersion: row.algorithm_version,
      conclusionKey: row.conclusion_key,
      evidence: row.evidence_snapshot,
      evidenceHash: row.evidence_hash,
      sampleSize: row.sample_size,
      rangeStart: row.range_start,
      rangeEnd: row.range_end,
      reevaluateOn: row.reevaluate_on,
      reviewRequiredAt: row.review_required_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );

export type SelfRuleEvidenceRow = {
  habitId: string;
  day: IsoDate;
  outcome: 'completed' | 'skipped' | 'pending';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | null;
  targetValue: number;
  scheduleKey: string;
  dayKind: 'workday' | 'free' | 'night_shift' | 'care' | 'custom' | null;
  revisionId: string | null;
  revisionNumber: number | null;
  revisionSource: string | null;
  revisionReason: string | null;
  isMinimal: boolean;
  frictionReason:
    | 'forgot'
    | 'no_time'
    | 'too_big'
    | 'wrong_time'
    | 'environment'
    | 'not_today'
    | null;
};

export const selfRuleEvidenceRowSchema = z
  .object({
    habit_id: z.string().uuid(),
    day: isoDateSchema,
    outcome: z.enum(['completed', 'skipped', 'pending']),
    time_of_day: z.enum(['morning', 'afternoon', 'evening']).nullable(),
    target_value: z.coerce.number().nonnegative(),
    schedule_key: z.string(),
    day_kind: z
      .enum(['workday', 'free', 'night_shift', 'care', 'custom'])
      .nullable(),
    revision_id: z.string().uuid().nullable(),
    revision_number: z.number().int().positive().nullable(),
    revision_source: z.string().nullable(),
    revision_reason: z.string().nullable(),
    is_minimal: z.boolean(),
    friction_reason: z
      .enum(['forgot', 'no_time', 'too_big', 'wrong_time', 'environment', 'not_today'])
      .nullable(),
  })
  .transform(
    (row): SelfRuleEvidenceRow => ({
      habitId: row.habit_id,
      day: row.day,
      outcome: row.outcome,
      timeOfDay: row.time_of_day,
      targetValue: row.target_value,
      scheduleKey: row.schedule_key,
      dayKind: row.day_kind,
      revisionId: row.revision_id,
      revisionNumber: row.revision_number,
      revisionSource: row.revision_source,
      revisionReason: row.revision_reason,
      isMinimal: row.is_minimal,
      frictionReason: row.friction_reason,
    }),
  );

export type SelfRuleCandidate = {
  ruleType: SelfRuleType;
  subjectHabitId: string;
  preferredValue: string;
  comparisonValue: string | null;
  preferredCompleted: number;
  preferredOpportunities: number;
  comparisonCompleted: number;
  comparisonOpportunities: number;
  rangeStart: IsoDate;
  rangeEnd: IsoDate;
};

/** UUID v4 jest częścią retry decyzji i nie zawiera żadnych prywatnych danych. */
export function createSelfRuleRequestId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(random() * 16);
    const nibble = token === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

/** Tylko przyjęta i niepodważona reguła może trafić do jawnego kontekstu. */
export function acceptedSelfRuleContexts(rules: readonly SelfRule[]): SelfRule[] {
  return rules.filter(
    (rule) =>
      rule.status === 'accepted' &&
      rule.reviewRequiredAt === null &&
      rule.archivedAt === null,
  );
}
