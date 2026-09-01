import type { Habit, HabitLog } from '@/features/habits/model/habit';
import {
  deterministicDownshift,
  scheduledCompletion,
  shouldOfferDownshift,
  type DownshiftContext,
} from '@/features/habits/model/downshift';
import { addDays, type IsoDate } from '@/lib/date';

/**
 * Warunki propozycji zmniejszenia. Każdy z nich istnieje po to, żeby pytanie
 * padło raz i w momencie, w którym coś znaczy — dlatego każdy ma tu test
 * odrzucający, a nie tylko test szczęśliwej ścieżki.
 */

const TODAY: IsoDate = '2026-06-15';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    title: 'Medytacja',
    description: null,
    icon: null,
    color: null,
    unit: 'minutes',
    category: null,
    startValue: 20,
    incrementValue: 1,
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
    startedOn: addDays(TODAY, -60),
    archivedAt: null,
    createdAt: '2026-04-16T08:00:00Z',
    updatedAt: '2026-04-16T08:00:00Z',
    ...overrides,
  };
}

/** `done` w `count` z ostatnich `span` dni przed dzisiaj. */
function doneLogs(count: number, span: number, from: IsoDate = TODAY): HabitLog[] {
  return Array.from({ length: span }, (_, index) => addDays(from, -(index + 1)))
    .slice(0, count)
    .map((logDate, index) => ({
      id: `log-${index}`,
      habitId: 'habit-1',
      userId: 'user-1',
      logDate,
      status: 'done' as const,
      targetValue: 20,
      valueCompleted: 20,
      note: null,
      completedAt: `${logDate}T09:00:00Z`,
    }));
}

const CONTEXT: DownshiftContext = { lastOffer: null, reentryUntil: null };

describe('scheduledCompletion', () => {
  it('nie liczy dzisiaj — doba jeszcze trwa', () => {
    const logs: HabitLog[] = [
      {
        id: 'log-today',
        habitId: 'habit-1',
        userId: 'user-1',
        logDate: TODAY,
        status: 'done',
        targetValue: 20,
        valueCompleted: 20,
        note: null,
        completedAt: `${TODAY}T09:00:00Z`,
      },
    ];

    expect(scheduledCompletion(habit(), logs, TODAY)?.completed).toBe(0);
  });

  it('trzyma próg dokładnie na 0.4: 0.39 kwalifikuje, 0.41 nie', () => {
    // Sto dni próbki zamiast czternastu: tylko na takiej podstawie 0.39 i 0.41
    // są w ogóle osiągalne, a próg ma być sprawdzony dokładnie tam, gdzie leży.
    const old = habit({ startedOn: addDays(TODAY, -400) });
    const below = scheduledCompletion(old, doneLogs(39, 100), TODAY, 100);
    const above = scheduledCompletion(old, doneLogs(41, 100), TODAY, 100);

    expect(below?.ratio).toBeCloseTo(0.39, 5);
    expect(above?.ratio).toBeCloseTo(0.41, 5);
    expect((below?.ratio ?? 1) < 0.4).toBe(true);
    expect((above?.ratio ?? 0) < 0.4).toBe(false);
  });

  it('dzień pusty nie liczy się jako zaplanowany', () => {
    const fortnight = habit({ startedOn: addDays(TODAY, -14) });

    // Bez dni pustych próbka domyka się dokładnie na czternastu dniach.
    expect(scheduledCompletion(fortnight, [], TODAY)?.scheduled).toBe(14);

    // Jeden dzień pusty w oknie i nie ma już z czego zebrać próbki: dzień pusty
    // wypada z rachunku, a nie wchodzi do niego jako dzień niewykonany.
    const isRestDay = (day: IsoDate) => day === addDays(TODAY, -3);
    expect(scheduledCompletion(fortnight, [], TODAY, 14, isRestDay)).toBeNull();
  });

  it('nie zwraca nic, gdy próbki nie da się zebrać', () => {
    const young = habit({ startedOn: addDays(TODAY, -3) });

    expect(scheduledCompletion(young, [], TODAY)).toBeNull();
  });
});

describe('shouldOfferDownshift', () => {
  it('proponuje przy wykonaniu poniżej 40%', () => {
    expect(shouldOfferDownshift(habit(), doneLogs(5, 14), TODAY, CONTEXT)).toBe(true);
  });

  it('nie proponuje przy wykonaniu powyżej progu', () => {
    expect(shouldOfferDownshift(habit(), doneLogs(6, 14), TODAY, CONTEXT)).toBe(false);
  });

  it('nawyk trzydniowy nie kwalifikuje się nigdy', () => {
    const young = habit({ startedOn: addDays(TODAY, -3) });

    expect(shouldOfferDownshift(young, [], TODAY, CONTEXT)).toBe(false);
  });

  it('nie proponuje nawykowi zarchiwizowanemu ani zdjętemu przez ścieżkę', () => {
    const logs = doneLogs(2, 14);

    expect(
      shouldOfferDownshift(
        habit({ archivedAt: '2026-06-01T10:00:00Z' }),
        logs,
        TODAY,
        CONTEXT,
      ),
    ).toBe(false);
    expect(
      shouldOfferDownshift(
        habit({ retiredAt: '2026-06-01T10:00:00Z' }),
        logs,
        TODAY,
        CONTEXT,
      ),
    ).toBe(false);
  });

  it('nie powtarza propozycji w ciągu trzydziestu dni', () => {
    const logs = doneLogs(2, 14);

    expect(
      shouldOfferDownshift(habit(), logs, TODAY, {
        ...CONTEXT,
        lastOffer: { on: addDays(TODAY, -29), accepted: false },
      }),
    ).toBe(false);
    expect(
      shouldOfferDownshift(habit(), logs, TODAY, {
        ...CONTEXT,
        lastOffer: { on: addDays(TODAY, -30), accepted: false },
      }),
    ).toBe(true);
  });

  it('propozycja z dzisiaj zostaje na ekranie, dopóki nie zostanie przyjęta', () => {
    const logs = doneLogs(2, 14);

    expect(
      shouldOfferDownshift(habit(), logs, TODAY, {
        ...CONTEXT,
        lastOffer: { on: TODAY, accepted: false },
      }),
    ).toBe(true);
    expect(
      shouldOfferDownshift(habit(), logs, TODAY, {
        ...CONTEXT,
        lastOffer: { on: TODAY, accepted: true },
      }),
    ).toBe(false);
  });

  it('nie rusza praktyki ścieżki w tygodniu wejściowym', () => {
    const practice = habit({ sourcePathId: 'path-1' });
    const logs = doneLogs(2, 14);

    expect(
      shouldOfferDownshift(practice, logs, TODAY, {
        ...CONTEXT,
        reentryUntil: addDays(TODAY, 2),
      }),
    ).toBe(false);
    expect(
      shouldOfferDownshift(practice, logs, TODAY, {
        ...CONTEXT,
        reentryUntil: addDays(TODAY, -1),
      }),
    ).toBe(true);
  });

  it('nie proponuje, gdy nie ma już czego zmniejszyć', () => {
    const smallest = habit({
      unit: 'none',
      startValue: 1,
      incrementValue: 0,
      scheduleType: 'custom',
      scheduleDays: [1],
    });

    expect(shouldOfferDownshift(smallest, [], TODAY, CONTEXT)).toBe(false);
  });
});

describe('deterministicDownshift', () => {
  it('połowi wartość startową i zeruje przyrost', () => {
    expect(deterministicDownshift(habit({ startValue: 30, incrementValue: 2 }))).toEqual({
      startValue: 15,
      incrementValue: 0,
      scheduleType: 'daily',
      scheduleDays: null,
    });
  });

  it('zaokrągla w dół, ale nie schodzi poniżej jednego', () => {
    expect(deterministicDownshift(habit({ startValue: 5 }))?.startValue).toBe(2);
    expect(deterministicDownshift(habit({ startValue: 2 }))?.startValue).toBe(1);
  });

  it('rzedni harmonogram, gdy wartości nie ma jak podzielić', () => {
    const change = deterministicDownshift(
      habit({ unit: 'none', startValue: 1, scheduleType: 'weekdays' }),
    );

    expect(change).toEqual({
      startValue: 1,
      incrementValue: 0,
      scheduleType: 'custom',
      scheduleDays: [1, 3, 5],
    });
  });

  it('nie zmniejsza czegoś, co jest już najmniejsze', () => {
    expect(
      deterministicDownshift(
        habit({ unit: 'none', startValue: 1, scheduleType: 'custom', scheduleDays: [2] }),
      ),
    ).toBeNull();
  });
});
