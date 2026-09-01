import {
  isInReentry,
  needsParameterRestore,
  reentryUntilDate,
  scaledPractice,
} from '@/features/paths/model/parameters';
import type { PathPractice, UserPath } from '@/features/paths/model/schemas';

const RESUMED_ON = '2026-04-01';
const REENTRY_END = '2026-04-08';

function practice(overrides: Partial<PathPractice> = {}): PathPractice {
  return {
    id: 'practice-1',
    stageId: 'stage-1',
    title: 'Czytanie',
    why: 'po co',
    how: 'jak',
    whenHard: null,
    unit: 'minutes',
    startValue: 10,
    incrementValue: 5,
    targetValue: 45,
    progressionMode: 'calendar',
    scheduleType: 'daily',
    scheduleDays: null,
    timeOfDay: 'evening',
    category: null,
    isOptional: false,
    retiresPracticeId: null,
    sourceNoteOrdinals: null,
    sortOrder: 0,
    ...overrides,
  };
}

function userPath(overrides: Partial<UserPath> = {}): UserPath {
  return {
    id: 'user-path-1',
    userId: 'user-1',
    pathId: 'path-1',
    state: 'active',
    currentStageId: 'stage-1',
    stageEnteredOn: '2026-03-16',
    startedOn: '2026-03-16',
    pausedAt: null,
    endedAt: null,
    endedReason: null,
    reentryUntil: null,
    fit: null,
    createdAt: '2026-03-16T08:00:00.000Z',
    updatedAt: '2026-03-16T08:00:00.000Z',
    ...overrides,
  };
}

describe('tydzień wejściowy', () => {
  it('wznowienie ustawia koniec na dziś plus siedem dni', () => {
    expect(reentryUntilDate(RESUMED_ON)).toBe(REENTRY_END);
  });

  it('trwa do ostatniego dnia włącznie', () => {
    expect(isInReentry(REENTRY_END, RESUMED_ON)).toBe(true);
    expect(isInReentry(REENTRY_END, REENTRY_END)).toBe(true);
    expect(isInReentry(REENTRY_END, '2026-04-09')).toBe(false);
  });

  it('bez znacznika nie ma tygodnia wejściowego', () => {
    expect(isInReentry(null, RESUMED_ON)).toBe(false);
  });

  it('po ostatnim dniu parametry czekają na przywrócenie', () => {
    const resumed = userPath({ reentryUntil: REENTRY_END });

    expect(needsParameterRestore(resumed, REENTRY_END)).toBe(false);
    expect(needsParameterRestore(resumed, '2026-04-09')).toBe(true);
  });

  it('wstrzymana ścieżka niczego nie przywraca', () => {
    const paused = userPath({ state: 'paused', reentryUntil: REENTRY_END });

    expect(needsParameterRestore(paused, '2026-04-09')).toBe(false);
  });

  it('bez znacznika nie ma czego przywracać', () => {
    expect(needsParameterRestore(userPath(), '2026-04-09')).toBe(false);
  });
});

describe('scaledPractice', () => {
  it('wznowienie mnoży start i przyrost przez 0,6', () => {
    const resumed = scaledPractice(practice(), { lite: false, reentry: true });

    expect(resumed.startValue).toBe(6);
    expect(resumed.incrementValue).toBe(3);
  });

  it('po tygodniu wejściowym parametry wracają do wartości z katalogu', () => {
    const base = practice();
    const restored = scaledPractice(base, { lite: false, reentry: false });

    expect(restored.startValue).toBe(base.startValue);
    expect(restored.incrementValue).toBe(base.incrementValue);
    expect(restored).toBe(base);
  });

  it('wariant lekki i tydzień wejściowy mnożą się', () => {
    // 10 × 0,6 × 0,6 = 3,6 → 4
    expect(scaledPractice(practice(), { lite: true, reentry: true }).startValue).toBe(4);
  });

  it('sufit zostaje nietknięty', () => {
    expect(scaledPractice(practice(), { lite: false, reentry: true }).targetValue).toBe(
      45,
    );
  });

  it('start nie schodzi poniżej jednego, a zerowy przyrost zostaje zerowy', () => {
    const minimal = scaledPractice(practice({ startValue: 1, incrementValue: 0 }), {
      lite: true,
      reentry: true,
    });

    expect(minimal.startValue).toBe(1);
    expect(minimal.incrementValue).toBe(0);
  });
});
