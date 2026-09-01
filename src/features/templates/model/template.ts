import { z } from 'zod';

import type { Habit } from '@/features/habits/model/habit';

export type TemplateCategory =
  'mindfulness' | 'health' | 'focus' | 'learning' | 'relationships';

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'focus',
  'mindfulness',
  'health',
  'learning',
  'relationships',
];

export type HabitTemplate = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  unit: Habit['unit'];
  startValue: number;
  incrementValue: number;
  targetValue: number | null;
  progressionMode: Habit['progressionMode'];
  sourceBook: string | null;
  sourceAuthor: string | null;
  category: TemplateCategory | null;
  language: string;
  sortOrder: number;
};

export const habitTemplateRowSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    unit: z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']),
    start_value: z.number(),
    increment_value: z.number(),
    target_value: z.number().nullable(),
    progression_mode: z.enum(['completion', 'calendar']),
    source_book: z.string().nullable(),
    source_author: z.string().nullable(),
    category: z
      .enum(['mindfulness', 'health', 'focus', 'learning', 'relationships'])
      .nullable(),
    language: z.string(),
    sort_order: z.number().nullable(),
  })
  .transform((row): HabitTemplate => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    unit: row.unit,
    startValue: row.start_value,
    incrementValue: row.increment_value,
    targetValue: row.target_value,
    progressionMode: row.progression_mode,
    sourceBook: row.source_book,
    sourceAuthor: row.source_author,
    category: row.category,
    language: row.language,
    sortOrder: row.sort_order ?? 0,
  }));
