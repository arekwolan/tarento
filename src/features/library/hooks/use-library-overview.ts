import {
  buildLibraryViewModel,
  type LibraryViewModel,
} from '@/features/library/model/library-view-model';
import { useRetiredHabits } from '@/features/habits';
import { useDeliveredLetters } from '@/features/letters';
import {
  buildPathContinue,
  useActiveUserPath,
  useEndedPaths,
  usePathById,
} from '@/features/paths';
import { useDailyQuote, useFavoriteQuotes, useQuoteHistory } from '@/features/quotes';
import {
  useHabitTemplates,
  type HabitTemplate,
  type TemplateCategory,
} from '@/features/templates';
import { useIsOnline } from '@/lib/network';

export type UseLibraryOverviewResult = {
  view: LibraryViewModel;
  templates: HabitTemplate[];
  availableCategories: TemplateCategory[];
  quote: ReturnType<typeof useDailyQuote>['quote'];
  favorites: ReturnType<typeof useFavoriteQuotes>['quotes'];
  quoteHistory: ReturnType<typeof useQuoteHistory>['entries'];
  letters: ReturnType<typeof useDeliveredLetters>['letters'];
  retiredHabits: ReturnType<typeof useRetiredHabits>['habits'];
  endedPaths: ReturnType<typeof useEndedPaths>['endedPaths'];
  isRestoring: boolean;
  restore: (habitId: string) => void;
  retryPrimary: () => void;
  retryTemplates: () => void;
  retryReflection: () => void;
  retryCompleted: () => void;
};

/** Jedno miejsce orkiestracji źródeł danych Biblioteki. */
export function useLibraryOverview(
  category: TemplateCategory | null,
): UseLibraryOverviewResult {
  const isOnline = useIsOnline();
  const templates = useHabitTemplates(category);
  const dailyQuote = useDailyQuote();
  const favorites = useFavoriteQuotes();
  const quoteHistory = useQuoteHistory();
  const letters = useDeliveredLetters();
  const retired = useRetiredHabits();
  const active = useActiveUserPath();
  const activeDetail = usePathById(active.userPath?.pathId ?? null);
  const completed = useEndedPaths();

  const continuation = buildPathContinue(
    active.userPath,
    activeDetail.path,
    activeDetail.stages,
  );
  const reflectionCount =
    (dailyQuote.quote === null ? 0 : 1) +
    favorites.quotes.length +
    quoteHistory.entries.length +
    letters.letters.length +
    retired.habits.length;

  const view = buildLibraryViewModel({
    isOnline,
    continuation,
    hasActiveEnrollment: active.userPath !== null,
    isPrimaryLoading:
      active.isLoading || (active.userPath !== null && activeDetail.isLoading),
    hasPrimaryError: active.error !== null || activeDetail.error !== null,
    templateCount: templates.templates.length,
    isTemplatesLoading: templates.isLoading,
    hasTemplatesError: templates.error !== null,
    reflectionCount,
    isReflectionLoading:
      dailyQuote.isLoading ||
      favorites.isLoading ||
      quoteHistory.isLoading ||
      letters.isLoading ||
      retired.isLoading,
    hasReflectionError:
      dailyQuote.error !== null ||
      favorites.error !== null ||
      quoteHistory.error !== null ||
      letters.error !== null ||
      retired.error !== null,
    completedCount: completed.endedPaths.length,
    isCompletedLoading: completed.isLoading,
    hasCompletedError: completed.error !== null,
  });

  return {
    view,
    templates: templates.templates,
    availableCategories: templates.availableCategories,
    quote: dailyQuote.quote,
    favorites: favorites.quotes,
    quoteHistory: quoteHistory.entries,
    letters: letters.letters,
    retiredHabits: retired.habits,
    endedPaths: completed.endedPaths,
    isRestoring: retired.isRestoring,
    restore: retired.restore,
    retryPrimary: () => {
      active.refetch();
      activeDetail.refetch();
    },
    retryTemplates: templates.refetch,
    retryReflection: () => {
      dailyQuote.refetch();
      favorites.refetch();
      quoteHistory.refetch();
      letters.refetch();
      retired.refetch();
    },
    retryCompleted: completed.refetch,
  };
}
