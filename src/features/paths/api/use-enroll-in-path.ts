import { useMutation, type MutationFunction } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { createConflictRequestId } from '@/features/conflict-radar';
import { habitKeys, type Habit } from '@/features/habits';
import { pathKeys } from '@/features/paths/api/keys';
import { enrollInPath } from '@/features/paths/api/path-actions-api';
import { registerPathSetupMutationDefaults } from '@/features/paths/api/use-path-setup-actions';
import { registerPathTransferMutationDefaults } from '@/features/paths/api/use-path-transfer';
import { optionalPracticeIds } from '@/features/paths/model/fit';
import { scaledPractice } from '@/features/paths/model/parameters';
import type {
  Path,
  PathFit,
  PathPractice,
  PathStage,
  UserPath,
} from '@/features/paths/model/schemas';
import type { PathSetupAction } from '@/features/paths/model/setup-action';
import {
  practicesForStage,
  practiceToHabitInsert,
  type HabitInsert,
} from '@/features/paths/model/stage';
import { toDataError, type DataError } from '@/lib/data-error';
import { nowIso, type IsoDate } from '@/lib/date';
import { queryClient } from '@/lib/query-client';

/**
 * Zmienne mutacji muszą przeżyć zapis do MMKV i restart aplikacji, więc są
 * płaskie i serializowalne — żadnych obiektów ścieżki ani funkcji.
 *
 * `habits` jest tu wyłącznie po to, żeby lista na dziś pokazała nowe pozycje
 * natychmiast. Wiersze zakłada baza, w jednej transakcji.
 */
export type EnrollVariables = {
  userId: string;
  pathId: string;
  /** Pierwszy etap — potrzebny optymistycznemu zapisowi, nie funkcji w bazie. */
  stageId: string;
  lite: boolean;
  today: IsoDate;
  /** Praktyki wyłączalne, których użytkownik nie chce. */
  skipPracticeIds: string[];
  /** Setupy usunięte w preview; baza materializuje je od razu jako dismissed. */
  skipSetupStageIds: string[];
  /** Dopasowanie zapisywane w user_paths.fit. Bez modelu — sam werdykt. */
  fit: PathFit;
  /** Review W5 dla prywatnego protokołu; null dla katalogu redakcyjnego. */
  conflictReviewId: string | null;
  /** Ten sam UUID przeżywa retry kolejki i nie tworzy drugiego user_path. */
  enrollmentRequestId: string;
  habits: HabitInsert[];
  /** Tylko setup pierwszego etapu może być widoczny optymistycznie dzisiaj. */
  setupAction: Pick<
    PathSetupAction,
    'stageId' | 'title' | 'explanation' | 'sortOrder'
  > | null;
};

type EnrollContext = {
  previousHabits: Habit[] | undefined;
  previousUserPaths: UserPath[] | undefined;
  previousSetupActions: PathSetupAction[] | undefined;
};

/**
 * Nawyki, których jeszcze nie ma w bazie.
 *
 * Identyfikator jest jawnie tymczasowy: gdy przyjdzie odpowiedź, cały klucz
 * i tak zostaje unieważniony, a do tego czasu nic nie odwołuje się do tych
 * wierszy po id.
 */
function optimisticHabits(variables: EnrollVariables): Habit[] {
  const timestamp = nowIso();

  return variables.habits.map((insert, index) => ({
    ...insert,
    id: `optimistic:path:${variables.pathId}:${index}`,
    icon: null,
    color: null,
    reminderTime: null,
    retiredAt: null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

/**
 * Praktyka po dopasowaniu.
 *
 * Mirror `public.materialize_path_practice`: bierzemy mniejszą z dwóch
 * wartości, bo dopasowanie schodzi wyłącznie w dół i nie ma prawa podnieść
 * tego, co obniżył wariant lekki.
 */
function adjustedPractice(practice: PathPractice, fit: PathFit): PathPractice {
  const adjustment = fit.adjust.find((entry) => entry.practiceId === practice.id);
  if (adjustment === undefined) return practice;

  return {
    ...practice,
    startValue: Math.min(practice.startValue, Math.max(1, adjustment.startValue)),
    timeOfDay: adjustment.timeOfDay,
  };
}

function optimisticUserPath(variables: EnrollVariables): UserPath {
  const timestamp = nowIso();

  return {
    id: `optimistic:${variables.pathId}`,
    userId: variables.userId,
    pathId: variables.pathId,
    state: 'active',
    currentStageId: variables.stageId,
    stageEnteredOn: variables.today,
    startedOn: variables.today,
    pausedAt: null,
    endedAt: null,
    endedReason: null,
    reentryUntil: null,
    fit: variables.fit,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function optimisticSetupAction(variables: EnrollVariables): PathSetupAction | null {
  if (variables.setupAction === null) return null;
  const timestamp = nowIso();

  return {
    id: `optimistic:setup:${variables.enrollmentRequestId}`,
    userId: variables.userId,
    userPathId: `optimistic:${variables.pathId}`,
    ...variables.setupAction,
    status: 'pending',
    decidedOn: null,
    clientRequestId: null,
    statusChangedAt: timestamp,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const writeEnrollment: MutationFunction<string, EnrollVariables> = (variables) =>
  enrollInPath(
    variables.pathId,
    variables.lite,
    variables.today,
    variables.skipPracticeIds,
    variables.fit,
    variables.skipSetupStageIds,
    variables.enrollmentRequestId,
    variables.conflictReviewId,
  );

/**
 * Callbacki trzymamy w defaultach mutacji, a nie w hooku, bo zapis wznowiony
 * po restarcie aplikacji nie ma już ekranu, z którego wyszedł — i tak musi
 * wiedzieć, co unieważnić.
 */
const enrollMutationDefaults = {
  mutationFn: writeEnrollment,

  async onMutate(variables: EnrollVariables): Promise<EnrollContext> {
    const habitsKey = habitKeys.active(variables.userId);
    const activeKey = pathKeys.active(variables.userId);
    const setupKey = pathKeys.setupToday(variables.userId, variables.today);

    // Bez tego zapytanie w locie mogłoby nadpisać optymistyczny stan starą
    // odpowiedzią — listą sprzed zapisu na ścieżkę.
    await queryClient.cancelQueries({ queryKey: habitsKey });
    await queryClient.cancelQueries({ queryKey: activeKey });
    await queryClient.cancelQueries({ queryKey: setupKey });

    const previousHabits = queryClient.getQueryData<Habit[]>(habitsKey);
    const previousUserPaths = queryClient.getQueryData<UserPath[]>(activeKey);
    const previousSetupActions = queryClient.getQueryData<PathSetupAction[]>(setupKey);

    queryClient.setQueryData<Habit[]>(habitsKey, (current = []) => [
      ...current,
      ...optimisticHabits(variables),
    ]);
    queryClient.setQueryData<UserPath[]>(activeKey, (current = []) => [
      optimisticUserPath(variables),
      ...current,
    ]);
    const setupAction = optimisticSetupAction(variables);
    if (setupAction !== null) {
      queryClient.setQueryData<PathSetupAction[]>(setupKey, (current = []) => [
        setupAction,
        ...current,
      ]);
    }

    return { previousHabits, previousUserPaths, previousSetupActions };
  },

  onError(
    _error: unknown,
    variables: EnrollVariables,
    context: EnrollContext | undefined,
  ) {
    if (context === undefined) return;

    queryClient.setQueryData(habitKeys.active(variables.userId), context.previousHabits);
    queryClient.setQueryData(
      pathKeys.active(variables.userId),
      context.previousUserPaths,
    );
    queryClient.setQueryData(
      pathKeys.setupToday(variables.userId, variables.today),
      context.previousSetupActions,
    );
  },

  onSettled() {
    // Nawyki ze ścieżki zmieniają listę, cele i serie naraz.
    void queryClient.invalidateQueries({ queryKey: habitKeys.all });
    void queryClient.invalidateQueries({ queryKey: pathKeys.all });
  },
};

/**
 * Rejestruje domyślne zachowanie zapisu na ścieżkę.
 *
 * Musi zostać wywołane raz przy starcie aplikacji, zanim odtworzymy kolejkę
 * offline — inaczej wstrzymany zapis wczytany z dysku nie miałby czego wywołać.
 */
export function registerPathMutationDefaults(): void {
  queryClient.setMutationDefaults(pathKeys.enroll(), enrollMutationDefaults);
  registerPathTransferMutationDefaults();
  registerPathSetupMutationDefaults();
}

export type EnrollInput = {
  path: Path;
  stages: readonly PathStage[];
  practices: readonly PathPractice[];
  /** Wariant lekki: mniejsze liczby i bez praktyk wyłączalnych. */
  lite: boolean;
  /**
   * Praktyki wyłączalne odznaczone przez użytkownika przy zapisie. Wariant
   * lekki i tak pomija wszystkie, więc wtedy ta lista nic nie zmienia.
   */
  skipPracticeIds?: readonly string[];
  /** Jednorazowe setupy odrzucone w podglądzie przed aktywacją. */
  skipSetupStageIds?: readonly string[];
  /**
   * Dopasowanie z ekranu przeglądu. Przy zapisie bez dopasowania podaj wynik
   * `deterministicPathFit()` — ścieżka ma się zapisać także wtedy, gdy model
   * jest nieosiągalny.
   */
  fit: PathFit;
  conflictReviewId?: string | null;
};

export type UseEnrollInPathResult = {
  enroll: (input: EnrollInput) => void;
  isPending: boolean;
  /** Prawda, gdy żądanie czeka w kolejce na powrót sieci. */
  isQueued: boolean;
  error: DataError | null;
};

/**
 * Zapis na ścieżkę z optimistic update.
 *
 * Bez sieci mutacja zostaje wstrzymana przez onlineManager, ale onMutate już
 * się wykonał — nowe pozycje widać na liście od razu i przetrwają zamknięcie
 * aplikacji, bo wstrzymane mutacje trafiają do persistera.
 */
export function useEnrollInPath(): UseEnrollInPathResult {
  const { user } = useAuth();
  const today = useLogicalToday();
  const userId = user?.id ?? null;

  const mutation = useMutation<string, Error, EnrollVariables, EnrollContext>({
    mutationKey: pathKeys.enroll(),
  });

  return {
    enroll: ({
      path,
      stages,
      practices,
      lite,
      skipPracticeIds = [],
      skipSetupStageIds = [],
      fit,
      conflictReviewId = null,
    }: EnrollInput) => {
      const firstStage = stages[0];
      if (userId === null || firstStage === undefined) return;

      // Wariant lekki zdejmuje wszystkie praktyki wyłączalne; poza nim liczy
      // się wyłącznie to, co odznaczył użytkownik. Ta sama reguła siedzi
      // w public.enroll_in_path.
      const skipped = [
        ...new Set([
          ...(lite ? optionalPracticeIds(practices) : skipPracticeIds),
          ...fit.skip,
        ]),
      ];
      const selected = practicesForStage(firstStage, practices, skipped);
      const skippedSetups = [...new Set(skipSetupStageIds)];
      const firstSetup =
        firstStage.environmentSetup === null || skippedSetups.includes(firstStage.id)
          ? null
          : {
              stageId: firstStage.id,
              title: firstStage.environmentSetup,
              explanation: null,
              sortOrder: firstStage.ordinal,
            };

      mutation.mutate({
        userId,
        pathId: path.id,
        stageId: firstStage.id,
        lite,
        today,
        skipPracticeIds: skipped,
        skipSetupStageIds: skippedSetups,
        fit,
        conflictReviewId,
        enrollmentRequestId: createConflictRequestId(),
        setupAction: firstSetup,
        habits: selected.map((practice) =>
          practiceToHabitInsert(
            adjustedPractice(scaledPractice(practice, { lite, reentry: false }), fit),
            userId,
            path,
            firstStage.id,
            today,
          ),
        ),
      });
    },
    isPending: mutation.isPending,
    isQueued: mutation.isPaused,
    error: mutation.error === null ? null : toDataError(mutation.error),
  };
}
