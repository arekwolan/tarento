/**
 * Kształt pojedynczej propozycji: jeden nawyk z kompletem parametrów.
 *
 * Jeden typ dla planu dnia, podpowiedzi z intencji i propozycji zmniejszenia
 * nawyku. Trzy funkcje, jeden kontrakt — inaczej klient musiałby znać trzy
 * kształty i trzy razy je walidować.
 *
 * Odpowiednik po stronie klienta: src/features/ai-plan/model/plan.ts.
 * Zmiana tutaj wymaga zmiany tam.
 */

export const HABIT_UNITS = [
  'minutes',
  'seconds',
  'reps',
  'pages',
  'count',
  'none',
] as const;

export const TIME_OF_DAY = ['morning', 'afternoon', 'evening'] as const;

export const CATEGORIES = [
  'mindfulness',
  'health',
  'focus',
  'learning',
  'relationships',
] as const;

export type HabitUnit = (typeof HABIT_UNITS)[number];
export type TimeOfDay = (typeof TIME_OF_DAY)[number];
export type Category = (typeof CATEGORIES)[number];

export type PlanItem = {
  title: string;
  rationale: string;
  unit: HabitUnit;
  start_value: number;
  increment_value: number;
  target_value?: number;
  time_of_day: TimeOfDay;
  category: Category;
};

/**
 * Fragment schematu odpowiedzi wymuszanego na modelu.
 *
 * Gemini przyjmuje podzbiór OpenAPI i gwarantuje, że wyjście się w nim zmieści,
 * więc nie wyłuskujemy obiektu z prozy. To nie zwalnia z walidacji: schemat
 * pilnuje kształtu, walidator pilnuje sensu.
 */
export const PLAN_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Krótka nazwa nawyku po polsku.' },
    rationale: {
      type: 'STRING',
      description: 'Jedno zdanie po polsku: dlaczego akurat to i akurat tyle.',
    },
    unit: { type: 'STRING', enum: HABIT_UNITS },
    start_value: {
      type: 'NUMBER',
      description: 'Wartość na pierwszy dzień. Ma się zmieścić w dwóch minutach.',
    },
    increment_value: {
      type: 'NUMBER',
      description: 'Dzienny przyrost. Zero, jeśli nawyk nie ma rosnąć.',
    },
    target_value: {
      type: 'NUMBER',
      description: 'Docelowy sufit. Pomiń, jeśli nawyk ma rosnąć bez końca.',
    },
    time_of_day: { type: 'STRING', enum: TIME_OF_DAY },
    category: { type: 'STRING', enum: CATEGORIES },
  },
  required: [
    'title',
    'rationale',
    'unit',
    'start_value',
    'increment_value',
    'time_of_day',
    'category',
  ],
  propertyOrdering: [
    'title',
    'rationale',
    'unit',
    'start_value',
    'increment_value',
    'target_value',
    'time_of_day',
    'category',
  ],
} as const;

export function isHabitUnit(value: unknown): value is HabitUnit {
  return isOneOf(value, HABIT_UNITS);
}

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return isOneOf(value, TIME_OF_DAY);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Surowa pozycja od modelu → PlanItem albo null.
 *
 * Schemat odpowiedzi powinien to wykluczyć, ale nie budujemy na „powinien":
 * między schematem a tym kodem jest cała sieć i cudza usługa.
 */
export function toPlanItem(value: unknown): PlanItem | null {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '';
  const start = finiteNumber(raw.start_value);
  const increment = finiteNumber(raw.increment_value);
  const target = finiteNumber(raw.target_value);

  // Przez zmienne lokalne, nie wprost z `raw`: zawężanie predykatem działa
  // wtedy niezależnie od tego, jak kompilator traktuje sygnaturę indeksową.
  const unit = raw.unit;
  const timeOfDay = raw.time_of_day;
  const category = raw.category;

  if (title === '' || start === null || start < 0) return null;
  if (!isOneOf(unit, HABIT_UNITS)) return null;
  if (!isOneOf(timeOfDay, TIME_OF_DAY)) return null;
  if (!isOneOf(category, CATEGORIES)) return null;

  const item: PlanItem = {
    title,
    rationale:
      typeof raw.rationale === 'string' ? raw.rationale.trim().slice(0, 400) : '',
    unit,
    start_value: start,
    increment_value: increment === null || increment < 0 ? 0 : increment,
    time_of_day: timeOfDay,
    category,
  };

  return target !== null && target > 0 ? { ...item, target_value: target } : item;
}
