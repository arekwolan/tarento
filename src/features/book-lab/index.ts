export { useBookLab } from '@/features/book-lab/hooks/use-book-lab';
export type { UseBookLabResult } from '@/features/book-lab/hooks/use-book-lab';

export {
  clearBookLabLocalDraft,
  loadBookLabLocalDraft,
  saveBookLabLocalDraft,
} from '@/features/book-lab/api/storage';

export {
  buildBookLabDiff,
  canSaveBookLabDraft,
  selectedBookLabDraft,
} from '@/features/book-lab/model/diff';
export type { BookLabDiffKind, BookLabStageDiff } from '@/features/book-lab/model/diff';

export { createBookLabRequestId } from '@/features/book-lab/model/request-id';
export {
  BOOK_LAB_LIMITS,
  EMPTY_BOOK_LAB_FORM,
  bookLabDraftSchema,
  bookLabFormSchema,
  bookLabStageSchema,
} from '@/features/book-lab/model/schemas';

export { BookLabScreen } from '@/features/book-lab/components/book-lab-screen';
export type {
  BookLabCategory,
  BookLabContext,
  BookLabDraft,
  BookLabFormValues,
  BookLabResponse,
  BookLabScheduleType,
  BookLabStage,
  BookLabTimeOfDay,
  PersistedBookLab,
} from '@/features/book-lab/model/schemas';
