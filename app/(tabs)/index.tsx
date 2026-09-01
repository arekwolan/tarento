import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Banner,
  Button,
  EmptyState,
  Screen,
  Sheet,
  Text,
  usePressClass,
  useToast,
} from '@/components/ui';
import {
  trackEvent,
  useDayCompleteEvent,
  useHabitStreakMilestones,
} from '@/features/analytics';
import { useAuth } from '@/features/auth';
import { useDayWindow, useRestDays, useToggleRestDay } from '@/features/day-budget';
import {
  FrictionEnvironmentSheet,
  FrictionReasonSheet,
  FrictionSuggestionCard,
  useFrictionMap,
  visibleFrictionSuggestion,
  type FrictionSuggestion,
} from '@/features/friction';
import {
  useHabits,
  useHabitStreaks,
  useTodayTasks,
  useToggleHabitLog,
  type TodayTask,
} from '@/features/habits';
import { AllDoneCard } from '@/features/habits/components/all-done-card';
import { DayProgress } from '@/features/habits/components/day-progress';
import { TaskDetailsSheet } from '@/features/habits/components/task-details-sheet';
import { TaskGroupList } from '@/features/habits/components/task-group-list';
import { TodaySkeleton } from '@/features/habits/components/today-skeleton';
import {
  countCompleted,
  greetingBand,
  isDayComplete,
} from '@/features/habits/model/grouping';
import type { TodayTask as TodayTaskModel } from '@/features/habits/model/today-task';
import { DayNoteField, RecallCard, useRecall } from '@/features/journal';
import { LetterCard, useDueLetter, useWriteLetter } from '@/features/letters';
import { useQuietWeek } from '@/features/notifications';
import {
  PathEndSheet,
  PathSetupActionCard,
  PathTransferCard,
  PathTransferSheet,
  usePathLifecycle,
  usePathSetupActions,
  useReentryReconcile,
  useRetirePractice,
  useStageAdvance,
} from '@/features/paths';
import { useDailyQuote, useQuoteFavorite } from '@/features/quotes';
import { DailyQuoteCard } from '@/features/quotes/components/daily-quote-card';
import type { PracticesDecision } from '@/features/paths';
import type { TranslationKey } from '@/i18n/keys';
import { cn } from '@/lib/cn';
import {
  formatFullDay,
  getLocalHour,
  resolveTimeZone,
  type SupportedLocale,
} from '@/lib/date';
import { useIsOnline } from '@/lib/network';
import { useTheme } from '@/theme/theme-provider';

const GREETING_LABEL: Record<'morning' | 'afternoon' | 'evening', TranslationKey> = {
  morning: 'today.greeting.morning',
  afternoon: 'today.greeting.afternoon',
  evening: 'today.greeting.evening',
};

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const { profile } = useAuth();
  const isOnline = useIsOnline();
  const pressClass = usePressClass();
  const { show: showToast } = useToast();

  const {
    date,
    tasks,
    visible,
    overflow,
    isLoading: areTasksLoading,
    isRefreshing,
    error,
    refetch,
  } = useTodayTasks();
  const { headline } = useDayWindow(date);
  const { isRest, isLoading: areRestDaysLoading } = useRestDays();
  const { makeRestDay, undoRestDay } = useToggleRestDay();
  const { habits } = useHabits();
  const friction = useFrictionMap();
  const { endsOn: quietWeekEndsOn } = useQuietWeek();
  const { streaks } = useHabitStreaks();
  const { quote } = useDailyQuote();
  const { isFavorite, toggle: toggleFavorite } = useQuoteFavorite();
  const { toggle, skip, restore, setNote } = useToggleHabitLog();
  const {
    ready: transferReady,
    check: transferCheck,
    beginCheck: beginTransferCheck,
    dismissCheck: dismissTransferCheck,
    submitTransfer,
    completion,
    dismissCompletion,
    lastAdvanceResult,
    clearLastAdvanceResult,
    isPending: isSubmittingTransfer,
    isQueued: isTransferQueued,
    error: transferError,
  } = useStageAdvance();
  const { restore: restorePractices } = useRetirePractice();
  const setupActions = usePathSetupActions();
  const { end: endPath, isPending: isEndingPath } = usePathLifecycle();
  const { write: writeLetter } = useWriteLetter();
  // Koniec tygodnia wejściowego sprawdzamy tu, bo tu użytkownik i tak
  // zagląda — i tu zmiana parametrów jest widoczna.
  useReentryReconcile();
  const { letter, dismiss: dismissLetter } = useDueLetter();
  const { recall } = useRecall();

  const [detailsTask, setDetailsTask] = useState<TodayTask | null>(null);
  const [frictionTask, setFrictionTask] = useState<TodayTask | null>(null);
  const [environmentSuggestion, setEnvironmentSuggestion] =
    useState<FrictionSuggestion | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isDayMenuOpen, setDayMenuOpen] = useState(false);
  /** Dzień pusty da się przejrzeć mimo wszystko — ale dopiero po dotknięciu. */
  const [showRestList, setShowRestList] = useState(false);

  /**
   * Akcja idzie od razu, a użytkownik dostaje 5 sekund na wycofanie —
   * zamiast pytania „czy na pewno" przed każdym odhaczeniem.
   */
  const undoable = (
    task: TodayTaskModel,
    message: TranslationKey,
    afterUndo?: () => void,
  ) => {
    const previousStatus = task.log?.status ?? null;
    const previousNote = task.log?.note ?? null;

    showToast({
      message: t(message),
      action: {
        label: t('common.undo'),
        onPress: () => {
          restore(task, previousStatus, previousNote);
          afterUndo?.();
        },
      },
    });
  };

  /** Zdarzenie leci tylko przy odhaczeniu, nie przy cofaniu. */
  const handleToggle = (task: TodayTaskModel) => {
    if (!task.isCompleted) {
      trackEvent('habit_completed', {
        unit: task.habit.unit,
        schedule_type: task.habit.scheduleType,
        current_streak: streaks.get(task.habit.id)?.currentStreak ?? 0,
      });
    }

    toggle(task);
    undoable(task, task.isCompleted ? 'today.toast.undone' : 'today.toast.done');
  };

  const handleSkip = (task: TodayTaskModel) => {
    const removedReason = task.isSkipped
      ? friction.archiveReason(task.habit.id, task.date)
      : null;
    skip(task);
    if (!task.isSkipped) setFrictionTask(task);
    undoable(
      task,
      task.isSkipped ? 'today.toast.unskipped' : 'today.toast.skipped',
      () => {
        if (task.isSkipped && removedReason !== null) {
          friction.restoreReason(removedReason);
        } else {
          friction.archiveReason(task.habit.id, task.date);
        }
      },
    );
  };

  /**
   * Dzień pusty wchodzi od razu, z pięcioma sekundami na wycofanie — jak każda
   * odwracalna akcja w tej aplikacji (CLAUDE.md §5).
   */
  const handleMakeRestDay = async () => {
    setDayMenuOpen(false);

    const id = await makeRestDay(date);
    if (id === null) return;

    showToast({
      message: t('rest.today.title'),
      action: {
        label: t('common.undo'),
        onPress: () => {
          undoRestDay(id);
          showToast({ message: t('rest.today.undone') });
        },
      },
    });
  };

  useEffect(() => {
    if (lastAdvanceResult === null) return;

    if (lastAdvanceResult.retiredHabitIds.length > 0) {
      const [firstTitle] = lastAdvanceResult.retiredTitles;
      showToast({
        message:
          lastAdvanceResult.retiredTitles.length === 1 && firstTitle !== undefined
            ? t('path.retire', { practice: firstTitle })
            : t('path.retireMany'),
        action: {
          label: t('common.undo'),
          onPress: () => {
            restorePractices(lastAdvanceResult.retiredHabitIds);
          },
        },
      });
    }

    clearLastAdvanceResult();
  }, [lastAdvanceResult, clearLastAdvanceResult, restorePractices, showToast, t]);

  /**
   * Zamknięcie ścieżki po ostatnim etapie. Bez gratulacji i bez propozycji
   * kolejnej ścieżki — zostaje jedno pytanie o praktyki i odpowiedź na nie.
   */
  const handlePathCompletion = (decision: PracticesDecision) => {
    if (completion === null) return;

    void endPath(completion.userPathId, 'completed', decision).then((ok) => {
      if (!ok) return;

      showToast({
        message: t(decision === 'keep' ? 'path.end.kept' : 'path.end.removed'),
      });
    });
  };

  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';
  const timeZone = resolveTimeZone(profile?.timezone);

  // Powitanie zależy od zegara ściennego, nie od doby logicznej — dlatego
  // liczone przy każdym renderze, a nie zapamiętywane.
  const band = greetingBand(getLocalHour(timeZone));
  const greeting = GREETING_LABEL[band];

  // Dopóki nie wiadomo, czy dziś jest dzień pusty, lepiej pokazać szkielet
  // niż listę, która za chwilę zniknie.
  const isLoading = areTasksLoading || areRestDaysLoading || setupActions.isLoading;

  const shown = showAll ? tasks : visible;
  const expectedTasks = tasks.filter(
    (task) => task.planState === 'planned' || task.isCompleted,
  );

  useDayCompleteEvent(expectedTasks, date);
  useHabitStreakMilestones(streaks);

  const done = countCompleted(expectedTasks);
  const hasHabits = habits.length > 0;
  const hasSetupAction = setupActions.actions.length > 0;
  const showEmptyState = !isLoading && !hasHabits && !hasSetupAction;
  // Pusta lista nie znaczy „wszystko zrobione": może po prostu nic się dziś
  // już nie mieści. Karta należy się tylko wtedy, gdy na dziś nic nie wypadło
  // albo gdy to, co widać, jest domknięte.
  const showAllDone =
    !isLoading &&
    hasHabits &&
    (tasks.length === 0 || (expectedTasks.length > 0 && isDayComplete(expectedTasks)));

  // Otwarty arkusz musi widzieć świeży stan pozycji, a nie ten sprzed odhaczenia.
  const openTask =
    detailsTask === null
      ? null
      : (tasks.find((task) => task.habit.id === detailsTask.habit.id) ?? detailsTask);
  const transferHabit =
    transferCheck === null
      ? null
      : (habits.find(
          (habit) =>
            habit.sourceStageId === transferCheck.stage.id &&
            habit.archivedAt === null &&
            habit.retiredAt === null,
        ) ?? null);
  const frictionSuggestion = visibleFrictionSuggestion(
    friction.suggestion,
    quietWeekEndsOn,
  );
  const frictionSuggestionHabit =
    frictionSuggestion === null
      ? null
      : (habits.find((habit) => habit.id === frictionSuggestion.habitId) ?? null);
  const environmentHabit =
    environmentSuggestion === null
      ? null
      : (habits.find((habit) => habit.id === environmentSuggestion.habitId) ?? null);

  const handleFrictionSuggestion = (suggestion: FrictionSuggestion) => {
    if (suggestion.action === 'prepare') {
      setEnvironmentSuggestion(suggestion);
      return;
    }

    friction.respond(suggestion, 'acted');

    if (suggestion.action === 'rest') {
      setDayMenuOpen(true);
      return;
    }

    router.push({
      pathname: '/habit/[id]',
      params: { id: suggestion.habitId, frictionAction: suggestion.action },
    });
  };

  const handleRefresh = () => {
    refetch();
    friction.refetch();
    setupActions.refetch();
  };

  /**
   * Dzień pusty: cytat, jedno zdanie i nic więcej.
   *
   * Bez listy, bez pustego stanu z wezwaniem do działania, bez licznika —
   * cisza jest tu funkcją, a nie brakiem treści. Wyjście awaryjne stoi na
   * samym dole i jest ghostem, żeby nie wyglądało na to, o co prosimy.
   */
  if (isRest(date) && !showRestList) {
    return (
      <Screen>
        {quote === null ? null : (
          <DailyQuoteCard
            quote={quote}
            isFavorite={isFavorite(quote.id)}
            onToggleFavorite={toggleFavorite}
          />
        )}

        <Text variant="title" className="text-center">
          {t('rest.today.title')}
        </Text>

        <View className="flex-1" />

        <Button
          label={t('rest.today.showList')}
          variant="ghost"
          onPress={() => {
            setShowRestList(true);
          }}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen
        scroll
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || setupActions.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={color('text-tertiary')}
            colors={[color('text-primary')]}
            progressBackgroundColor={color('surface')}
          />
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t(greeting)}, ${formatFullDay(date, locale)}`}
          accessibilityHint={t('today.dayMenu.hint')}
          onPress={() => {
            setDayMenuOpen(true);
          }}
          className={cn('gap-1', pressClass)}
        >
          <Text variant="titleLg">{t(greeting)}</Text>
          <Text variant="body" tone="secondary">
            {formatFullDay(date, locale)}
          </Text>
        </Pressable>

        {isOnline ? null : <Banner message={t('today.offline.banner')} />}
        {isOnline && error !== null ? (
          <Banner tone="danger" message={t('today.error.load')} />
        ) : null}
        {isTransferQueued ? <Banner message={t('path.transfer.queued')} /> : null}
        {isOnline && transferError !== null ? (
          <Banner tone="danger" message={t('path.transfer.error')} />
        ) : null}
        {setupActions.isQueued ? <Banner message={t('path.setup.queued')} /> : null}
        {isOnline && setupActions.error !== null ? (
          <Banner tone="danger" message={t('path.setup.error')} />
        ) : null}
        {friction.isQueued ? <Banner message={t('friction.queued')} /> : null}
        {isOnline && friction.error !== null ? (
          <Banner message={t('friction.loadError')} />
        ) : null}

        {letter === null ? null : (
          <LetterCard letter={letter} locale={locale} onDismiss={dismissLetter} />
        )}

        <RecallCard recall={recall} />

        {transferReady === null ? null : (
          <PathTransferCard ready={transferReady} onPress={beginTransferCheck} />
        )}

        {quote === null ? null : (
          <DailyQuoteCard
            quote={quote}
            isFavorite={isFavorite(quote.id)}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {frictionSuggestion === null || frictionSuggestionHabit === null ? null : (
          <FrictionSuggestionCard
            suggestion={frictionSuggestion}
            habitTitle={frictionSuggestionHabit.title}
            isPending={friction.isPending}
            onAction={() => {
              handleFrictionSuggestion(frictionSuggestion);
            }}
            onDismiss={() => {
              friction.respond(frictionSuggestion, 'dismissed');
            }}
          />
        )}

        {isLoading ? <TodaySkeleton /> : null}

        {showEmptyState ? (
          <EmptyState
            icon="leaf-outline"
            title={t('today.empty.title')}
            description={t('today.empty.description')}
            action={
              <Button
                label={t('today.empty.action')}
                size="lg"
                onPress={() => {
                  router.push('/habit/new');
                }}
              />
            }
          />
        ) : null}

        {!isLoading && (hasHabits || hasSetupAction) ? (
          <View className="gap-8">
            {headline === null ? null : (
              <Text variant="caption" tone="secondary">
                {t(headline.key, { minutes: headline.minutes })}
              </Text>
            )}
            {setupActions.actions.map((action) => (
              <PathSetupActionCard
                key={action.id}
                action={action}
                isPending={setupActions.isPending}
                onComplete={(current) => {
                  setupActions.complete(current);
                  showToast({ message: t('path.setup.completed') });
                }}
                onDismiss={(current) => {
                  setupActions.dismiss(current);
                  showToast({ message: t('path.setup.dismissed') });
                }}
              />
            ))}
            {expectedTasks.length > 0 ? (
              <DayProgress done={done} total={expectedTasks.length} />
            ) : null}
            {showAllDone ? <AllDoneCard footer={<DayNoteField />} /> : null}
            <TaskGroupList
              tasks={shown}
              streaks={streaks}
              onToggle={handleToggle}
              onSkip={handleSkip}
              onOpenDetails={setDetailsTask}
            />
            {overflow.length > 0 && !showAll ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowAll(true);
                }}
                className={cn('min-h-12 items-center justify-center', pressClass)}
              >
                <Text variant="caption" tone="tertiary">
                  {t('today.showAll')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Screen>

      <Sheet
        visible={isDayMenuOpen}
        onClose={() => {
          setDayMenuOpen(false);
        }}
        title={formatFullDay(date, locale)}
        closeLabel={t('today.details.close')}
      >
        <Button
          label={t('rest.today.make')}
          variant="secondary"
          onPress={() => {
            void handleMakeRestDay();
          }}
        />
      </Sheet>

      <PathTransferSheet
        check={transferCheck}
        canDownshift={transferHabit !== null}
        isPending={isSubmittingTransfer}
        isQueued={isTransferQueued}
        onClose={dismissTransferCheck}
        onSubmit={(input) => {
          if (transferCheck === null) return;

          trackEvent('path_transfer_answered', {
            response: input.response,
            protocol_type: transferCheck.path.pathKind,
          });
          submitTransfer(input);

          if (input.decision === 'downshift' && transferHabit !== null) {
            router.push({
              pathname: '/habit/[id]',
              params: { id: transferHabit.id, transferDownshift: '1' },
            });
          }
        }}
      />

      <PathEndSheet
        path={completion?.path ?? null}
        reason="completed"
        isPending={isEndingPath}
        onClose={dismissCompletion}
        onDecide={handlePathCompletion}
        onWriteLetter={writeLetter}
      />

      <TaskDetailsSheet
        task={openTask}
        streak={openTask === null ? undefined : streaks.get(openTask.habit.id)}
        locale={locale}
        onClose={() => {
          setDetailsTask(null);
        }}
        onSaveNote={setNote}
        onOpenFriction={setFrictionTask}
      />

      <FrictionReasonSheet
        task={frictionTask}
        selectedReason={
          frictionTask === null
            ? null
            : friction.reasonFor(frictionTask.habit.id, frictionTask.date)
        }
        isOffline={!isOnline}
        isQueued={friction.isQueued}
        hasError={friction.error !== null}
        onClose={() => {
          setFrictionTask(null);
        }}
        onSelect={(reason) => {
          if (frictionTask === null) return;
          friction.saveReason(frictionTask.habit.id, frictionTask.date, reason);
          setFrictionTask(null);
        }}
        onRemove={() => {
          if (frictionTask === null) return;
          const removed = friction.archiveReason(
            frictionTask.habit.id,
            frictionTask.date,
          );
          setFrictionTask(null);
          if (removed === null) return;
          showToast({
            message: t('friction.removed'),
            action: {
              label: t('common.undo'),
              onPress: () => {
                friction.restoreReason(removed);
              },
            },
          });
        }}
      />

      <FrictionEnvironmentSheet
        suggestion={environmentSuggestion}
        habitTitle={environmentHabit?.title ?? null}
        isPending={friction.isPending}
        onClose={() => {
          setEnvironmentSuggestion(null);
        }}
        onPrepared={() => {
          if (environmentSuggestion === null) return;
          friction.respond(environmentSuggestion, 'acted');
          setEnvironmentSuggestion(null);
          showToast({ message: t('friction.prepare.saved') });
        }}
      />
    </>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
