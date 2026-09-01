import {
  frictionReminderSchema,
  initialFrictionReminder,
} from '@/features/friction/model/adjustment';
import type { Habit } from '@/features/habits';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    title: 'Czytanie',
    description: null,
    icon: null,
    color: null,
    unit: 'minutes',
    category: null,
    startValue: 5,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    reminderTime: null,
    timeOfDay: null,
    sourceBook: null,
    sourceAuthor: null,
    sortOrder: 0,
    sourcePathId: null,
    sourceStageId: null,
    retiredAt: null,
    startedOn: '2026-08-01',
    archivedAt: null,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

describe('preview przypomnienia', () => {
  it('nie zapisuje niczego na podstawie samego powodu i proponuje tylko wartość formularza', () => {
    expect(initialFrictionReminder(habit({ timeOfDay: 'evening' }))).toBe('19:00');
    expect(habit({ timeOfDay: 'evening' }).reminderTime).toBeNull();
  });

  it('zachowuje istniejącą godzinę w preview', () => {
    expect(initialFrictionReminder(habit({ reminderTime: '07:15:00' }))).toBe('07:15');
  });

  it('waliduje jawne potwierdzenie godziny', () => {
    expect(frictionReminderSchema.safeParse({ reminderTime: '08:00' }).success).toBe(
      true,
    );
    expect(frictionReminderSchema.safeParse({ reminderTime: '25:00' }).success).toBe(
      false,
    );
  });
});
