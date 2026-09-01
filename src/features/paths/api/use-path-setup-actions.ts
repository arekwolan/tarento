import { useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { pathKeys } from '@/features/paths/api/keys';
import {
  fetchTodayPathSetupActions,
  resolvePathSetupAction,
} from '@/features/paths/api/path-setup-api';
import {
  createPathSetupRequestId,
  type PathSetupAction,
  type PathSetupActionStatus,
} from '@/features/paths/model/setup-action';
import { toDataError, type DataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type PathSetupMutationVariables = {
  userId: string;
  actionId: string;
  status: Exclude<PathSetupActionStatus, 'pending'>;
  requestId: string;
  today: IsoDate;
};

type PathSetupMutationContext = {
  previous: PathSetupAction[] | undefined;
};

const writeDecision: MutationFunction<PathSetupAction, PathSetupMutationVariables> = (
  variables,
) =>
  resolvePathSetupAction({
    actionId: variables.actionId,
    status: variables.status,
    requestId: variables.requestId,
    today: variables.today,
  });

const pathSetupMutationDefaults = {
  mutationFn: writeDecision,

  async onMutate(
    variables: PathSetupMutationVariables,
  ): Promise<PathSetupMutationContext> {
    const key = pathKeys.setupToday(variables.userId, variables.today);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<PathSetupAction[]>(key);

    // Terminalna decyzja usuwa kartę od razu. Setup nie zmienia żadnego klucza
    // nawyków, logów ani statystyk.
    queryClient.setQueryData<PathSetupAction[]>(key, (current = []) =>
      current.filter((action) => action.id !== variables.actionId),
    );

    return { previous };
  },

  onError(
    _error: unknown,
    variables: PathSetupMutationVariables,
    context: PathSetupMutationContext | undefined,
  ) {
    if (context === undefined) return;
    queryClient.setQueryData(
      pathKeys.setupToday(variables.userId, variables.today),
      context.previous,
    );
  },

  onSettled(_data: unknown, _error: unknown, variables: PathSetupMutationVariables) {
    void queryClient.invalidateQueries({
      queryKey: pathKeys.setupToday(variables.userId, variables.today),
    });
  },
};

export function registerPathSetupMutationDefaults(): void {
  queryClient.setMutationDefaults(pathKeys.resolveSetup(), pathSetupMutationDefaults);
}

export type UsePathSetupActionsResult = {
  actions: PathSetupAction[];
  complete: (action: PathSetupAction) => void;
  dismiss: (action: PathSetupAction) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  isPending: boolean;
  isQueued: boolean;
  error: DataError | null;
  refetch: () => void;
};

const EMPTY: PathSetupAction[] = [];

export function usePathSetupActions(): UsePathSetupActionsResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: pathKeys.setupToday(userId ?? 'anonymous', today),
    queryFn: () => fetchTodayPathSetupActions(today),
    enabled: userId !== null,
    staleTime: STALE_TIME.today,
  });

  const mutation = useMutation<
    PathSetupAction,
    Error,
    PathSetupMutationVariables,
    PathSetupMutationContext
  >({ mutationKey: pathKeys.resolveSetup() });

  const decide = (
    action: PathSetupAction,
    status: Exclude<PathSetupActionStatus, 'pending'>,
  ) => {
    if (userId === null) return;
    mutation.mutate({
      userId,
      actionId: action.id,
      status,
      requestId: createPathSetupRequestId(),
      today,
    });
  };

  const firstError = query.error ?? mutation.error;

  return {
    actions: query.data ?? EMPTY,
    complete: (action) => {
      decide(action, 'completed');
    },
    dismiss: (action) => {
      decide(action, 'dismissed');
    },
    // Pierwsze otwarcie całkiem offline nie może zatrzymać całego ekranu
    // Dzisiaj na szkielecie. Z cache'u pokażemy setup; bez cache'u bezpiecznie
    // pokażemy praktyki, a setup dojdzie po odzyskaniu połączenia.
    isLoading: query.isPending && userId !== null && query.fetchStatus !== 'paused',
    isRefreshing: query.isFetching && !query.isPending,
    isPending: mutation.isPending,
    isQueued: mutation.isPaused,
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
    refetch: () => {
      void query.refetch();
    },
  };
}
