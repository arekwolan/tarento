import { scheduledCompletion } from '@/features/habits/model/downshift';
import type { Habit, HabitLog } from '@/features/habits/model/habit';
import {
  isRetirementCandidate,
  streakEndDay,
  type RetirementContext,
} from '@/features/habits/model/retirement';
import { addDays, type IsoDate } from '@/lib/date';

/**
 * Emerytura ma paść raz i tylko wtedy, gdy nawyk naprawdę się wydarzył.
 * Każdy warunek dostaje tu test odrzucający — inaczej „raz na dziewięćdziesiąt
 * dni" byłoby komentarzem, a nie regułą.
 */

const TODAY: IsoDate = '2026-06-15';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    title: 'Czytanie',
    description: null,
    icon: null,
    color: null,
    unit: 'pages',
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
    startedOn: addDays(TODAY, -90),
    archivedAt: null,
    createdAt: '2026-03-17T08:00:00Z',
    updatedAt: '2026-03-17T08:00:00Z',
    ...overrides,
  };
}

/** Wpisy `done` w `count` kolejnych dniach przed dzisiaj. */
function doneLogs(count: number): HabitLog[] {
  return Array.from({ length: count }, (_, index) => addDays(TODAY, -(index + 1))).map(
    (logDate, index) => ({
      id: `log-${index}`,
      habitId: 'habit-1',
      userId: 'user-1',
      logDate,
      status: 'done' as const,
      targetValue: 5,
      valueCompleted: 5,
      note: null,
      completedAt: `${logDate}T09:00:00Z`,
    }),
  );
}

const CONTEXT: RetirementContext = { lastOffer: null };

describe('isRetirementCandidate', () => {
  it('proponuje przy wykonaniu 0.85 i odmawia poniżej progu', () => {
    // Sześćdziesiąt dni próbki: 51/60 to dokładnie 0.85.
    expect(isRetirementCandidate(habit(), doneLogs(51), TODAY, CONTEXT)).toBe(true);
    expect(isRetirementCandidate(habit(), doneLogs(50), TODAY, CONTEXT)).toBe(false);
  });

  it('trzyma próg dokładnie na 0.85: 0.84 nie wystarcza', () => {
    const long = habit({ startedOn: addDays(TODAY, -400) });

    expect(scheduledCompletion(long, doneLogs(84), TODAY, 100)?.ratio).toBeCloseTo(
      0.84,
      5,
    );
    expect(scheduledCompletion(long, doneLogs(85), TODAY, 100)?.ratio).toBeCloseTo(
      0.85,
      5,
    );
  });

  it('nawyk pięćdziesięciodziewięciodniowy nie kwalifikuje się nigdy', () => {
    const young = habit({ startedOn: addDays(TODAY, -59) });

    expect(isRetirementCandidate(young, doneLogs(59), TODAY, CONTEXT)).toBe(false);
  });

  it('praktyka ścieżki nie kwalifikuje się nigdy', () => {
    const practice = habit({ sourcePathId: 'path-1' });

    expect(isRetirementCandidate(practice, doneLogs(60), TODAY, CONTEXT)).toBe(false);
  });

  it('nie proponuje nawykowi zarchiwizowanemu ani już zdjętemu z listy', () => {
    const logs = doneLogs(60);

    expect(
      isRetirementCandidate(
        habit({ archivedAt: '2026-06-01T10:00:00Z' }),
        logs,
        TODAY,
        CONTEXT,
      ),
    ).toBe(false);
    expect(
      isRetirementCandidate(
        habit({ retiredAt: '2026-06-01T10:00:00Z' }),
        logs,
        TODAY,
        CONTEXT,
      ),
    ).toBe(false);
  });

  it('dzień pusty nie liczy się jako zaplanowany', () => {
    // Nawyk dokładnie sześćdziesięciodniowy: bez dni pustych próbka domyka się
    // co do dnia, z jednym dniem pustym nie ma już z czego jej zebrać.
    const exact = habit({ startedOn: addDays(TODAY, -60) });
    const isRestDay = (day: IsoDate) => day === addDays(TODAY, -5);

    expect(isRetirementCandidate(exact, doneLogs(60), TODAY, CONTEXT)).toBe(true);
    expect(
      isRetirementCandidate(exact, doneLogs(60), TODAY, { ...CONTEXT, isRestDay }),
    ).toBe(false);
  });

  it('nie powtarza propozycji przez dziewięćdziesiąt dni', () => {
    const logs = doneLogs(60);

    expect(
      isRetirementCandidate(habit(), logs, TODAY, {
        lastOffer: { on: addDays(TODAY, -89), decided: true },
      }),
    ).toBe(false);
    expect(
      isRetirementCandidate(habit(), logs, TODAY, {
        lastOffer: { on: addDays(TODAY, -90), decided: true },
      }),
    ).toBe(true);
  });

  it('propozycja z dzisiaj stoi, dopóki użytkownik się do niej nie odniesie', () => {
    const logs = doneLogs(60);

    expect(
      isRetirementCandidate(habit(), logs, TODAY, {
        lastOffer: { on: TODAY, decided: false },
      }),
    ).toBe(true);
    expect(
      isRetirementCandidate(habit(), logs, TODAY, {
        lastOffer: { on: TODAY, decided: true },
      }),
    ).toBe(false);
  });
});

describe('streakEndDay', () => {
  it('nawyk na liście liczy serię do dzisiaj', () => {
    expect(streakEndDay(habit(), TODAY)).toBe(TODAY);
  });

  it('nawyk zdjęty z listy ma serię zamrożoną w dniu zdjęcia', () => {
    const retired = habit({ retiredAt: `${addDays(TODAY, -7)}T20:00:00Z` });

    // Tydzień bez wpisów po zdjęciu nie wchodzi do rachunku, więc nie ma czego
    // zerwać. Ta sama granica siedzi w public.get_habit_streak.
    expect(streakEndDay(retired, TODAY)).toBe(addDays(TODAY, -7));
  });

  it('zdjęcie z dzisiaj nie cofa rachunku', () => {
    const retired = habit({ retiredAt: `${TODAY}T20:00:00Z` });

    expect(streakEndDay(retired, TODAY)).toBe(TODAY);
  });
});
