import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { trackEvent } from '@/features/analytics';
import { useAuth, useLogicalToday } from '@/features/auth';
import {
  fetchFrictionMap,
  respondToFrictionSuggestion,
  saveFrictionEvent,
  setFrictionEventArchived,
  type FrictionMapData,
  type RespondToFrictionSuggestionInput,
  type SaveFrictionEventInput,
} from '@/features/friction/api/friction-api';
import { frictionKeys } from '@/features/friction/api/keys';
import {
  createFrictionRequestId,
  findFrictionSuggestion,
  FRICTION_SUPPRESSION_DAYS,
  FRICTION_WINDOW_DAYS,
  type FrictionEvent,
  type FrictionReason,
  type FrictionResponse,
  type FrictionResponseKind,
  type FrictionSuggestion,
} from '@/features/friction/model/friction';
import { toDataError, type DataError } from '@/lib/data-error';
import { addDays, nowIso, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

const EMPTY_MAP: FrictionMapData = { events: [], responses: [] };

export type SaveFrictionEventVariables = SaveFrictionEventInput & { userId: string };
export type ArchiveFrictionEventVariables = {
  userId: string;
  event: FrictionEvent;
  archived: boolean;
};
export type RespondToFrictionVariables = RespondToFrictionSuggestionInput & {
  userId: string;
};

type MutationContext = { previous: FrictionMapData | undefined };

const writeEvent: MutationFunction<FrictionEvent, SaveFrictionEventVariables> = (
  variables,
) => saveFrictionEvent(variables);

const writeArchive: MutationFunction<FrictionEvent, ArchiveFrictionEventVariables> = (
  variables,
) =>
  setFrictionEventArchived({
    eventId: variables.event.id,
    archived: variables.archived,
  });

const writeResponse: MutationFunction<FrictionResponse, RespondToFrictionVariables> = (
  variables,
) => respondToFrictionSuggestion(variables);

function rollbackMap(
  variables: { userId: string; eventDate?: IsoDate; effectiveOn?: IsoDate },
  context: MutationContext | undefined,
): void {
  if (context === undefined) return;
  const date = variables.eventDate ?? variables.effectiveOn;
  if (date === undefined) return;
  queryClient.setQueryData(frictionKeys.map(variables.userId, date), context.previous);
}

const saveEventDefaults = {
  mutationFn: writeEvent,
  async onMutate(variables: SaveFrictionEventVariables): Promise<MutationContext> {
    const key = frictionKeys.map(variables.userId, variables.eventDate);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<FrictionMapData>(key);

    const optimistic: FrictionEvent = {
      id: variables.requestId,
      habitId: variables.habitId,
      userId: variables.userId,
      eventDate: variables.eventDate,
      reason: variables.reason,
      idempotencyKey: variables.requestId,
      archivedAt: null,
      createdAt: nowIso(),
    };

    queryClient.setQueryData<FrictionMapData>(key, (current = EMPTY_MAP) => ({
      ...current,
      events: [
        ...current.events.filter(
          (event) =>
            event.habitId !== variables.habitId ||
            event.eventDate !== variables.eventDate,
        ),
        optimistic,
      ],
    }));

    return { previous };
  },
  onError(
    _error: unknown,
    variables: SaveFrictionEventVariables,
    context: MutationContext | undefined,
  ) {
    rollbackMap(variables, context);
  },
  onSettled() {
    void queryClient.invalidateQueries({ queryKey: frictionKeys.all });
  },
};

const archiveEventDefaults = {
  mutationFn: writeArchive,
  async onMutate(variables: ArchiveFrictionEventVariables): Promise<MutationContext> {
    const key = frictionKeys.map(variables.userId, variables.event.eventDate);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<FrictionMapData>(key);

    queryClient.setQueryData<FrictionMapData>(key, (current = EMPTY_MAP) => ({
      ...current,
      events: variables.archived
        ? current.events.filter((event) => event.id !== variables.event.id)
        : [
            ...current.events.filter(
              (event) =>
                event.habitId !== variables.event.habitId ||
                event.eventDate !== variables.event.eventDate,
            ),
            { ...variables.event, archivedAt: null },
          ],
    }));

    return { previous };
  },
  onError(
    _error: unknown,
    variables: ArchiveFrictionEventVariables,
    context: MutationContext | undefined,
  ) {
    rollbackMap(
      { userId: variables.userId, eventDate: variables.event.eventDate },
      context,
    );
  },
  onSettled() {
    void queryClient.invalidateQueries({ queryKey: frictionKeys.all });
  },
};

const respondDefaults = {
  mutationFn: writeResponse,
  async onMutate(variables: RespondToFrictionVariables): Promise<MutationContext> {
    const key = frictionKeys.map(variables.userId, variables.effectiveOn);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<FrictionMapData>(key);

    const optimistic: FrictionResponse = {
      id: variables.requestId,
      habitId: variables.habitId,
      userId: variables.userId,
      reason: variables.reason,
      response: variables.response,
      effectiveOn: variables.effectiveOn,
      suppressedUntil: addDays(variables.effectiveOn, FRICTION_SUPPRESSION_DAYS),
      idempotencyKey: variables.requestId,
      createdAt: nowIso(),
    };

    queryClient.setQueryData<FrictionMapData>(key, (current = EMPTY_MAP) => ({
      ...current,
      responses: [...current.responses, optimistic],
    }));

    return { previous };
  },
  onError(
    _error: unknown,
    variables: RespondToFrictionVariables,
    context: MutationContext | undefined,
  ) {
    rollbackMap(variables, context);
  },
  onSettled() {
    void queryClient.invalidateQueries({ queryKey: frictionKeys.all });
  },
};

export function registerFrictionMutationDefaults(): void {
  queryClient.setMutationDefaults(frictionKeys.saveEvent(), saveEventDefaults);
  queryClient.setMutationDefaults(frictionKeys.archiveEvent(), archiveEventDefaults);
  queryClient.setMutationDefaults(frictionKeys.respond(), respondDefaults);
}

export type UseFrictionMapResult = {
  events: FrictionEvent[];
  suggestion: FrictionSuggestion | null;
  reasonFor: (habitId: string, date: IsoDate) => FrictionReason | null;
  saveReason: (habitId: string, date: IsoDate, reason: FrictionReason) => void;
  archiveReason: (habitId: string, date: IsoDate) => FrictionEvent | null;
  restoreReason: (event: FrictionEvent) => void;
  respond: (suggestion: FrictionSuggestion, response: FrictionResponseKind) => void;
  isLoading: boolean;
  isPending: boolean;
  isQueued: boolean;
  error: DataError | null;
  refetch: () => void;
};

export function useFrictionMap(): UseFrictionMapResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = useLogicalToday();
  const from = addDays(today, -(FRICTION_WINDOW_DAYS - 1));

  const query = useQuery({
    queryKey: frictionKeys.map(userId ?? 'anonymous', today),
    queryFn: () => fetchFrictionMap(from),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });
  const saveMutation = useMutation<
    FrictionEvent,
    Error,
    SaveFrictionEventVariables,
    MutationContext
  >({ mutationKey: frictionKeys.saveEvent() });
  const archiveMutation = useMutation<
    FrictionEvent,
    Error,
    ArchiveFrictionEventVariables,
    MutationContext
  >({ mutationKey: frictionKeys.archiveEvent() });
  const respondMutation = useMutation<
    FrictionResponse,
    Error,
    RespondToFrictionVariables,
    MutationContext
  >({ mutationKey: frictionKeys.respond() });

  const data = query.data ?? EMPTY_MAP;
  const suggestion = findFrictionSuggestion(data.events, data.responses, today);
  const firstError =
    query.error ?? saveMutation.error ?? archiveMutation.error ?? respondMutation.error;

  const eventFor = (events: readonly FrictionEvent[], habitId: string, date: IsoDate) =>
    events.find(
      (event) =>
        event.habitId === habitId &&
        event.eventDate === date &&
        event.archivedAt === null,
    ) ?? null;

  return {
    events: data.events,
    suggestion,
    reasonFor: (habitId, date) => eventFor(data.events, habitId, date)?.reason ?? null,
    saveReason: (habitId, date, reason) => {
      if (userId === null) return;
      trackEvent('habit_friction_recorded', { reason });
      saveMutation.mutate({
        userId,
        habitId,
        eventDate: date,
        reason,
        requestId: createFrictionRequestId(),
      });
    },
    archiveReason: (habitId, date) => {
      if (userId === null) return null;
      // Akcja „Cofnij" może odpalić się z callbacku utworzonego przed wyborem
      // powodu. Czytamy więc aktualny cache, nie snapshot z tamtego renderu.
      const current =
        queryClient.getQueryData<FrictionMapData>(frictionKeys.map(userId, today)) ??
        data;
      const event = eventFor(current.events, habitId, date);
      if (event === null) return null;
      archiveMutation.mutate({ userId, event, archived: true });
      return event;
    },
    restoreReason: (event) => {
      if (userId === null) return;
      archiveMutation.mutate({ userId, event, archived: false });
    },
    respond: (current, response) => {
      if (userId === null) return;
      trackEvent('habit_friction_suggestion_answered', {
        reason: current.reason,
        response,
      });
      respondMutation.mutate({
        userId,
        habitId: current.habitId,
        reason: current.reason,
        response,
        effectiveOn: today,
        requestId: createFrictionRequestId(),
      });
    },
    isLoading: query.isPending && userId !== null,
    isPending:
      saveMutation.isPending || archiveMutation.isPending || respondMutation.isPending,
    isQueued:
      saveMutation.isPaused || archiveMutation.isPaused || respondMutation.isPaused,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
    refetch: () => {
      void query.refetch();
    },
  };
}
