import type { Habit } from '@/features/habits/model/habit';
import {
  addDays,
  computeTargetForDate,
  hashString,
  isScheduledOn,
  zonedDateTimeToInstant,
  type IsoDate,
} from '@/lib/date';

/**
 * iOS trzyma najwyżej 64 oczekujące powiadomienia lokalne. Planujemy
 * jednorazowe wyzwalacze zamiast powtarzalnych — tylko tak da się wyciszyć
 * konkretny dzień i wpisać w treść aktualny cel — więc horyzont musi się
 * skalować z liczbą nawyków.
 */
export const MAX_PENDING_NOTIFICATIONS = 56;
export const MAX_HORIZON_DAYS = 14;

export type PlannedReminder = {
  /**
   * Klucz łączy nawyk, moment i skrót treści. Zmiana czegokolwiek z tych
   * trzech daje inny klucz, więc porównanie z zaplanowanymi wystarcza,
   * żeby wiedzieć, co przeplanować.
   */
  key: string;
  habitId: string;
  date: IsoDate;
  title: string;
  body: string;
  fireAt: Date;
};

export type ReminderContent = {
  /** Gotowy tytuł, np. "Medytacja — 3 min". */
  title: string;
  /** Gotowa treść pod tytułem. */
  body: string;
};

export type BuildPlanInput = {
  habits: readonly Habit[];
  /** habitId → liczba wykonań sprzed dzisiaj, do wyliczenia celu. */
  completedCounts: ReadonlyMap<string, number>;
  /** Nawyki już odhaczone lub pominięte dzisiaj — dla nich milczymy. */
  settledToday: ReadonlySet<string>;
  today: IsoDate;
  timeZone: string;
  /** Teraz — powiadomienia z przeszłości nie mają sensu. */
  now: Date;
  /**
   * Czy w tym dniu milczymy. Dzień pusty nie dostaje przypomnień — cisza
   * jest częścią tej funkcji, a nie jej awarią.
   */
  isRestDay?: (date: IsoDate) => boolean;
  /** Buduje treść dla konkretnego nawyku i celu. */
  content: (habit: Habit, target: number) => ReminderContent;
};

function horizonDays(habitCount: number): number {
  if (habitCount === 0) return 0;

  return Math.max(
    1,
    Math.min(MAX_HORIZON_DAYS, Math.floor(MAX_PENDING_NOTIFICATIONS / habitCount)),
  );
}

/**
 * Lista powiadomień, które powinny być zaplanowane.
 *
 * Czysta funkcja — cała logika "co i kiedy" da się sprawdzić bez systemu
 * operacyjnego.
 */
export function buildReminderPlan(input: BuildPlanInput): PlannedReminder[] {
  const withReminder = input.habits.filter(
    (habit) => habit.archivedAt === null && habit.reminderTime !== null,
  );

  const horizon = horizonDays(withReminder.length);
  const plan: PlannedReminder[] = [];

  for (const habit of withReminder) {
    const time = (habit.reminderTime ?? '').slice(0, 5);

    for (let offset = 0; offset < horizon; offset += 1) {
      const date = addDays(input.today, offset);
      if (!isScheduledOn(habit, date)) continue;
      if (input.isRestDay?.(date) === true) continue;

      // Dzisiejszy nawyk z podjętą już decyzją nie potrzebuje przypomnienia.
      if (date === input.today && input.settledToday.has(habit.id)) continue;

      const fireAt = zonedDateTimeToInstant(date, time, input.timeZone);
      if (fireAt === null || fireAt.getTime() <= input.now.getTime()) continue;

      const target = computeTargetForDate(
        habit,
        date,
        input.completedCounts.get(habit.id) ?? 0,
      );
      const { title, body } = input.content(habit, target);

      plan.push({
        key: `${habit.id}|${date}|${time}|${hashString(`${title} ${body}`)}`,
        habitId: habit.id,
        date,
        title,
        body,
        fireAt,
      });
    }
  }

  return plan.sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime());
}

export type ScheduledReminder = { identifier: string; key: string };

export type ReminderDiff = {
  /** Identyfikatory do skasowania: nieaktualne albo już nieoczekiwane. */
  toCancel: string[];
  /** Powiadomienia, których jeszcze nie ma w systemie. */
  toSchedule: PlannedReminder[];
};

/**
 * Uzgodnienie stanu: co skasować, co dołożyć.
 *
 * Nie kasujemy wszystkiego i nie planujemy od zera, bo przy każdym starcie
 * aplikacji oznaczałoby to kilkadziesiąt wywołań systemowych — i chwilę,
 * w której użytkownik nie ma zaplanowanego nic.
 */
export function diffReminders(
  expected: readonly PlannedReminder[],
  scheduled: readonly ScheduledReminder[],
): ReminderDiff {
  const expectedKeys = new Set(expected.map((reminder) => reminder.key));
  const scheduledKeys = new Set(scheduled.map((reminder) => reminder.key));

  return {
    toCancel: scheduled
      .filter((reminder) => !expectedKeys.has(reminder.key))
      .map((reminder) => reminder.identifier),
    toSchedule: expected.filter((reminder) => !scheduledKeys.has(reminder.key)),
  };
}
