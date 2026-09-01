import { collectUserData } from '@/features/data-export/api/export-api';
import { supabase } from '@/lib/supabase';

jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/cache' } }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

type Row = Record<string, unknown>;

const rows: Record<string, Row[]> = {
  profiles: [{ id: 'user-1' }],
  habits: [],
  habit_revisions: [{ id: 'revision-1', habit_id: 'habit-1', user_id: 'user-1' }],
  habit_friction_events: [
    { id: 'friction-1', habit_id: 'habit-1', user_id: 'user-1', archived_at: null },
    {
      id: 'friction-deleted',
      habit_id: 'habit-1',
      user_id: 'user-1',
      archived_at: '2026-08-29T10:00:00Z',
    },
  ],
  habit_friction_responses: [
    { id: 'friction-response-1', habit_id: 'habit-1', user_id: 'user-1' },
  ],
  self_rules: [
    { id: 'rule-1', user_id: 'user-1', archived_at: null },
    { id: 'rule-deleted', user_id: 'user-1', archived_at: '2026-08-29' },
  ],
  self_rule_events: [
    { id: 'rule-event-1', rule_id: 'rule-1', user_id: 'user-1' },
    { id: 'deleted-rule-event', rule_id: 'rule-deleted', user_id: 'user-1' },
  ],
  habit_logs: [],
  quote_favorites: [],
  daily_quotes: [],
  day_plans: [],
  day_plan_items: [],
  book_lab_projects: [{ id: 'project-1', owner_id: 'user-1' }],
  book_lab_notes: [{ id: 'note-1', project_id: 'project-1', owner_id: 'user-1' }],
  book_lab_note_contexts: [
    { note_id: 'note-1', owner_id: 'user-1', context_value: 'workday' },
  ],
  protocol_conflict_reviews: [{ id: 'review-1', owner_id: 'user-1' }],
  protocol_conflicts: [{ id: 'conflict-1', review_id: 'review-1', owner_id: 'user-1' }],
  paths: [
    { id: 'private-path', owner_id: 'user-1' },
    { id: 'public-path', owner_id: null },
  ],
  path_stages: [
    { id: 'private-stage', path_id: 'private-path' },
    { id: 'public-stage', path_id: 'public-path' },
  ],
  path_practices: [
    { id: 'private-practice', stage_id: 'private-stage' },
    { id: 'public-practice', stage_id: 'public-stage' },
  ],
  path_readings: [
    { id: 'private-pointer', stage_id: 'private-stage', source_kind: 'pointer' },
    { id: 'public-reading', stage_id: 'public-stage', source_kind: 'original' },
  ],
  user_paths: [{ id: 'user-path-1', user_id: 'user-1', path_id: 'private-path' }],
  user_path_practices: [{ id: 'link-1', user_id: 'user-1' }],
  path_setup_actions: [
    {
      id: 'setup-1',
      user_id: 'user-1',
      user_path_id: 'user-path-1',
      status: 'completed',
    },
  ],
  path_transfer_responses: [
    { id: 'transfer-1', user_id: 'user-1', archived_at: null },
    { id: 'transfer-deleted', user_id: 'user-1', archived_at: '2026-08-29' },
  ],
  path_implementation_confirmations: [{ id: 'confirmation-1', user_id: 'user-1' }],
};

function result(data: Row[]) {
  return Promise.resolve({ data, error: null });
}

type Builder = {
  select: jest.Mock<Builder, []>;
  maybeSingle: jest.Mock;
  not: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  then: (
    resolve: (value: { data: Row[]; error: null }) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

function builderFor(table: string): Builder {
  const builder: Builder = {
    select: jest.fn(() => builder),
    maybeSingle: jest.fn(() =>
      Promise.resolve({ data: rows[table]?.[0] ?? null, error: null }),
    ),
    not: jest.fn((column: string) =>
      result((rows[table] ?? []).filter((row) => row[column] !== null)),
    ),
    is: jest.fn((column: string, value: unknown) =>
      result((rows[table] ?? []).filter((row) => row[column] === value)),
    ),
    in: jest.fn((column: string, values: readonly string[]) =>
      result((rows[table] ?? []).filter((row) => values.includes(String(row[column])))),
    ),
    then: (
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject: (reason: unknown) => unknown,
    ) => result(rows[table] ?? []).then(resolve, reject),
  };
  return builder;
}

describe('eksport Laboratorium książki', () => {
  beforeEach(() => {
    jest.mocked(supabase.from).mockImplementation((table) => builderFor(table) as never);
  });

  it('obejmuje notatki i prywatną wersję ścieżki bez treści publicznego katalogu', async () => {
    const exported = await collectUserData();

    expect(exported.format_version).toBe(9);
    expect(exported.habit_revisions).toEqual(rows.habit_revisions);
    expect(exported.habit_friction_events).toEqual([rows.habit_friction_events![0]]);
    expect(exported.habit_friction_responses).toEqual(rows.habit_friction_responses);
    expect(exported.self_rules).toEqual([rows.self_rules![0]]);
    expect(exported.self_rule_events).toEqual([rows.self_rule_events![0]]);
    expect(exported.book_lab_projects).toEqual(rows.book_lab_projects);
    expect(exported.book_lab_notes).toEqual(rows.book_lab_notes);
    expect(exported.book_lab_note_contexts).toEqual(rows.book_lab_note_contexts);
    expect(exported.protocol_conflict_reviews).toEqual(rows.protocol_conflict_reviews);
    expect(exported.protocol_conflicts).toEqual(rows.protocol_conflicts);
    expect(exported.private_paths).toEqual([rows.paths![0]]);
    expect(exported.path_stages).toEqual([rows.path_stages![0]]);
    expect(exported.path_practices).toEqual([rows.path_practices![0]]);
    expect(exported.path_readings).toEqual([rows.path_readings![0]]);
    expect(exported.user_paths).toEqual(rows.user_paths);
    expect(exported.user_path_practices).toEqual(rows.user_path_practices);
    expect(exported.path_setup_actions).toEqual(rows.path_setup_actions);
    expect(exported.path_transfer_responses).toEqual([rows.path_transfer_responses![0]]);
    expect(exported.path_implementation_confirmations).toEqual(
      rows.path_implementation_confirmations,
    );
  });
});
