import type { PathContinue } from '@/features/paths';

export type LibraryDataState = 'loading' | 'content' | 'empty' | 'error';

export type LibraryDataSection = {
  state: LibraryDataState;
  /** Nie blokuje danych z cache'u; sekcja może je pokazać razem z retry. */
  refreshFailed: boolean;
};

export type LibraryPrimarySection =
  | { kind: 'loading' }
  | { kind: 'continue'; continuation: PathContinue }
  | { kind: 'start' }
  | { kind: 'error' }
  | { kind: 'offline_unavailable' };

export type LibraryViewModel = {
  offline: boolean;
  primary: LibraryPrimarySection;
  templates: LibraryDataSection;
  reflection: LibraryDataSection;
  completed: LibraryDataSection;
  completedInitiallyExpanded: false;
};

export type BuildLibraryViewModelInput = {
  isOnline: boolean;
  continuation: PathContinue | null;
  hasActiveEnrollment: boolean;
  isPrimaryLoading: boolean;
  hasPrimaryError: boolean;
  templateCount: number;
  isTemplatesLoading: boolean;
  hasTemplatesError: boolean;
  reflectionCount: number;
  isReflectionLoading: boolean;
  hasReflectionError: boolean;
  completedCount: number;
  isCompletedLoading: boolean;
  hasCompletedError: boolean;
};

function dataSection(
  count: number,
  isLoading: boolean,
  hasError: boolean,
  isOnline: boolean,
): LibraryDataSection {
  if (count > 0) {
    return { state: 'content', refreshFailed: isOnline && hasError };
  }
  if (!isOnline) return { state: 'empty', refreshFailed: false };
  if (isLoading) return { state: 'loading', refreshFailed: false };
  if (hasError) return { state: 'error', refreshFailed: false };
  return { state: 'empty', refreshFailed: false };
}

/** Czysta hierarchia Biblioteki; komponenty tylko renderują jej wynik. */
export function buildLibraryViewModel(
  input: BuildLibraryViewModelInput,
): LibraryViewModel {
  let primary: LibraryPrimarySection;
  if (input.continuation !== null) {
    primary = { kind: 'continue', continuation: input.continuation };
  } else if (input.hasActiveEnrollment) {
    primary = input.isOnline
      ? input.isPrimaryLoading
        ? { kind: 'loading' }
        : { kind: 'error' }
      : { kind: 'offline_unavailable' };
  } else if (input.isOnline && input.isPrimaryLoading) {
    primary = { kind: 'loading' };
  } else if (input.isOnline && input.hasPrimaryError) {
    primary = { kind: 'error' };
  } else {
    primary = { kind: 'start' };
  }

  return {
    offline: !input.isOnline,
    primary,
    templates: dataSection(
      input.templateCount,
      input.isTemplatesLoading,
      input.hasTemplatesError,
      input.isOnline,
    ),
    reflection: dataSection(
      input.reflectionCount,
      input.isReflectionLoading,
      input.hasReflectionError,
      input.isOnline,
    ),
    completed: dataSection(
      input.completedCount,
      input.isCompletedLoading,
      input.hasCompletedError,
      input.isOnline,
    ),
    completedInitiallyExpanded: false,
  };
}
