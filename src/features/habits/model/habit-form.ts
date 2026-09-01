import { z } from 'zod';

import type { HabitWriteInput } from '@/features/habits/api/habits-api';
import type { Habit } from '@/features/habits/model/habit';
import type { TranslationKey } from '@/i18n/keys';
import { isValidTimeOfDay } from '@/lib/date';

/**
 * Komunikaty walidacji formularza nawyku.
 *
 * `satisfies` pilnuje, żeby każdy istniał w pl.json — literówka w schemacie
 * jest błędem kompilacji, a nie surowym kluczem na ekranie.
 */
const FORM_MESSAGE_KEYS = [
  'habits.validation.titleRequired',
  'habits.validation.titleTooLong',
  'habits.validation.startValueInvalid',
  'habits.validation.incrementInvalid',
  'habits.validation.targetInvalid',
  'habits.validation.targetBelowStart',
  'habits.validation.scheduleDaysRequired',
  'habits.validation.reminderInvalid',
] as const satisfies readonly TranslationKey[];

type FormMessageKey = (typeof FORM_MESSAGE_KEYS)[number];

/** Przejście ze stringa z react-hook-form do typowanego klucza i18n. */
export function habitFormMessageKey(
  message: string | undefined,
): TranslationKey | undefined {
  if (message === undefined) return undefined;

  const known = FORM_MESSAGE_KEYS.find((key) => key === message);
  return known ?? 'auth.errors.unknown';
}

const MESSAGE = {
  titleRequired: 'habits.validation.titleRequired',
  titleTooLong: 'habits.validation.titleTooLong',
  startValueInvalid: 'habits.validation.startValueInvalid',
  incrementInvalid: 'habits.validation.incrementInvalid',
  targetInvalid: 'habits.validation.targetInvalid',
  targetBelowStart: 'habits.validation.targetBelowStart',
  scheduleDaysRequired: 'habits.validation.scheduleDaysRequired',
  reminderInvalid: 'habits.validation.reminderInvalid',
} as const satisfies Record<string, FormMessageKey>;

/** Liczba wpisana w polu tekstowym. Akceptuje przecinek jako separator. */
export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimalField(message: FormMessageKey, allowZero: boolean) {
  return z.string().refine(
    (value) => {
      const parsed = parseDecimal(value);
      if (parsed === null) return false;
      return allowZero ? parsed >= 0 : parsed > 0;
    },
    { message },
  );
}

/**
 * Pola liczbowe zostają stringami aż do zapisu.
 *
 * TextInput i tak oddaje tekst, a trzymanie w formularzu liczby zmuszałoby do
 * konwersji przy każdym naciśnięciu klawisza — łącznie z niedokończonymi
 * wpisami w rodzaju „1." czy pustym polem po skasowaniu.
 */
export const habitFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: MESSAGE.titleRequired })
      .max(80, { message: MESSAGE.titleTooLong }),
    description: z.string(),
    icon: z.string(),
    unit: z.enum(['minutes', 'seconds', 'reps', 'pages', 'count', 'none']),
    /** Puste = bez kategorii. */
    category: z.enum(['', 'mindfulness', 'health', 'focus', 'learning', 'relationships']),
    startValue: decimalField(MESSAGE.startValueInvalid, false),
    incrementValue: decimalField(MESSAGE.incrementInvalid, true),
    /** Puste = brak sufitu. */
    targetValue: z.string(),
    progressionMode: z.enum(['completion', 'calendar']),
    scheduleType: z.enum(['daily', 'weekdays', 'custom']),
    scheduleDays: z.array(z.number().int().min(0).max(6)),
    /** Puste = bez przypisanej pory dnia. */
    timeOfDay: z.enum(['', 'morning', 'afternoon', 'evening']),
    /** 'HH:MM' albo puste, gdy bez przypomnienia. */
    reminderTime: z.string(),
    sourceBook: z.string(),
    sourceAuthor: z.string(),
  })
  .refine(
    (values) => values.scheduleType !== 'custom' || values.scheduleDays.length > 0,
    {
      path: ['scheduleDays'],
      message: MESSAGE.scheduleDaysRequired,
    },
  )
  .refine(
    (values) =>
      values.targetValue.trim() === '' || (parseDecimal(values.targetValue) ?? 0) > 0,
    { path: ['targetValue'], message: MESSAGE.targetInvalid },
  )
  .refine(
    (values) => {
      const target = parseDecimal(values.targetValue);
      const start = parseDecimal(values.startValue);
      if (target === null || start === null) return true;
      return target >= start;
    },
    { path: ['targetValue'], message: MESSAGE.targetBelowStart },
  )
  .refine(
    (values) => values.reminderTime === '' || isValidTimeOfDay(values.reminderTime),
    {
      path: ['reminderTime'],
      message: MESSAGE.reminderInvalid,
    },
  );

export type HabitFormValues = z.infer<typeof habitFormSchema>;

export const DEFAULT_HABIT_FORM: HabitFormValues = {
  title: '',
  description: '',
  icon: 'leaf-outline',
  unit: 'none',
  category: '',
  startValue: '1',
  incrementValue: '0',
  targetValue: '',
  progressionMode: 'completion',
  scheduleType: 'daily',
  scheduleDays: [],
  timeOfDay: '',
  reminderTime: '',
  sourceBook: '',
  sourceAuthor: '',
};

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Formularz → kształt przyjmowany przez warstwę api. */
export function toHabitWriteInput(values: HabitFormValues): HabitWriteInput {
  return {
    title: values.title.trim(),
    description: orNull(values.description),
    icon: orNull(values.icon),
    unit: values.unit,
    category: values.category === '' ? null : values.category,
    startValue: parseDecimal(values.startValue) ?? 1,
    incrementValue: parseDecimal(values.incrementValue) ?? 0,
    targetValue: parseDecimal(values.targetValue),
    progressionMode: values.progressionMode,
    scheduleType: values.scheduleType,
    scheduleDays: values.scheduleType === 'custom' ? values.scheduleDays : null,
    reminderTime: values.reminderTime === '' ? null : `${values.reminderTime}:00`,
    timeOfDay: values.timeOfDay === '' ? null : values.timeOfDay,
    sourceBook: orNull(values.sourceBook),
    sourceAuthor: orNull(values.sourceAuthor),
  };
}

/** Istniejący nawyk → wartości formularza (edycja). */
export function toHabitFormValues(habit: Habit): HabitFormValues {
  return {
    title: habit.title,
    description: habit.description ?? '',
    icon: habit.icon ?? 'leaf-outline',
    unit: habit.unit,
    category: habit.category ?? '',
    startValue: String(habit.startValue),
    incrementValue: String(habit.incrementValue),
    targetValue: habit.targetValue === null ? '' : String(habit.targetValue),
    progressionMode: habit.progressionMode,
    scheduleType: habit.scheduleType,
    scheduleDays: habit.scheduleDays === null ? [] : [...habit.scheduleDays],
    timeOfDay: habit.timeOfDay ?? '',
    reminderTime: habit.reminderTime === null ? '' : habit.reminderTime.slice(0, 5),
    sourceBook: habit.sourceBook ?? '',
    sourceAuthor: habit.sourceAuthor ?? '',
  };
}
