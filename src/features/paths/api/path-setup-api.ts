import {
  pathSetupActionRowSchema,
  type PathSetupAction,
  type PathSetupActionStatus,
} from '@/features/paths/model/setup-action';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

export async function fetchTodayPathSetupActions(
  today: IsoDate,
): Promise<PathSetupAction[]> {
  const { data, error } = await supabase.rpc('get_today_path_setup_actions', {
    p_today: today,
  });

  if (error !== null) throw toDataError(error);
  return pathSetupActionRowSchema.array().parse(data ?? []);
}

export type ResolvePathSetupActionInput = {
  actionId: string;
  status: Exclude<PathSetupActionStatus, 'pending'>;
  requestId: string;
  today: IsoDate;
};

export async function resolvePathSetupAction(
  input: ResolvePathSetupActionInput,
): Promise<PathSetupAction> {
  const { data, error } = await supabase.rpc('resolve_path_setup_action', {
    p_action_id: input.actionId,
    p_status: input.status,
    p_client_request_id: input.requestId,
    p_today: input.today,
  });

  if (error !== null) throw toDataError(error);
  const row = data?.[0];
  if (row === undefined) throw toDataError(new Error('Brak wyniku przygotowania'));
  return pathSetupActionRowSchema.parse(row);
}
