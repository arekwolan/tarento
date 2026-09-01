import {
  createHabitRevisionRequestId,
  habitRevisionChanges,
  habitRevisionRestorePreviewSchema,
  habitRevisionRowSchema,
  type HabitRevisionSnapshot,
} from '@/features/habits/model/revision';

const SNAPSHOT: HabitRevisionSnapshot = {
  title: 'Czytanie',
  description: null,
  icon: null,
  color: null,
  unit: 'minutes',
  category: 'learning',
  start_value: 10,
  increment_value: 0,
  target_value: null,
  progression_mode: 'completion',
  schedule_type: 'daily',
  schedule_days: null,
  reminder_time: null,
  time_of_day: 'evening',
  source_book: null,
  source_author: null,
  source_path_id: null,
  source_stage_id: null,
  retired: false,
  archived: false,
};

describe('habitRevisionChanges', () => {
  it('opisuje pierwszy snapshot jako utworzenie, bez surowego JSON', () => {
    expect(habitRevisionChanges(null, SNAPSHOT)).toEqual([{ kind: 'created' }]);
  });

  it('zwraca czytelne zmiany wartości, harmonogramu i statusu', () => {
    const after: HabitRevisionSnapshot = {
      ...SNAPSHOT,
      start_value: 2,
      schedule_type: 'custom',
      schedule_days: [1, 3, 5],
      time_of_day: 'morning',
      retired: true,
    };

    expect(habitRevisionChanges(SNAPSHOT, after)).toEqual([
      {
        kind: 'amount',
        before: { value: 10, unit: 'minutes' },
        after: { value: 2, unit: 'minutes' },
      },
      {
        kind: 'schedule',
        before: { schedule_type: 'daily', schedule_days: null },
        after: { schedule_type: 'custom', schedule_days: [1, 3, 5] },
      },
      { kind: 'time_of_day', before: 'evening', after: 'morning' },
      { kind: 'status', before: 'active', after: 'retired' },
    ]);
  });

  it('nie tworzy pozornej zmiany dla identycznych snapshotów', () => {
    expect(habitRevisionChanges(SNAPSHOT, { ...SNAPSHOT })).toEqual([]);
  });
});

describe('walidacja rewizji', () => {
  it('mapuje rekord bazy na model aplikacji', () => {
    const revision = habitRevisionRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      habit_id: '22222222-2222-4222-8222-222222222222',
      user_id: '33333333-3333-4333-8333-333333333333',
      revision_number: 1,
      source: 'user',
      reason: 'created',
      effective_on: '2026-08-29',
      idempotency_key: '44444444-4444-4444-8444-444444444444',
      before_snapshot: null,
      after_snapshot: SNAPSHOT,
      restores_revision_id: null,
      created_at: '2026-08-29T10:00:00Z',
    });

    expect(revision.habitId).toBe('22222222-2222-4222-8222-222222222222');
    expect(revision.afterSnapshot).toEqual(SNAPSHOT);
  });

  it('odrzuca niepełny preview zamiast zgadywać wynik budżetu', () => {
    expect(() => habitRevisionRestorePreviewSchema.parse({ habit_id: 'x' })).toThrow();
  });

  it('generuje stabilny UUID v4 do retry offline', () => {
    expect(createHabitRevisionRequestId(() => 0)).toBe(
      '00000000-0000-4000-8000-000000000000',
    );
  });
});
