import type { Habit } from '@/features/habits/model/habit';
import {
  buildReminderPlan,
  diffReminders,
  MAX_PENDING_NOTIFICATIONS,
  type PlannedReminder,
} from '@/features/notifications/model/plan';

const WARSAW = 'Europe/Warsaw';
/** 2026-03-16 to poniedziałek, 2026-03-21 sobota. */
const MONDAY = '2026-03-16';

/** 2026-03-16 o 06:00 czasu warszawskiego (UTC+1). */
const MONDAY_MORNING = new Date('2026-03-16T05:00:00Z');

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
    startValue: 3,
    incrementValue: 0,
    targetValue: null,
    progressionMode: 'completion',
    scheduleType: 'daily',
    scheduleDays: null,
    reminderTime: '07:30:00',
    timeOfDay: null,
    sourceBook: null,
    sourceAuthor: null,
    sortOrder: 0,
    sourcePathId: null,
    sourceStageId: null,
    retiredAt: null,
    startedOn: MONDAY,
    archivedAt: null,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    ...overrides,
  };
}

function buildPlan(
  habits: Habit[],
  overrides: Partial<Parameters<typeof buildReminderPlan>[0]> = {},
) {
  return buildReminderPlan({
    habits,
    completedCounts: new Map(),
    settledToday: new Set(),
    today: MONDAY,
    timeZone: WARSAW,
    now: MONDAY_MORNING,
    content: (item, target) => ({ title: `${item.title} — ${target}`, body: 'Odhacz' }),
    ...overrides,
  });
}

describe('buildReminderPlan', () => {
  it('pomija nawyki bez ustawionej godziny', () => {
    expect(buildPlan([habit({ reminderTime: null })])).toHaveLength(0);
  });

  it('pomija nawyki zarchiwizowane', () => {
    expect(buildPlan([habit({ archivedAt: '2026-03-16T09:00:00Z' })])).toHaveLength(0);
  });

  it('planuje po jednym wpisie na dzień z harmonogramu', () => {
    const plan = buildPlan([habit()]);
    expect(plan.length).toBeGreaterThan(1);
    expect(new Set(plan.map((item) => item.date)).size).toBe(plan.length);
  });

  it('nie planuje godzin, które już minęły', () => {
    // 08:00 czasu warszawskiego to 07:00Z — po godzinie przypomnienia.
    const plan = buildPlan([habit()], { now: new Date('2026-03-16T07:00:00Z') });
    expect(plan.some((item) => item.date === MONDAY)).toBe(false);
  });

  it('milczy o nawyku, o którym decyzja już zapadła dzisiaj', () => {
    const plan = buildPlan([habit()], { settledToday: new Set(['habit-1']) });
    expect(plan.some((item) => item.date === MONDAY)).toBe(false);
    expect(plan.length).toBeGreaterThan(0);
  });

  it('harmonogram dni roboczych omija weekend', () => {
    const plan = buildPlan([habit({ scheduleType: 'weekdays' })]);
    const weekend = plan.filter(
      (item) => item.date === '2026-03-21' || item.date === '2026-03-22',
    );
    expect(weekend).toHaveLength(0);
  });

  it('treść niesie konkretny cel, nie ogólnik', () => {
    const plan = buildPlan([habit({ startValue: 3, incrementValue: 0 })]);
    expect(plan[0]?.title).toBe('Medytacja — 3');
  });

  it('cel uwzględnia dotychczasowe wykonania', () => {
    const plan = buildPlan([habit({ startValue: 3, incrementValue: 2 })], {
      completedCounts: new Map([['habit-1', 4]]),
    });
    expect(plan[0]?.title).toBe('Medytacja — 11');
  });

  it('nie przekracza limitu oczekujących powiadomień', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      habit({ id: `habit-${index}`, title: `Nawyk ${index}` }),
    );
    expect(buildPlan(many).length).toBeLessThanOrEqual(MAX_PENDING_NOTIFICATIONS);
  });

  it('przy jednym nawyku sięga dalej niż przy dziesięciu', () => {
    const single = buildPlan([habit()]).length;
    const many = buildPlan(
      Array.from({ length: 10 }, (_, index) => habit({ id: `habit-${index}` })),
    ).filter((item) => item.habitId === 'habit-0').length;

    expect(single).toBeGreaterThan(many);
  });

  it('zmiana strefy zmienia moment odpalenia', () => {
    const warsaw = buildPlan([habit()])[0];
    const auckland = buildPlan([habit()], { timeZone: 'Pacific/Auckland' })[0];

    expect(warsaw?.fireAt.getTime()).not.toBe(auckland?.fireAt.getTime());
  });

  it('wpisy są posortowane chronologicznie', () => {
    const plan = buildPlan([habit(), habit({ id: 'habit-2', reminderTime: '06:00:00' })]);
    const times = plan.map((item) => item.fireAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('buildReminderPlan a dzień pusty', () => {
  it('w dniu pustym milczy', () => {
    const plan = buildPlan([habit()], { isRestDay: (date) => date === MONDAY });

    expect(plan.some((reminder) => reminder.date === MONDAY)).toBe(false);
  });

  it('kolejne dni planuje normalnie', () => {
    const plan = buildPlan([habit()], { isRestDay: (date) => date === MONDAY });

    expect(plan.length).toBeGreaterThan(0);
  });
});

describe('diffReminders', () => {
  const reminder = (key: string): PlannedReminder => ({
    key,
    habitId: 'habit-1',
    date: MONDAY,
    title: 'Medytacja',
    body: 'Odhacz',
    fireAt: MONDAY_MORNING,
  });

  it('zostawia w spokoju to, co już zaplanowane', () => {
    const diff = diffReminders(
      [reminder('a'), reminder('b')],
      [
        { identifier: 'id-a', key: 'a' },
        { identifier: 'id-b', key: 'b' },
      ],
    );

    expect(diff.toCancel).toEqual([]);
    expect(diff.toSchedule).toEqual([]);
  });

  it('kasuje nieaktualne i dokłada brakujące', () => {
    const diff = diffReminders(
      [reminder('a'), reminder('c')],
      [
        { identifier: 'id-a', key: 'a' },
        { identifier: 'id-b', key: 'b' },
      ],
    );

    expect(diff.toCancel).toEqual(['id-b']);
    expect(diff.toSchedule.map((item) => item.key)).toEqual(['c']);
  });

  it('pusty plan kasuje wszystko', () => {
    const diff = diffReminders([], [{ identifier: 'id-a', key: 'a' }]);
    expect(diff.toCancel).toEqual(['id-a']);
    expect(diff.toSchedule).toEqual([]);
  });
});
