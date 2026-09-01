import { useMutation, type MutationFunction } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { deleteHabitLog, upsertHabitLog } from '@/features/habits/api/habits-api';
import { habitKeys } from '@/features/habits/api/keys';
import { registerHabitRevisionMutationDefaults } from '@/features/habits/api/use-habit-revisions';
import type { HabitLog, HabitLogStatus } from '@/features/habits/model/habit';
import type { TodayTask } from '@/features/habits/model/today-task';
import { toDataError, type DataError } from '@/lib/data-error';
import { nowIso, type IsoDate } from '@/lib/date';
import { queryClient } from '@/lib/query-client';

/**
 * Zmienne mutacji muszą przeżyć zapis do MMKV i restart aplikacji, więc są
 * płaskie i serializowalne — żadnych obiektów nawyku ani funkcji.
 *
 * Niosą stan docelowy, a nie akcję: dzięki temu odhaczenie, pominięcie
 * i notatka idą jedną ścieżką, przez jedną kolejkę offline.
 */
export type HabitLogMutationVariables = {
  habitId: string;
  userId: string;
  date: IsoDate;
  /** Snapshot celu na ten dzień, zapisywany razem z wpisem. */
  targetValue: number;
  /** Docelowy stan wpisu. null = wpis ma zniknąć. */
  status: HabitLogStatus | null;
  note: string | null;
};

type LogMutationContext = { previousLogs: HabitLog[] | undefined };

/** Optymistyczny wpis żyje tylko w cache'u; serwer nada właściwe id. */
function optimisticLog(variables: HabitLogMutationVariables): HabitLog {
  return {
    id: `optimistic:${variables.habitId}:${variables.date}`,
    habitId: variables.habitId,
    userId: variables.userId,
    logDate: variables.date,
    status: variables.status ?? 'done',
    targetValue: variables.targetValue,
    valueCompleted: variables.status === 'done' ? variables.targetValue : null,
    note: variables.note,
    completedAt: nowIso(),
  };
}

const writeHabitLog: MutationFunction<
  HabitLog | null,
  HabitLogMutationVariables
> = async (variables) => {
  if (variables.status === null) {
    await deleteHabitLog(variables.habitId, variables.date);
    return null;
  }

  return upsertHabitLog({
    habitId: variables.habitId,
    userId: variables.userId,
    date: variables.date,
    status: variables.status,
    targetValue: variables.targetValue,
    valueCompleted: variables.status === 'done' ? variables.targetValue : null,
    note: variables.note,
  });
};

/**
 * Callbacki trzymamy w defaultach mutacji, a nie w hooku, bo mutacja
 * wznowiona po restarcie aplikacji nie ma już komponentu, z którego wyszła —
 * i tak musi wiedzieć, co unieważnić.
 */
const logMutationDefaults = {
  mutationFn: writeHabitLog,

  async onMutate(variables: HabitLogMutationVariables): Promise<LogMutationContext> {
    const logsKey = habitKeys.logs(variables.userId, variables.date);

    // Bez tego zapytanie w locie mogłoby nadpisać optymistyczny stan starą odpowiedzią.
    await queryClient.cancelQueries({ queryKey: logsKey });

    const previousLogs = queryClient.getQueryData<HabitLog[]>(logsKey);

    queryClient.setQueryData<HabitLog[]>(logsKey, (current = []) => {
      const withoutHabit = current.filter((log) => log.habitId !== variables.habitId);
      return variables.status === null
        ? withoutHabit
        : [...withoutHabit, optimisticLog(variables)];
    });

    return { previousLogs };
  },

  onError(
    _error: unknown,
    variables: HabitLogMutationVariables,
    context: LogMutationContext | undefined,
  ) {
    if (context === undefined) return;
    queryClient.setQueryData(
      habitKeys.logs(variables.userId, variables.date),
      context.previousLogs,
    );
  },

  onSettled(
    _data: HabitLog | null | undefined,
    _error: unknown,
    variables: HabitLogMutationVariables,
  ) {
    void queryClient.invalidateQueries({
      queryKey: habitKeys.logs(variables.userId, variables.date),
    });
    // Cel na jutro i serie zależą od liczby wykonań.
    void queryClient.invalidateQueries({
      queryKey: habitKeys.progress(variables.userId, variables.date),
    });
    void queryClient.invalidateQueries({
      queryKey: habitKeys.streaks(variables.userId, variables.date),
    });
    void queryClient.invalidateQueries({
      queryKey: habitKeys.streak(variables.userId, variables.habitId, variables.date),
    });
    // Overflow z done/partial staje się pozytywną okazją, więc zmienia też
    // agregaty statystyk mimo że nie tworzy obowiązku.
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  },
};

/**
 * Rejestruje domyślne zachowanie mutacji wpisu.
 *
 * Musi zostać wywołane raz przy starcie aplikacji, zanim odtworzymy kolejkę
 * offline — inaczej wstrzymana mutacja wczytana z dysku nie miałaby czego
 * wywołać.
 */
export function registerHabitMutationDefaults(): void {
  queryClient.setMutationDefaults(habitKeys.toggleLog(), logMutationDefaults);
  registerHabitRevisionMutationDefaults();
}

export type UseToggleHabitLogResult = {
  /** Odhacza albo cofa odhaczenie. Ekran aktualizuje się natychmiast. */
  toggle: (task: TodayTask) => void;
  /** Oznacza dzień jako świadomie pominięty albo cofa pominięcie. */
  skip: (task: TodayTask) => void;
  /**
   * Przywraca wpis do zadanego stanu — pod akcję „Cofnij" w toaście.
   *
   * Bierze stan wprost, a nie przez przełączenie, bo `task` z domknięcia jest
   * sprzed mutacji: ponowne wywołanie toggle() powtórzyłoby akcję zamiast
   * ją odwrócić.
   */
  restore: (task: TodayTask, status: HabitLogStatus | null, note: string | null) => void;
  /** Zapisuje notatkę przy istniejącym wpisie. Bez wpisu nie robi nic. */
  setNote: (task: TodayTask, note: string) => void;
  isPending: boolean;
  /** Prawda, gdy żądanie czeka w kolejce na powrót sieci. */
  isQueued: boolean;
  error: DataError | null;
};

/**
 * Zmiany wpisu na dziś, z optimistic update.
 *
 * Bez sieci mutacja zostaje wstrzymana przez onlineManager, ale onMutate już
 * się wykonał — zmianę widać od razu i przetrwa zamknięcie aplikacji,
 * bo wstrzymane mutacje trafiają do persistera.
 */
export function useToggleHabitLog(): UseToggleHabitLogResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const mutation = useMutation<
    HabitLog | null,
    Error,
    HabitLogMutationVariables,
    LogMutationContext
  >({
    mutationKey: habitKeys.toggleLog(),
  });

  const write = (task: TodayTask, status: HabitLogStatus | null, note: string | null) => {
    if (userId === null) return;

    mutation.mutate({
      habitId: task.habit.id,
      userId,
      date: task.date,
      targetValue: task.target,
      status,
      note,
    });
  };

  return {
    toggle: (task) => {
      write(task, task.isCompleted ? null : 'done', task.log?.note ?? null);
    },
    skip: (task) => {
      write(task, task.isSkipped ? null : 'skipped', task.log?.note ?? null);
    },
    restore: (task, status, note) => {
      write(task, status, note);
    },
    setNote: (task, note) => {
      // Notatka mieszka w wierszu habit_logs, więc bez wpisu nie ma jej gdzie
      // zapisać. UI blokuje pole do czasu odhaczenia lub pominięcia.
      if (task.log === null) return;
      const trimmed = note.trim();
      write(task, task.log.status, trimmed === '' ? null : trimmed);
    },
    isPending: mutation.isPending,
    isQueued: mutation.isPaused,
    error: mutation.error === null ? null : toDataError(mutation.error),
  };
}
