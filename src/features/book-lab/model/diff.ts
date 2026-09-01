import type {
  BookLabContext,
  BookLabDraft,
  BookLabStage,
} from '@/features/book-lab/model/schemas';

export type BookLabDiffKind = 'add' | 'replace' | 'does_not_fit';
export type BookLabStageDiff = {
  stage: BookLabStage;
  kind: BookLabDiffKind;
  bandCollision: boolean;
};

export function buildBookLabDiff(
  draft: BookLabDraft,
  context: BookLabContext,
  selectedOrdinals: readonly number[] = draft.stages.map((stage) => stage.ordinal),
): BookLabStageDiff[] {
  const selected = new Set(selectedOrdinals);

  return draft.stages.map((stage) => ({
    stage,
    kind:
      stage.dailyMinutes > context.safeMinutes
        ? 'does_not_fit'
        : !draft.stages.some(
              (candidate) =>
                selected.has(candidate.ordinal) && candidate.ordinal < stage.ordinal,
            )
          ? 'add'
          : 'replace',
    bandCollision: context.bands[stage.practice.timeOfDay].itemCount > 0,
  }));
}

export function selectedBookLabDraft(
  draft: BookLabDraft,
  selectedOrdinals: readonly number[],
): BookLabDraft {
  const selected = new Set(selectedOrdinals);
  return {
    ...draft,
    stages: draft.stages
      .filter((stage) => selected.has(stage.ordinal))
      .map((stage, index) => ({ ...stage, ordinal: index + 1 })),
  };
}

export function canSaveBookLabDraft(
  draft: BookLabDraft,
  context: BookLabContext,
): boolean {
  return (
    draft.stages.length >= 1 &&
    draft.stages.length <= 3 &&
    draft.stages.every((stage) => stage.dailyMinutes <= context.safeMinutes)
  );
}
