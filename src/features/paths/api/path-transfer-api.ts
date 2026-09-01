import {
  pathImplementationConfirmationRowSchema,
  pathTransferResponseRowSchema,
  pathTransferSubmitRowSchema,
  type PathImplementationConfirmation,
  type PathTransferResponse,
  type PathTransferSubmitResult,
  type TransferDecision,
  type TransferResponse,
} from '@/features/paths/model/transfer';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const TRANSFER_COLUMNS =
  'id, user_id, user_path_id, stage_id, client_request_id, response, decision, ' +
  'evidence, protocol_type, answered_on, defer_until, advanced_to_stage_id, ' +
  'retired_habit_ids, retired_titles, archived_at, created_at';

const CONFIRMATION_COLUMNS =
  'id, user_id, user_path_id, path_id, protocol_type, source_type, source_title, ' +
  'source_author, completed_stages, practice_outcomes, user_sentence, ' +
  'answers_archived_at, completed_at';

export type SubmitPathTransferInput = {
  userPathId: string;
  stageId: string;
  clientRequestId: string;
  response: TransferResponse;
  decision: TransferDecision;
  evidence: string | null;
  today: IsoDate;
};

export async function submitPathTransfer(
  input: SubmitPathTransferInput,
): Promise<PathTransferSubmitResult> {
  const { data, error } = await supabase.rpc('submit_path_transfer', {
    p_user_path_id: input.userPathId,
    p_stage_id: input.stageId,
    p_client_request_id: input.clientRequestId,
    p_response: input.response,
    p_decision: input.decision,
    p_evidence: input.evidence ?? '',
    p_today: input.today,
  });

  if (error !== null) throw toDataError(error);

  const row = data?.[0];
  if (row === undefined) throw toDataError(new Error('Brak wyniku sprawdzianu'));
  return pathTransferSubmitRowSchema.parse(row);
}

export async function fetchPathTransferResponses(
  userPathId?: string,
): Promise<PathTransferResponse[]> {
  let query = supabase
    .from('path_transfer_responses')
    .select(TRANSFER_COLUMNS)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (userPathId !== undefined) query = query.eq('user_path_id', userPathId);

  const { data, error } = await query;
  if (error !== null) throw toDataError(error);
  return pathTransferResponseRowSchema.array().parse(data);
}

export async function fetchPathImplementationConfirmations(): Promise<
  PathImplementationConfirmation[]
> {
  const { data, error } = await supabase
    .from('path_implementation_confirmations')
    .select(CONFIRMATION_COLUMNS)
    .order('completed_at', { ascending: false });

  if (error !== null) throw toDataError(error);
  return pathImplementationConfirmationRowSchema.array().parse(data);
}

export async function archivePathTransferData(userPathId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_path_transfer_data', {
    p_user_path_id: userPathId,
  });

  if (error !== null) throw toDataError(error);
}
