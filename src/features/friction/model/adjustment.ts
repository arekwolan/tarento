import { z } from 'zod';

import type { Habit, TimeOfDay } from '@/features/habits';
import { isValidTimeOfDay } from '@/lib/date';

export const frictionReminderSchema = z.object({
  reminderTime: z.string().refine(isValidTimeOfDay),
});
export type FrictionReminderValues = z.infer<typeof frictionReminderSchema>;

const DEFAULT_REMINDER: Record<TimeOfDay, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '19:00',
};

export function initialFrictionReminder(habit: Habit): string {
  if (habit.reminderTime !== null) return habit.reminderTime.slice(0, 5);
  return habit.timeOfDay === null ? '09:00' : DEFAULT_REMINDER[habit.timeOfDay];
}
