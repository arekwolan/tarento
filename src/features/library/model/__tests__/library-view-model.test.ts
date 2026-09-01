import {
  buildLibraryViewModel,
  type BuildLibraryViewModelInput,
} from '@/features/library/model/library-view-model';
import type { PathContinue } from '@/features/paths';

const BASE: BuildLibraryViewModelInput = {
  isOnline: true,
  continuation: null,
  hasActiveEnrollment: false,
  isPrimaryLoading: false,
  hasPrimaryError: false,
  templateCount: 2,
  isTemplatesLoading: false,
  hasTemplatesError: false,
  reflectionCount: 1,
  isReflectionLoading: false,
  hasReflectionError: false,
  completedCount: 0,
  isCompletedLoading: false,
  hasCompletedError: false,
};

const CONTINUATION: PathContinue = {
  pathId: 'path-id',
  slug: 'path',
  title: 'Path',
  stage: {
    id: 'stage-id',
    pathId: 'path-id',
    ordinal: 2,
    name: 'Stage',
    description: 'Description',
    dailyMinutesP50: 5,
    minDays: 7,
    maxDays: 14,
    completionThreshold: 0.6,
    environmentSetup: null,
    environmentSetupNoteOrdinals: null,
    transitionCriterion: null,
    transitionNoteOrdinals: null,
  },
  totalStages: 3,
};

it('bez aktywnej ścieżki zaczyna od sekcji Zacznij', () => {
  expect(buildLibraryViewModel(BASE).primary).toEqual({ kind: 'start' });
});

it('aktywna ścieżka przejmuje najwyższą pozycję', () => {
  expect(
    buildLibraryViewModel({
      ...BASE,
      continuation: CONTINUATION,
      hasActiveEnrollment: true,
    }).primary,
  ).toEqual({ kind: 'continue', continuation: CONTINUATION });
});

it('zakończona historia jest obecna i domyślnie zwinięta', () => {
  const model = buildLibraryViewModel({ ...BASE, completedCount: 1 });

  expect(model.completed.state).toBe('content');
  expect(model.completedInitiallyExpanded).toBe(false);
});

it('offline pokazuje dane z cache zamiast błędu odświeżenia', () => {
  const model = buildLibraryViewModel({
    ...BASE,
    isOnline: false,
    hasTemplatesError: true,
    hasReflectionError: true,
    hasCompletedError: true,
    completedCount: 1,
  });

  expect(model.offline).toBe(true);
  expect(model.templates).toEqual({ state: 'content', refreshFailed: false });
  expect(model.reflection).toEqual({ state: 'content', refreshFailed: false });
  expect(model.completed).toEqual({ state: 'content', refreshFailed: false });
});

it('błąd jednej sekcji nie zasłania pozostałych', () => {
  const model = buildLibraryViewModel({
    ...BASE,
    templateCount: 0,
    hasTemplatesError: true,
  });

  expect(model.templates.state).toBe('error');
  expect(model.reflection.state).toBe('content');
  expect(model.primary.kind).toBe('start');
});
