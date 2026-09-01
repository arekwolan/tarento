begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'c1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'w5-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'w5-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.paths (
  id, slug, version, title, hook, honesty, duration_days, language,
  is_published, path_kind, source_type, source_title, source_author,
  curated_by, review_status, disclaimer, owner_id, origin_kind
) values
  (
    'c2000000-0000-4000-8000-000000000001', 'w5-existing', 1,
    'Poprzedni protokół', 'Test', 'Test', 14, 'pl', false,
    'book_protocol', 'book', 'Prywatne źródło A', 'Autor A',
    'Własne notatki w Tarento', 'draft', 'Prywatny test',
    'c1000000-0000-4000-8000-000000000001', 'private'
  ),
  (
    'c2000000-0000-4000-8000-000000000002', 'w5-incoming', 1,
    'Nowy protokół', 'Test', 'Test', 14, 'pl', false,
    'book_protocol', 'book', 'Prywatne źródło B', 'Autor B',
    'Własne notatki w Tarento', 'draft', 'Prywatny test',
    'c1000000-0000-4000-8000-000000000001', 'private'
  );

insert into public.path_stages (
  id, path_id, ordinal, name, description, daily_minutes_p50,
  min_days, max_days, completion_threshold
) values
  (
    'c2100000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001', 1, 'A', 'A', 5, 7, 14, 0.6
  ),
  (
    'c2100000-0000-4000-8000-000000000002',
    'c2000000-0000-4000-8000-000000000002', 1, 'B', 'B', 5, 7, 14, 0.6
  );

insert into public.path_practices (
  id, stage_id, title, why, how, unit, start_value,
  schedule_type, time_of_day, source_note_ordinals
) values
  (
    'c2200000-0000-4000-8000-000000000001',
    'c2100000-0000-4000-8000-000000000001',
    'Obecna praktyka', 'Test', 'Test', 'minutes', 5, 'daily', 'morning', array[1]::smallint[]
  ),
  (
    'c2200000-0000-4000-8000-000000000002',
    'c2100000-0000-4000-8000-000000000002',
    'Nowa praktyka', 'Test', 'Test', 'minutes', 5, 'daily', 'morning', array[1]::smallint[]
  );

insert into public.book_lab_projects (
  id, owner_id, request_key, source_title, source_author, desired_change,
  locale, prompt_version, status, generated_draft, path_id
) values
  (
    'c3000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'c3100000-0000-4000-8000-000000000001', 'A', 'A', 'A',
    'pl', 'book-lab-v1', 'saved', '{}'::jsonb,
    'c2000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'c3100000-0000-4000-8000-000000000002', 'B', 'B', 'B',
    'pl', 'book-lab-v1', 'saved', '{}'::jsonb,
    'c2000000-0000-4000-8000-000000000002'
  );

insert into public.book_lab_notes (
  id, project_id, owner_id, ordinal, content
) values
  (
    'c3200000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001', 1,
    'Zawsze odkładaj telefon.'
  ),
  (
    'c3200000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001', 1,
    'Nigdy odkładaj telefon.'
  );

insert into public.habits (
  id, user_id, title, unit, start_value, progression_mode, schedule_type,
  time_of_day, source_path_id, source_stage_id
) values (
  'c4000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 'Obecna praktyka',
  'minutes', 5, 'completion', 'daily', 'morning',
  'c2000000-0000-4000-8000-000000000001',
  'c2100000-0000-4000-8000-000000000001'
);

insert into public.protocol_conflict_reviews (
  id, owner_id, path_id, request_key, input_fingerprint, state_fingerprint,
  status, semantic_status, algorithm_version
) values (
  'c5000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000002',
  'c5100000-0000-4000-8000-000000000001', md5('input'),
  public.protocol_conflict_state_fingerprint(
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002'
  ),
  'ready', 'complete', 'protocol-conflicts-local-v1'
);

insert into public.protocol_conflicts (
  id, review_id, owner_id, conflict_key, conflict_type, stage_id,
  incoming_practice_id, existing_habit_id, day_kinds, time_of_day,
  note_a_id, note_b_id, description, confidence
) values (
  'c5200000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 'execution:test', 'execution',
  'c2100000-0000-4000-8000-000000000002',
  'c2200000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000001', array['workday'], 'morning',
  null, null, null, null
), (
  'c5200000-0000-4000-8000-000000000002',
  'c5000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 'rule:test', 'rule',
  'c2100000-0000-4000-8000-000000000002',
  'c2200000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000001',
  array['workday'], 'morning',
  'c3200000-0000-4000-8000-000000000001',
  'c3200000-0000-4000-8000-000000000002',
  'Notatki sugerują przeciwne działania w podobnym kontekście.', 'high'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);

select is((select count(*)::integer from public.protocol_conflict_reviews), 1,
  'właściciel widzi review');
select is((select count(*)::integer from public.protocol_conflicts), 2,
  'właściciel widzi oba typy konfliktu');

select throws_ok(
  $$
    select public.enroll_in_path_reviewed(
      'c6000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000002',
      'c5000000-0000-4000-8000-000000000001', false, current_date,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  '23514', 'enroll_in_path_reviewed: unresolved conflicts',
  'brak odpowiedzi blokuje aktywację'
);

select lives_ok(
  $$ select public.resolve_protocol_conflict(
    'c5000000-0000-4000-8000-000000000001',
    'c5200000-0000-4000-8000-000000000002',
    'context_split', 'workday', 'free'
  ) $$,
  'użytkownik rozdziela sprzeczne reguły kontekstem'
);

select is((select count(*)::integer from public.book_lab_note_contexts), 2,
  'kontekst zapisuje się przy obu notatkach');

select lives_ok(
  $$ select public.resolve_protocol_conflict(
    'c5000000-0000-4000-8000-000000000001',
    'c5200000-0000-4000-8000-000000000001',
    'reject_existing', null, null
  ) $$,
  'użytkownik może odrzucić obecną praktykę'
);

select lives_ok(
  $$
    select public.enroll_in_path_reviewed(
      'c6000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000002',
      'c5000000-0000-4000-8000-000000000001', false, current_date,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'rozwiązany review pozwala aktywować tę samą ścieżkę'
);

select ok((select retired_at is not null from public.habits
  where id = 'c4000000-0000-4000-8000-000000000001'),
  'odrzucenie istniejącej praktyki przechodzi przez normalny lifecycle');

select is(
  public.enroll_in_path_reviewed(
    'c6000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002',
    'c5000000-0000-4000-8000-000000000001', false, current_date,
    '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
  ),
  (select user_path_id from public.path_enrollment_requests
    where request_key = 'c6000000-0000-4000-8000-000000000001'),
  'retry zwraca ten sam user_path_id'
);

select is((select count(*)::integer from public.user_paths), 1,
  'retry nie duplikuje user_path');

select throws_ok(
  $$
    select set_config('tarento.protocol_conflict_path', '', true);
    select public.enroll_in_path(
      'c2000000-0000-4000-8000-000000000002', false, current_date,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  '23514', 'user_path_parent: wymagany przegląd konfliktów',
  'prywatnego protokołu nie da się aktywować z pominięciem review'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true);

select is((select count(*)::integer from public.protocol_conflict_reviews), 0,
  'RLS ukrywa review innego użytkownika');
select is((select count(*)::integer from public.protocol_conflicts), 0,
  'RLS ukrywa konflikty innego użytkownika');

select throws_ok(
  $$ select public.resolve_protocol_conflict(
    'c5000000-0000-4000-8000-000000000001',
    'c5200000-0000-4000-8000-000000000001',
    'reject_existing', null, null
  ) $$,
  'P0002', 'resolve_protocol_conflict: conflict not found',
  'drugi użytkownik nie może rozstrzygnąć cudzego konfliktu'
);

select * from finish();
rollback;
