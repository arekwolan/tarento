import {
  actionForFrictionReason,
  createFrictionRequestId,
  findFrictionSuggestion,
  FRICTION_THRESHOLD,
  FRICTION_WINDOW_DAYS,
  visibleFrictionSuggestion,
  type FrictionEvent,
  type FrictionReason,
  type FrictionResponse,
} from '@/features/friction/model/friction';
import { addDays, type IsoDate } from '@/lib/date';

const TODAY: IsoDate = '2026-08-29';
const HABIT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function event(
  offset: number,
  reason: FrictionReason = 'no_time',
  habitId = HABIT_ID,
  archivedAt: string | null = null,
): FrictionEvent {
  const eventDate = addDays(TODAY, offset);
  const suffix = String(1000 + Math.abs(offset)).slice(-4);
  return {
    id: `33333333-3333-4333-8333-33333333${suffix}`,
    habitId,
    userId: USER_ID,
    eventDate,
    reason,
    idempotencyKey: `44444444-4444-4444-8444-44444444${suffix}`,
    archivedAt,
    createdAt: `${eventDate}T10:00:00Z`,
  };
}

function response(
  kind: FrictionResponse['response'],
  reason: FrictionReason = 'no_time',
  overrides: Partial<FrictionResponse> = {},
): FrictionResponse {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    habitId: HABIT_ID,
    userId: USER_ID,
    reason,
    response: kind,
    effectiveOn: TODAY,
    suppressedUntil: addDays(TODAY, 30),
    idempotencyKey: '66666666-6666-4666-8666-666666666666',
    createdAt: `${TODAY}T11:00:00Z`,
    ...overrides,
  };
}

describe('actionForFrictionReason', () => {
  it.each<[FrictionReason, string]>([
    ['forgot', 'reminder'],
    ['no_time', 'downshift'],
    ['too_big', 'downshift'],
    ['wrong_time', 'time'],
    ['environment', 'prepare'],
    ['not_today', 'rest'],
  ])('prowadzi %s do istniejącej akcji %s', (reason, action) => {
    expect(actionForFrictionReason(reason)).toBe(action);
  });
});

describe('findFrictionSuggestion', () => {
  it('nie pokazuje nic poniżej progu trzech zdarzeń', () => {
    expect(findFrictionSuggestion([event(-1), event(-2)], [], TODAY)).toBeNull();
  });

  it('pokazuje jawny licznik dokładnie na progu', () => {
    const suggestion = findFrictionSuggestion(
      [event(-1), event(-2), event(-3)],
      [],
      TODAY,
    );

    expect(suggestion).toMatchObject({
      habitId: HABIT_ID,
      reason: 'no_time',
      action: 'downshift',
      count: FRICTION_THRESHOLD,
      windowDays: FRICTION_WINDOW_DAYS,
      firstDate: addDays(TODAY, -3),
      lastDate: addDays(TODAY, -1),
    });
  });

  it('ignoruje zdarzenia spoza okna, z przyszłości i usunięte', () => {
    expect(
      findFrictionSuggestion(
        [
          event(-(FRICTION_WINDOW_DAYS - 1)),
          event(-FRICTION_WINDOW_DAYS),
          event(1),
          event(-1, 'no_time', HABIT_ID, `${TODAY}T12:00:00Z`),
        ],
        [],
        TODAY,
      ),
    ).toBeNull();
  });

  it('po odrzuceniu wycisza sugestię do końca ustalonego okresu', () => {
    const events = [event(-1), event(-2), event(-3)];

    expect(findFrictionSuggestion(events, [response('dismissed')], TODAY)).toBeNull();
    expect(
      findFrictionSuggestion(
        events,
        [
          response('dismissed', 'no_time', {
            effectiveOn: addDays(TODAY, -31),
            suppressedUntil: addDays(TODAY, -1),
          }),
        ],
        TODAY,
      )?.reason,
    ).toBe('no_time');
  });

  it('po wykonaniu akcji wymaga trzech nowych zdarzeń', () => {
    const oldEvents = [event(-4), event(-3), event(-2)];
    const acted = response('acted', 'no_time', {
      effectiveOn: addDays(TODAY, -2),
      suppressedUntil: addDays(TODAY, -1),
    });

    expect(findFrictionSuggestion(oldEvents, [acted], TODAY)).toBeNull();
    expect(
      findFrictionSuggestion(
        [...oldEvents, event(-1), event(0), event(1)],
        [acted],
        addDays(TODAY, 1),
      )?.count,
    ).toBe(3);
  });

  it('z wielu wzorców zwraca najwyżej jeden i wybiera największy licznik', () => {
    const otherHabit = '77777777-7777-4777-8777-777777777777';
    const suggestion = findFrictionSuggestion(
      [
        event(-1, 'forgot'),
        event(-2, 'forgot'),
        event(-3, 'forgot'),
        event(-1, 'wrong_time', otherHabit),
        event(-2, 'wrong_time', otherHabit),
        event(-3, 'wrong_time', otherHabit),
        event(-4, 'wrong_time', otherHabit),
      ],
      [],
      TODAY,
    );

    expect(suggestion).toMatchObject({
      habitId: otherHabit,
      reason: 'wrong_time',
      count: 4,
    });
  });

  it('nie pokazuje karty podczas quiet week', () => {
    const suggestion = findFrictionSuggestion(
      [event(-1), event(-2), event(-3)],
      [],
      TODAY,
    );

    expect(visibleFrictionSuggestion(suggestion, addDays(TODAY, 2))).toBeNull();
    expect(visibleFrictionSuggestion(suggestion, null)).toBe(suggestion);
  });
});

describe('idempotencja klienta', () => {
  it('generuje UUID v4, który zostaje w mutacji offline', () => {
    expect(createFrictionRequestId(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
  });
});
