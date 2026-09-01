import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useAuth, useLogicalToday } from '@/features/auth';
import { useDayBudget, useRestDays } from '@/features/day-budget';
import {
  ensureDayPlan,
  fetchActiveHabits,
  fetchHabitsProgress,
  fetchLogsForDate,
} from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import {
  assignmentMap,
  createDayPlanAssignments,
  reconcileDayPlanAssignments,
  visiblePlanTasks,
  type DayPlan,
  type DayPlanItem,
} from '@/features/habits/model/day-plan';
import type { Habit, HabitLog } from '@/features/habits/model/habit';
import { buildTodayTasks, type TodayTask } from '@/features/habits/model/today-task';
import { toDataError, type DataError } from '@/lib/data-error';
import { resolveTimeZone, type IsoDate } from '@/lib/date';
import { queryClient, STALE_TIME } from '@/lib/query-client';

export type UseTodayTasksResult = {
  /** Doba logiczna, dla której zbudowano listę. */
  date: IsoDate;
  /** Wszystkie pozycje snapshotu, również neutralny overflow. */
  tasks: TodayTask[];
  /** Podstawowa lista: planned oraz pozycje już rozstrzygnięte. */
  visible: TodayTask[];
  /** Nierozstrzygnięty overflow pokazywany dopiero po „Pokaż wszystko”. */
  overflow: TodayTask[];
  plan: DayPlan | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: DataError | null;
  refetch: () => void;
};

const EMPTY_HABITS: Habit[] = [];
const EMPTY_LOGS: HabitLog[] = [];
const EMPTY_PROGRESS: ReadonlyMap<string, number> = new Map();

function localPlan(input: {
  userId: string;
  date: IsoDate;
  dailyCeiling: number;
  minuteBudget: number | null;
  timezone: string;
  dayStartHour: number;
  isRest: boolean;
  tasks: readonly TodayTask[];
}): DayPlan {
  const assignments = createDayPlanAssignments(input.tasks, {
    dailyCeiling: input.dailyCeiling,
    minuteBudget: input.minuteBudget,
    isRest: input.isRest,
    isQuietWeek: false,
  });
  const habitById = new Map(input.tasks.map((task) => [task.habit.id, task.habit]));

  const items: DayPlanItem[] = assignments.flatMap((item) => {
    const habit = habitById.get(item.habitId);
    return habit === undefined
      ? []
      : [{ ...item, id: `local:${input.date}:${item.habitId}`, habit }];
  });

  return {
    id: `local:${input.userId}:${input.date}`,
    userId: input.userId,
    date: input.date,
    dailyCeiling: input.dailyCeiling,
    minuteBudget: input.minuteBudget,
    timezone: input.timezone,
    dayStartHour: input.dayStartHour,
    isRest: input.isRest,
    isQuietWeek: false,
    source: 'local',
    items,
  };
}

/**
 * Kanoniczna lista dnia.
 *
 * Serwerowy RPC tworzy trwały snapshot. Gdy urządzenie nie ma sieci i nie ma
 * jeszcze snapshotu, ten sam deterministyczny algorytm tworzy wersję lokalną
 * w persystowanym cache TanStack Query. Po powrocie sieci RPC zastępuje ją
 * snapshotem serwera; unikalności w bazie czynią powtórkę idempotentną.
 */
export function useTodayTasks(): UseTodayTasksResult {
  const { user, profile } = useAuth();
  const date = useLogicalToday();
  const { allocatedWindow } = useDayBudget(date);
  const { isRest } = useRestDays();
  const userId = user?.id ?? null;
  const enabled = userId !== null;
  const keyUserId = userId ?? 'anonymous';
  const dailyCeiling = profile?.dailyCeiling ?? 5;
  const minuteBudget = allocatedWindow?.minutes ?? null;

  const [habitsQuery, logsQuery, progressQuery] = useQueries({
    queries: [
      {
        queryKey: habitKeys.active(keyUserId),
        queryFn: fetchActiveHabits,
        enabled,
        staleTime: STALE_TIME.habits,
      },
      {
        queryKey: habitKeys.logs(keyUserId, date),
        queryFn: () => fetchLogsForDate(date),
        enabled,
        staleTime: STALE_TIME.today,
      },
      {
        queryKey: habitKeys.progress(keyUserId, date),
        queryFn: () => fetchHabitsProgress(date),
        enabled,
        staleTime: STALE_TIME.today,
      },
    ],
  });

  const planQuery = useQuery({
    queryKey: habitKeys.dayPlan(keyUserId, date),
    queryFn: () => ensureDayPlan(date),
    enabled,
    staleTime: STALE_TIME.today,
  });

  const habits = habitsQuery.data ?? EMPTY_HABITS;
  const logs = logsQuery.data ?? EMPTY_LOGS;
  const progress = progressQuery.data ?? EMPTY_PROGRESS;

  const baseTasks = useMemo(
    () => buildTodayTasks(habits, logs, progress, date),
    [habits, logs, progress, date],
  );

  const fallbackPlan = useMemo(
    () =>
      userId === null
        ? null
        : localPlan({
            userId,
            date,
            dailyCeiling,
            minuteBudget,
            timezone: resolveTimeZone(profile?.timezone),
            dayStartHour: profile?.dayStartHour ?? 4,
            isRest: isRest(date),
            tasks: baseTasks,
          }),
    [
      userId,
      date,
      dailyCeiling,
      minuteBudget,
      profile?.timezone,
      profile?.dayStartHour,
      isRest,
      baseTasks,
    ],
  );

  // Same aktywne nawyki wystarczą do awaryjnego planu. Logi i progresja są
  // używane z cache'u, jeśli istnieją; ich brak nie może zablokować nowego dnia
  // otwartego pierwszy raz bez sieci.
  const baseReady = habitsQuery.data !== undefined;

  // Snapshot lokalny trafia do tego samego persystowanego klucza co wynik
  // RPC. Restart offline nie losuje więc planu ponownie.
  useEffect(() => {
    if (!baseReady || fallbackPlan === null || planQuery.data !== undefined) return;
    queryClient.setQueryData(habitKeys.dayPlan(keyUserId, date), fallbackPlan);
  }, [baseReady, fallbackPlan, planQuery.data, keyUserId, date]);

  const plan = planQuery.data ?? fallbackPlan;

  // Tworzenie planu może w tej samej transakcji uruchomić zaplanowaną zmianę
  // definicji (np. przejście osobistego eksperymentu A -> B). Habit osadzony
  // w odpowiedzi planu jest wtedy świeższy niż minutowy cache listy. Scal go
  // od razu, żeby lista i lokalne przypomnienia nie czekały na kolejny focus.
  useEffect(() => {
    if (plan === null || plan.source !== 'server') return;

    const fromPlan = new Map(plan.items.map((item) => [item.habitId, item.habit]));
    queryClient.setQueryData<Habit[]>(habitKeys.active(keyUserId), (current = []) =>
      current.map((habit) => fromPlan.get(habit.id) ?? habit),
    );
  }, [plan, keyUserId]);

  // Zmiana limitu, day-shape albo odpoczynku w środku dnia od razu odpala
  // rekoncyliację serwera. Lokalnie poniżej stosujemy tę samą regułę, więc UI
  // nie czeka na round-trip.
  useEffect(() => {
    if (plan === null || plan.source !== 'server') return;
    if (
      plan.dailyCeiling === dailyCeiling &&
      plan.minuteBudget === minuteBudget &&
      plan.isRest === isRest(date)
    ) {
      return;
    }
    void planQuery.refetch();
  }, [plan, dailyCeiling, minuteBudget, isRest, date, planQuery]);

  const tasks = useMemo(() => {
    if (plan === null) return baseTasks;

    const habitById = new Map(plan.items.map((item) => [item.habitId, item.habit]));
    for (const habit of habits) habitById.set(habit.id, habit);

    const initialTasks = buildTodayTasks(
      [...habitById.values()],
      logs,
      progress,
      date,
      assignmentMap(plan.items),
    );
    const reconciled = reconcileDayPlanAssignments(plan.items, initialTasks, {
      dailyCeiling,
      minuteBudget: plan.minuteBudget,
      isRest: isRest(date),
      isQuietWeek: plan.isQuietWeek,
    });

    return buildTodayTasks(
      [...habitById.values()],
      logs,
      progress,
      date,
      assignmentMap(reconciled),
    );
  }, [plan, baseTasks, habits, logs, progress, date, dailyCeiling, isRest]);

  const partition = useMemo(() => visiblePlanTasks(tasks), [tasks]);
  const firstError =
    habitsQuery.error ?? logsQuery.error ?? progressQuery.error ?? planQuery.error;

  return {
    date,
    tasks,
    ...partition,
    plan,
    isLoading:
      enabled &&
      (habitsQuery.isPending || logsQuery.isPending || progressQuery.isPending),
    isRefreshing:
      !habitsQuery.isPending &&
      (habitsQuery.isFetching ||
        logsQuery.isFetching ||
        progressQuery.isFetching ||
        planQuery.isFetching),
    error:
      firstError === null || firstError === undefined ? null : toDataError(firstError),
    refetch: () => {
      void habitsQuery.refetch();
      void logsQuery.refetch();
      void progressQuery.refetch();
      void planQuery.refetch();
    },
  };
}
