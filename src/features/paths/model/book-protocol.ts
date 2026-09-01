import { optionalPracticeIds } from '@/features/paths/model/fit';
import { scaledPractice, STEP_DOWN_FACTOR } from '@/features/paths/model/parameters';
import type { Path, PathPractice, PathStage } from '@/features/paths/model/schemas';
import { practicesForStage } from '@/features/paths/model/stage';

export type PathCatalogGroups<T> = {
  tarento: T[];
  books: T[];
};

/** Dzieli katalog wyłącznie wizualnie. Silnik i aktywny zapis pozostają wspólne. */
export function groupPathCatalog<T extends { path: Pick<Path, 'pathKind'> }>(
  entries: readonly T[],
): PathCatalogGroups<T> {
  return {
    tarento: entries.filter((entry) => entry.path.pathKind === 'tarento'),
    books: entries.filter((entry) => entry.path.pathKind === 'book_protocol'),
  };
}

export type BookProtocolStagePreview = {
  stage: PathStage;
  additions: PathPractice[];
  retirements: PathPractice[];
  dailyMinutes: number;
};

export type BookProtocolStartPreview = {
  stages: BookProtocolStagePreview[];
  startMinutes: number;
  peakMinutes: number;
  availableMinutes: number | null;
  remainingAtStart: number | null;
  remainingAtPeak: number | null;
};

function scaledMinutes(minutes: number, lite: boolean): number {
  if (!lite || minutes === 0) return minutes;
  return Math.max(Math.round(minutes * STEP_DOWN_FACTOR), 1);
}

/**
 * Pełny, deterministyczny diff protokołu przed startem.
 *
 * Pokazuje każdy etap, bo zamiana praktyki nastąpi dopiero później, ale jest
 * częścią decyzji podejmowanej teraz. Nie używa AI ani zegara.
 */
export function buildBookProtocolStartPreview(
  stages: readonly PathStage[],
  practices: readonly PathPractice[],
  skipPracticeIds: readonly string[],
  lite: boolean,
  availableMinutes: number | null,
): BookProtocolStartPreview {
  const orderedStages = [...stages].sort((left, right) => left.ordinal - right.ordinal);
  const skipped = new Set([
    ...skipPracticeIds,
    ...(lite ? optionalPracticeIds(practices) : []),
  ]);
  const selectedIds = new Set<string>();

  const stagePreviews = orderedStages.map((stage) => {
    const rawAdditions = practicesForStage(stage, practices, [...skipped]);
    const retirements = rawAdditions.flatMap((practice) => {
      if (practice.retiresPracticeId === null) return [];

      const retired = practices.find(
        (candidate) => candidate.id === practice.retiresPracticeId,
      );

      return retired !== undefined && selectedIds.has(retired.id) ? [retired] : [];
    });

    for (const practice of rawAdditions) selectedIds.add(practice.id);

    const additions = rawAdditions.map((practice) =>
      scaledPractice(practice, { lite, reentry: false }),
    );

    return {
      stage,
      additions,
      retirements,
      dailyMinutes: scaledMinutes(stage.dailyMinutesP50, lite),
    };
  });

  const stageMinutes = stagePreviews.map((preview) => preview.dailyMinutes);
  const startMinutes = stageMinutes[0] ?? 0;
  const peakMinutes = stageMinutes.length === 0 ? 0 : Math.max(...stageMinutes);

  return {
    stages: stagePreviews,
    startMinutes,
    peakMinutes,
    availableMinutes,
    remainingAtStart: availableMinutes === null ? null : availableMinutes - startMinutes,
    remainingAtPeak: availableMinutes === null ? null : availableMinutes - peakMinutes,
  };
}
