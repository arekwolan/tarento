import {
  frictionEventRowSchema,
  frictionResponseRowSchema,
  type FrictionEvent,
  type FrictionReason,
  type FrictionResponse,
  type FrictionResponseKind,
} from '@/features/friction/model/friction';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const EVENT_COLUMNS =
  'id, habit_id, user_id, event_date, reason, idempotency_key, archived_at, created_at';
const RESPONSE_COLUMNS =
  'id, habit_id, user_id, reason, response, effective_on, suppressed_until, ' +
  'idempotency_key, created_at';

export type FrictionMapData = {
  events: FrictionEvent[];
  responses: FrictionResponse[];
};

export async function fetchFrictionMap(from: IsoDate): Promise<FrictionMapData> {
  const [eventsResult, responsesResult] = await Promise.all([
    supabase
      .from('habit_friction_events')
      .select(EVENT_COLUMNS)
      .is('archived_at', null)
      .gte('event_date', from)
      .order('event_date', { ascending: false }),
    supabase
      .from('habit_friction_responses')
      .select(RESPONSE_COLUMNS)
      .gte('effective_on', from)
      .order('effective_on', { ascending: false }),
  ]);

  if (eventsResult.error !== null) throw toDataError(eventsResult.error);
  if (responsesResult.error !== null) throw toDataError(responsesResult.error);

  return {
    events: frictionEventRowSchema.array().parse(eventsResult.data),
    responses: frictionResponseRowSchema.array().parse(responsesResult.data),
  };
}

export type SaveFrictionEventInput = {
  habitId: string;
  eventDate: IsoDate;
  reason: FrictionReason;
  requestId: string;
};

export async function saveFrictionEvent(
  input: SaveFrictionEventInput,
): Promise<FrictionEvent> {
  const { data, error } = await supabase.rpc('save_habit_friction_event', {
    p_habit_id: input.habitId,
    p_event_date: input.eventDate,
    p_reason: input.reason,
    p_idempotency_key: input.requestId,
  });

  if (error !== null) throw toDataError(error);
  return frictionEventRowSchema.parse(data);
}

export async function setFrictionEventArchived(input: {
  eventId: string;
  archived: boolean;
}): Promise<FrictionEvent> {
  const { data, error } = await supabase.rpc('set_habit_friction_event_archived', {
    p_event_id: input.eventId,
    p_archived: input.archived,
  });

  if (error !== null) throw toDataError(error);
  return frictionEventRowSchema.parse(data);
}

export type RespondToFrictionSuggestionInput = {
  habitId: string;
  reason: FrictionReason;
  response: FrictionResponseKind;
  effectiveOn: IsoDate;
  requestId: string;
};

export async function respondToFrictionSuggestion(
  input: RespondToFrictionSuggestionInput,
): Promise<FrictionResponse> {
  const { data, error } = await supabase.rpc('respond_habit_friction_suggestion', {
    p_habit_id: input.habitId,
    p_reason: input.reason,
    p_response: input.response,
    p_effective_on: input.effectiveOn,
    p_idempotency_key: input.requestId,
  });

  if (error !== null) throw toDataError(error);
  return frictionResponseRowSchema.parse(data);
}
