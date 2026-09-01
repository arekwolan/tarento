import {
  buildBookLabDiff,
  canSaveBookLabDraft,
  selectedBookLabDraft,
} from '@/features/book-lab/model/diff';
import { createBookLabRequestId } from '@/features/book-lab/model/request-id';
import {
  bookLabDraftSchema,
  bookLabFormSchema,
  type BookLabContext,
  type BookLabDraft,
} from '@/features/book-lab/model/schemas';

const context: BookLabContext = {
  allocatedMinutes: 30,
  usedMinutes: 10,
  freeMinutes: 20,
  safeMinutes: 12,
  hasWindow: true,
  bands: {
    morning: { itemCount: 1, usedMinutes: 5 },
    afternoon: { itemCount: 0, usedMinutes: 0 },
    evening: { itemCount: 0, usedMinutes: 0 },
  },
  habits: [],
  activePath: { exists: false, stageMinutes: 0 },
};

const draft: BookLabDraft = {
  title: 'Mały protokół',
  summary: 'Jedna praktyka zmieniana etapami.',
  stages: [1, 2, 3].map((ordinal) => ({
    ordinal,
    name: `Etap ${ordinal}`,
    description: 'Krótki autorski opis.',
    dailyMinutes: ordinal === 3 ? 13 : 5,
    practice: {
      title: `Praktyka ${ordinal}`,
      why: 'Wynika z notatki.',
      how: 'Wykonaj jeden mały krok.',
      whenHard: 'Wykonaj minutę.',
      scheduleType: 'daily' as const,
      scheduleDays: [],
      timeOfDay: ordinal === 1 ? ('morning' as const) : ('evening' as const),
      category: 'focus' as const,
      noteOrdinals: [ordinal],
    },
    environmentSetup: null,
    transition: {
      criterion: 'Przejdź po tygodniu regularności.',
      minDays: 7,
      maxDays: 14,
      completionThreshold: 0.6,
      noteOrdinals: [ordinal],
    },
  })),
};

describe('Laboratorium książki', () => {
  it('nie przyjmuje samego tytułu ani mniej niż trzech notatek', () => {
    expect(
      bookLabFormSchema.safeParse({
        sourceTitle: 'Tytuł',
        sourceAuthor: 'Autor',
        desiredChange: '',
        notes: [],
      }).success,
    ).toBe(false);
  });

  it('egzekwuje limit prywatnej notatki po stronie klienta', () => {
    expect(
      bookLabFormSchema.safeParse({
        sourceTitle: 'Tytuł',
        sourceAuthor: 'Autor',
        desiredChange: 'Chcę zamykać dzień jednym zdaniem.',
        notes: Array.from({ length: 3 }, () => ({
          content: 'x'.repeat(501),
          sourceLocator: '',
        })),
      }).success,
    ).toBe(false);
  });

  it('waliduje praktykę, trudny dzień i provenance notatek', () => {
    expect(
      bookLabDraftSchema.safeParse({ ...draft, stages: draft.stages.slice(0, 2) })
        .success,
    ).toBe(true);
  });

  it('buduje DODA/ZASTĄPI/NIE ZMIEŚCI SIĘ i kolizję pasma', () => {
    expect(buildBookLabDiff(draft, context).map((entry) => entry.kind)).toEqual([
      'add',
      'replace',
      'does_not_fit',
    ]);
    expect(buildBookLabDiff(draft, context)[0]?.bandCollision).toBe(true);
    expect(canSaveBookLabDraft(draft, context)).toBe(false);
  });

  it('odrzucenie etapu tworzy spójny ciąg przed zapisem', () => {
    const selected = selectedBookLabDraft(draft, [1, 3]);
    expect(selected.stages.map((stage) => stage.ordinal)).toEqual([1, 2]);
    expect(buildBookLabDiff(draft, context, [2, 3])[1]?.kind).toBe('add');
    expect(canSaveBookLabDraft(selected, { ...context, safeMinutes: 15 })).toBe(true);
  });

  it('tworzy UUID do idempotentnego requestu', () => {
    expect(createBookLabRequestId(() => 0.5)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
