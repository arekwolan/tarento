import { z } from 'zod';

export const BOOK_LAB_LIMITS = {
  sourceTitle: 160,
  sourceAuthor: 120,
  desiredChange: 240,
  note: 500,
  locator: 80,
  minNotes: 3,
  maxNotes: 7,
  maxStages: 3,
} as const;

const required = (requiredKey: string, longKey: string, max: number) =>
  z.string().trim().min(1, requiredKey).max(max, longKey);

export const bookLabNoteSchema = z
  .object({
    content: required(
      'bookLab.validation.noteRequired',
      'bookLab.validation.noteLong',
      BOOK_LAB_LIMITS.note,
    ),
    sourceLocator: z
      .string()
      .trim()
      .max(BOOK_LAB_LIMITS.locator, 'bookLab.validation.locatorLong'),
  })
  .strict();

export const bookLabFormSchema = z
  .object({
    sourceTitle: required(
      'bookLab.validation.titleRequired',
      'bookLab.validation.titleLong',
      BOOK_LAB_LIMITS.sourceTitle,
    ),
    sourceAuthor: required(
      'bookLab.validation.authorRequired',
      'bookLab.validation.authorLong',
      BOOK_LAB_LIMITS.sourceAuthor,
    ),
    desiredChange: required(
      'bookLab.validation.changeRequired',
      'bookLab.validation.changeLong',
      BOOK_LAB_LIMITS.desiredChange,
    ),
    notes: z
      .array(bookLabNoteSchema)
      .min(BOOK_LAB_LIMITS.minNotes, 'bookLab.validation.notesMin')
      .max(BOOK_LAB_LIMITS.maxNotes, 'bookLab.validation.notesMax'),
  })
  .strict();

export type BookLabFormValues = z.infer<typeof bookLabFormSchema>;

const timeOfDay = z.enum(['morning', 'afternoon', 'evening']);
const category = z.enum(['mindfulness', 'health', 'focus', 'learning', 'relationships']);
const scheduleType = z.enum(['daily', 'weekdays', 'custom']);
const noteOrdinals = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export const bookLabStageSchema = z
  .object({
    ordinal: z.number().int().min(1).max(3),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    dailyMinutes: z.number().int().min(1).max(45),
    practice: z
      .object({
        title: z.string().trim().min(1).max(80),
        why: z.string().trim().min(1).max(240),
        how: z.string().trim().min(1).max(240),
        whenHard: z.string().trim().min(1).max(180),
        scheduleType,
        scheduleDays: z.array(z.number().int().min(0).max(6)).max(7),
        timeOfDay,
        category,
        noteOrdinals,
      })
      .strict()
      .superRefine((practice, context) => {
        if (practice.scheduleType === 'custom' && practice.scheduleDays.length === 0) {
          context.addIssue({ code: 'custom', path: ['scheduleDays'], message: 'custom' });
        }
        if (practice.scheduleType !== 'custom' && practice.scheduleDays.length > 0) {
          context.addIssue({ code: 'custom', path: ['scheduleDays'], message: 'preset' });
        }
      }),
    environmentSetup: z
      .object({ text: z.string().trim().min(1).max(240), noteOrdinals })
      .strict()
      .nullable(),
    transition: z
      .object({
        criterion: z.string().trim().min(1).max(240),
        minDays: z.number().int().min(1).max(30),
        maxDays: z.number().int().min(1).max(60),
        completionThreshold: z.number().min(0).max(1),
        noteOrdinals,
      })
      .strict()
      .refine((value) => value.maxDays >= value.minDays),
  })
  .strict();

export const bookLabDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(240),
    stages: z.array(bookLabStageSchema).min(1).max(BOOK_LAB_LIMITS.maxStages),
  })
  .strict()
  .superRefine((draft, context) => {
    draft.stages.forEach((stage, index) => {
      if (stage.ordinal !== index + 1) {
        context.addIssue({ code: 'custom', path: ['stages', index, 'ordinal'] });
      }
    });
  });

export type BookLabDraft = z.infer<typeof bookLabDraftSchema>;
export type BookLabStage = z.infer<typeof bookLabStageSchema>;
export type BookLabTimeOfDay = z.infer<typeof timeOfDay>;
export type BookLabCategory = z.infer<typeof category>;
export type BookLabScheduleType = z.infer<typeof scheduleType>;

const bandSchema = z
  .object({ itemCount: z.number().int().min(0), usedMinutes: z.number().int().min(0) })
  .strict();

export const bookLabContextSchema = z
  .object({
    allocatedMinutes: z.number().int().min(0),
    usedMinutes: z.number().int().min(0),
    freeMinutes: z.number().int().min(0),
    safeMinutes: z.number().int().min(0),
    hasWindow: z.boolean(),
    bands: z
      .object({ morning: bandSchema, afternoon: bandSchema, evening: bandSchema })
      .strict(),
    habits: z.array(
      z
        .object({
          category: category.nullable(),
          minutes: z.number().int().min(0),
          timeOfDay: timeOfDay.nullable(),
        })
        .strict(),
    ),
    activePath: z
      .object({ exists: z.boolean(), stageMinutes: z.number().min(0) })
      .strict(),
  })
  .strict();

export type BookLabContext = z.infer<typeof bookLabContextSchema>;

export const bookLabResponseSchema = z
  .object({
    project_id: z.string().uuid().nullable(),
    path_id: z.string().uuid().nullable(),
    status: z.enum(['ok', 'out_of_scope', 'unsafe', 'insufficient_budget']),
    draft: bookLabDraftSchema.nullable(),
    context: bookLabContextSchema,
    remaining: z.number().int().min(0).nullable(),
  })
  .strict()
  .superRefine((response, context) => {
    if (
      response.status === 'ok' &&
      (response.project_id === null || response.draft === null)
    ) {
      context.addIssue({ code: 'custom', path: ['draft'] });
    }
    if (response.status !== 'ok' && response.draft !== null) {
      context.addIssue({ code: 'custom', path: ['draft'] });
    }
    if (
      response.status === 'insufficient_budget' &&
      (response.project_id !== null || response.path_id !== null)
    ) {
      context.addIssue({ code: 'custom', path: ['project_id'] });
    }
  });

export type BookLabResponse = z.infer<typeof bookLabResponseSchema>;

export const persistedBookLabSchema = z
  .object({
    requestId: z.string().uuid(),
    form: z
      .object({
        sourceTitle: z.string().max(BOOK_LAB_LIMITS.sourceTitle),
        sourceAuthor: z.string().max(BOOK_LAB_LIMITS.sourceAuthor),
        desiredChange: z.string().max(BOOK_LAB_LIMITS.desiredChange),
        notes: z
          .array(
            z
              .object({
                content: z.string().max(BOOK_LAB_LIMITS.note),
                sourceLocator: z.string().max(BOOK_LAB_LIMITS.locator),
              })
              .strict(),
          )
          .min(BOOK_LAB_LIMITS.minNotes)
          .max(BOOK_LAB_LIMITS.maxNotes),
      })
      .strict(),
  })
  .strict();

export type PersistedBookLab = z.infer<typeof persistedBookLabSchema>;

export const EMPTY_BOOK_LAB_FORM: BookLabFormValues = {
  sourceTitle: '',
  sourceAuthor: '',
  desiredChange: '',
  notes: [
    { content: '', sourceLocator: '' },
    { content: '', sourceLocator: '' },
    { content: '', sourceLocator: '' },
  ],
};
