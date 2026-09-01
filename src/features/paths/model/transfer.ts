import { z } from 'zod';

import type { PathKind } from '@/features/paths/model/schemas';
import type { IsoDate } from '@/lib/date';

export const TRANSFER_EVIDENCE_MAX_LENGTH = 280;
export const TRANSFER_DEFER_DAYS = 7;

export const transferResponseSchema = z.enum(['yes', 'not_yet', 'no_opportunity']);
export type TransferResponse = z.infer<typeof transferResponseSchema>;

export const transferDecisionSchema = z.enum(['advance', 'stay', 'downshift']);
export type TransferDecision = z.infer<typeof transferDecisionSchema>;

export const pathTransferFormSchema = z.object({
  response: transferResponseSchema.nullable(),
  evidence: z.string().trim().max(TRANSFER_EVIDENCE_MAX_LENGTH),
});

export type PathTransferFormValues = z.infer<typeof pathTransferFormSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type PathTransferResponse = {
  id: string;
  userId: string;
  userPathId: string;
  stageId: string;
  clientRequestId: string;
  response: TransferResponse;
  decision: TransferDecision;
  evidence: string | null;
  protocolType: PathKind;
  answeredOn: IsoDate;
  deferUntil: IsoDate | null;
  advancedToStageId: string | null;
  retiredHabitIds: string[];
  retiredTitles: string[];
  archivedAt: string | null;
  createdAt: string;
};

export const pathTransferResponseRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    user_path_id: z.string(),
    stage_id: z.string(),
    client_request_id: z.string(),
    response: transferResponseSchema,
    decision: transferDecisionSchema,
    evidence: z.string().nullable(),
    protocol_type: z.enum(['tarento', 'book_protocol']),
    answered_on: isoDateSchema,
    defer_until: isoDateSchema.nullable(),
    advanced_to_stage_id: z.string().nullable(),
    retired_habit_ids: z.array(z.string()).nullable(),
    retired_titles: z.array(z.string()).nullable(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((row): PathTransferResponse => ({
    id: row.id,
    userId: row.user_id,
    userPathId: row.user_path_id,
    stageId: row.stage_id,
    clientRequestId: row.client_request_id,
    response: row.response,
    decision: row.decision,
    evidence: row.evidence,
    protocolType: row.protocol_type,
    answeredOn: row.answered_on,
    deferUntil: row.defer_until,
    advancedToStageId: row.advanced_to_stage_id,
    retiredHabitIds: row.retired_habit_ids ?? [],
    retiredTitles: row.retired_titles ?? [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));

export type PathTransferSubmitResult = {
  responseId: string;
  nextStageId: string | null;
  retiredHabitIds: string[];
  retiredTitles: string[];
  deferredUntil: IsoDate | null;
};

export const pathTransferSubmitRowSchema = z
  .object({
    response_id: z.string(),
    next_stage_id: z.string().nullable(),
    retired_habit_ids: z.array(z.string()).nullable(),
    retired_titles: z.array(z.string()).nullable(),
    deferred_until: isoDateSchema.nullable(),
  })
  .transform((row): PathTransferSubmitResult => ({
    responseId: row.response_id,
    nextStageId: row.next_stage_id,
    retiredHabitIds: row.retired_habit_ids ?? [],
    retiredTitles: row.retired_titles ?? [],
    deferredUntil: row.deferred_until,
  }));

export type ImplementationStage = {
  stageId: string;
  ordinal: number;
  name: string;
};

export type ImplementationPracticeOutcome = {
  practiceId: string;
  stageId: string;
  stageOrdinal: number;
  title: string;
  state: 'kept' | 'retired';
  scheduled: number;
  completed: number;
};

export type PathImplementationConfirmation = {
  id: string;
  userId: string;
  userPathId: string;
  pathId: string;
  protocolType: PathKind;
  sourceType: string | null;
  sourceTitle: string;
  sourceAuthor: string | null;
  completedStages: ImplementationStage[];
  practiceOutcomes: ImplementationPracticeOutcome[];
  userSentence: string | null;
  answersArchivedAt: string | null;
  completedAt: string;
};

const implementationStageSchema = z.object({
  stageId: z.string(),
  ordinal: z.number().int().positive(),
  name: z.string(),
});

const implementationPracticeSchema = z.object({
  practiceId: z.string(),
  stageId: z.string(),
  stageOrdinal: z.number().int().positive(),
  title: z.string(),
  state: z.enum(['kept', 'retired']),
  scheduled: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const pathImplementationConfirmationRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    user_path_id: z.string(),
    path_id: z.string(),
    protocol_type: z.enum(['tarento', 'book_protocol']),
    source_type: z.string().nullable(),
    source_title: z.string(),
    source_author: z.string().nullable(),
    completed_stages: z.array(implementationStageSchema),
    practice_outcomes: z.array(implementationPracticeSchema),
    user_sentence: z.string().nullable(),
    answers_archived_at: z.string().nullable(),
    completed_at: z.string(),
  })
  .transform((row): PathImplementationConfirmation => ({
    id: row.id,
    userId: row.user_id,
    userPathId: row.user_path_id,
    pathId: row.path_id,
    protocolType: row.protocol_type,
    sourceType: row.source_type,
    sourceTitle: row.source_title,
    sourceAuthor: row.source_author,
    completedStages: row.completed_stages,
    practiceOutcomes: row.practice_outcomes,
    userSentence: row.user_sentence,
    answersArchivedAt: row.answers_archived_at,
    completedAt: row.completed_at,
  }));

/** UUID v4 do idempotencji kolejki offline; nie jest sekretem. */
export function createPathTransferRequestId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(random() * 16);
    const nibble = token === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function isTransferDecisionAllowed(
  response: TransferResponse,
  decision: TransferDecision,
): boolean {
  if (decision === 'downshift') return response === 'not_yet';
  return true;
}

/**
 * Ponowne wejście i neutralne odłożenie wyciszają pytanie, ale nie zmieniają
 * serii ani oceny etapu. ISO daty można porównać leksykograficznie.
 */
export function isTransferSuppressed(
  today: IsoDate,
  reentryUntil: IsoDate | null,
  latest: Pick<PathTransferResponse, 'decision' | 'deferUntil'> | null,
): boolean {
  if (reentryUntil !== null && reentryUntil >= today) return true;
  if (latest?.decision === 'advance') return true;
  return latest?.deferUntil !== null && latest?.deferUntil !== undefined
    ? latest.deferUntil >= today
    : false;
}
