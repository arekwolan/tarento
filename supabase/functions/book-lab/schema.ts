import { CATEGORIES, TIME_OF_DAY } from '../_shared/plan-item.ts';

export const BOOK_LAB_PROMPT_VERSION = 'book-lab-v1';
export const BOOK_LAB_MIN_NOTES = 3;
export const BOOK_LAB_MAX_NOTES = 7;
export const BOOK_LAB_MAX_STAGES = 3;

const NOTE_REFS_SCHEMA = {
  type: 'ARRAY',
  minItems: 1,
  maxItems: BOOK_LAB_MAX_NOTES,
  items: { type: 'INTEGER', minimum: 1, maximum: BOOK_LAB_MAX_NOTES },
} as const;

export const BOOK_LAB_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['ok', 'out_of_scope', 'unsafe'] },
    title: { type: 'STRING', maxLength: 120 },
    summary: { type: 'STRING', maxLength: 240 },
    stages: {
      type: 'ARRAY',
      maxItems: BOOK_LAB_MAX_STAGES,
      items: {
        type: 'OBJECT',
        properties: {
          ordinal: { type: 'INTEGER', minimum: 1, maximum: BOOK_LAB_MAX_STAGES },
          name: { type: 'STRING', maxLength: 80 },
          description: { type: 'STRING', maxLength: 240 },
          dailyMinutes: { type: 'INTEGER', minimum: 1, maximum: 45 },
          practice: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', maxLength: 80 },
              why: { type: 'STRING', maxLength: 240 },
              how: { type: 'STRING', maxLength: 240 },
              whenHard: { type: 'STRING', maxLength: 180 },
              scheduleType: { type: 'STRING', enum: ['daily', 'weekdays', 'custom'] },
              scheduleDays: {
                type: 'ARRAY',
                maxItems: 7,
                items: { type: 'INTEGER', minimum: 0, maximum: 6 },
              },
              timeOfDay: { type: 'STRING', enum: TIME_OF_DAY },
              category: { type: 'STRING', enum: CATEGORIES },
              noteOrdinals: NOTE_REFS_SCHEMA,
            },
            required: [
              'title',
              'why',
              'how',
              'whenHard',
              'scheduleType',
              'scheduleDays',
              'timeOfDay',
              'category',
              'noteOrdinals',
            ],
          },
          environmentSetup: {
            type: 'OBJECT',
            nullable: true,
            properties: {
              text: { type: 'STRING', maxLength: 240 },
              noteOrdinals: NOTE_REFS_SCHEMA,
            },
            required: ['text', 'noteOrdinals'],
          },
          transition: {
            type: 'OBJECT',
            properties: {
              criterion: { type: 'STRING', maxLength: 240 },
              minDays: { type: 'INTEGER', minimum: 1, maximum: 30 },
              maxDays: { type: 'INTEGER', minimum: 1, maximum: 60 },
              completionThreshold: { type: 'NUMBER', minimum: 0, maximum: 1 },
              noteOrdinals: NOTE_REFS_SCHEMA,
            },
            required: [
              'criterion',
              'minDays',
              'maxDays',
              'completionThreshold',
              'noteOrdinals',
            ],
          },
        },
        required: [
          'ordinal',
          'name',
          'description',
          'dailyMinutes',
          'practice',
          'environmentSetup',
          'transition',
        ],
      },
    },
  },
  required: ['status', 'title', 'summary', 'stages'],
  propertyOrdering: ['status', 'title', 'summary', 'stages'],
} as const;
