import {
  DEFAULT_HABIT_FORM,
  type HabitFormValues,
} from '@/features/habits/model/habit-form';
import type { HabitTemplate } from '@/features/templates/model/template';

/**
 * Szablon → wypełniony formularz.
 *
 * Szablon jest punktem wyjścia, nie gotowcem: użytkownik dostaje wartości
 * i może je zmienić przed zapisem. Harmonogram zostaje domyślny (codziennie),
 * bo katalog go nie definiuje.
 */
export function toFormValuesFromTemplate(template: HabitTemplate): HabitFormValues {
  return {
    ...DEFAULT_HABIT_FORM,
    title: template.title,
    description: template.description ?? '',
    icon: template.icon ?? DEFAULT_HABIT_FORM.icon,
    unit: template.unit,
    category: template.category ?? '',
    startValue: String(template.startValue),
    incrementValue: String(template.incrementValue),
    targetValue: template.targetValue === null ? '' : String(template.targetValue),
    progressionMode: template.progressionMode,
    sourceBook: template.sourceBook ?? '',
    sourceAuthor: template.sourceAuthor ?? '',
  };
}
