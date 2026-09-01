begin;

create extension if not exists pgtap with schema extensions;
select plan(51);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a5400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'w1-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a5400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'w1-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a5400000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'w1-delete@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a5400000-0000-4000-8000-000000000001', true);

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, time_of_day, started_on
) values (
  'a5100000-0000-4000-8000-000000000001',
  (select auth.uid()),
  'Wersjonowany nawyk', 'minutes', 10, 0, 'completion', 'daily', 'morning',
  current_date
);

select is(
  (select count(*)::integer from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'),
  1,
  'utworzenie nawyku zapisuje dokładnie jedną pierwszą rewizję'
);

select ok(
  (
    select before_snapshot is null
      and source = 'user'
      and reason = 'created'
      and effective_on = current_date
    from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
  ),
  'pierwsza rewizja jest uczciwym snapshotem bez wymyślonego before'
);

insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value, value_completed
) values (
  'a5100000-0000-4000-8000-000000000001',
  (select auth.uid()), current_date, 'done', 10, 10
);

select is(
  (select count(*)::integer from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'),
  1,
  'zmiana logu ukończenia nie jest rewizją definicji'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"start_value":2}'::jsonb,
      'user', 'user_edit', current_date,
      'a5200000-0000-4000-8000-000000000001',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'edycja użytkownika jest atomowa z rewizją'
);

select is(
  (select count(*)::integer from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'),
  2,
  'edycja tworzy dokładnie jedną rewizję'
);

select ok(
  (
    select source = 'user'
      and reason = 'user_edit'
      and (before_snapshot ->> 'start_value')::numeric = 10
      and (after_snapshot ->> 'start_value')::numeric = 2
    from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
    order by revision_number desc limit 1
  ),
  'rewizja ma czytelne before/after i jawne pochodzenie'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"start_value":2}'::jsonb,
      'user', 'user_edit', current_date,
      'a5200000-0000-4000-8000-000000000001',
      '2000-01-01T00:00:00Z'::timestamptz
    )
  $$,
  'retry z tym samym kluczem zwraca zapis mimo starego expected_updated_at'
);

select is(
  (select count(*)::integer from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'),
  2,
  'retry offline nie duplikuje rewizji'
);

select throws_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"start_value":3}'::jsonb,
      'user', 'user_edit', current_date,
      'a5200000-0000-4000-8000-000000000001',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  '22023',
  'update_habit_with_revision: idempotency key reused',
  'ten sam klucz nie może oznaczać innej treści'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"start_value":1}'::jsonb,
      'downshift', 'difficult_period', current_date,
      'a5200000-0000-4000-8000-000000000002',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'downshift zapisuje zmianę przez ten sam atomowy mechanizm'
);

select ok(
  (
    select source = 'downshift' and reason = 'difficult_period'
    from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
    order by revision_number desc limit 1
  ),
  'downshift ma własne źródło i neutralny powód'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"time_of_day":"evening"}'::jsonb,
      'calibration', 'time_calibration', current_date,
      'a5200000-0000-4000-8000-000000000003',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'warstwa wersji obsługuje deterministyczną kalibrację pory'
);

select is(
  (select source from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'
   order by revision_number desc limit 1),
  'calibration',
  'kalibracja zachowuje jawne pochodzenie'
);

select lives_ok(
  $$
    select public.set_habit_lifecycle_with_revision(
      'a5100000-0000-4000-8000-000000000001', 'retired', current_date,
      'a5200000-0000-4000-8000-000000000004',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'retirement jest atomowy z rewizją'
);

select ok(
  (
    select source = 'user' and reason = 'retired'
      and (after_snapshot ->> 'retired')::boolean
    from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
    order by revision_number desc limit 1
  ),
  'retirement zapisuje stan bez kasowania historii'
);

select lives_ok(
  $$
    select public.set_habit_lifecycle_with_revision(
      'a5100000-0000-4000-8000-000000000001', 'active', current_date,
      'a5200000-0000-4000-8000-000000000005',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'powrót z retirement tworzy nową rewizję'
);

select ok(
  (
    select source = 'restore' and reason = 'restored'
      and not (after_snapshot ->> 'retired')::boolean
    from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
    order by revision_number desc limit 1
  ),
  'restore nie usuwa rewizji retirement'
);

select lives_ok(
  $$
    select public.set_habit_lifecycle_with_revision(
      'a5100000-0000-4000-8000-000000000001', 'archived', current_date,
      'a5200000-0000-4000-8000-000000000006',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'archiwizacja zapisuje rewizję'
);

select lives_ok(
  $$
    select public.set_habit_lifecycle_with_revision(
      'a5100000-0000-4000-8000-000000000001', 'unarchived', current_date,
      'a5200000-0000-4000-8000-000000000007',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'cofnięcie archiwizacji jest kolejną rewizją'
);

select is(
  (select count(*)::integer from public.habit_revisions
   where habit_id = 'a5100000-0000-4000-8000-000000000001'),
  8,
  'siedem trwałych mutacji dało siedem rewizji ponad initial snapshot'
);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001', false, current_date - 30,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'materializacja ścieżki działa z triggerem rewizji'
);

select is(
  (
    select count(*)::integer
    from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_path_id = 'b1000000-0000-4000-8000-000000000001'
      and revision.reason = 'path_materialized'
  ),
  1,
  'pierwszy etap tworzy dokładnie jeden initial snapshot źródła path'
);

select lives_ok(
  $$select public.pause_path((select id from public.user_paths where state = 'active'))$$,
  'pauza ścieżki zapisuje zmianę praktyki'
);

select is(
  (
    select reason from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
    order by revision.revision_number desc limit 1
  ),
  'path_pause',
  'pauza ma jednoznaczny powód path_pause'
);

select lives_ok(
  $$
    select public.resume_path(
      (select id from public.user_paths where state = 'paused'),
      current_date - 29,
      true
    )
  $$,
  'resume zapisuje lżejszą wersję reentry'
);

select is(
  (
    select source from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
    order by revision.revision_number desc limit 1
  ),
  'reentry',
  'ponowne wejście ma własne źródło'
);

select lives_ok(
  $$
    select public.restore_path_parameters(
      (select id from public.user_paths where state = 'active')
    )
  $$,
  'koniec reentry przywraca parametry atomowo'
);

select is(
  (
    select reason from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
    order by revision.revision_number desc limit 1
  ),
  'reentry_complete',
  'koniec reentry nie udaje edycji użytkownika'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'a5300000-0000-4000-8000-000000000001',
      'yes', 'advance', null, current_date - 14
    )
  $$,
  'przejście etapu nadal używa istniejącego lifecycle'
);

select ok(
  (
    select
      (select reason from public.habit_revisions
       where habit_id = first_habit.id order by revision_number desc limit 1)
        = 'path_stage'
      and
      (select reason from public.habit_revisions
       where habit_id = second_habit.id order by revision_number desc limit 1)
        = 'path_materialized'
    from public.habits first_habit
    cross join public.habits second_habit
    where first_habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
      and second_habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
  ),
  'etap tworzy jedną rewizję nowej praktyki i jedną wycofanej'
);

select is(
  (
    select count(*)::integer
    from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
  ),
  5,
  'materializacja, pauza, reentry, koniec reentry i etap to po jednej rewizji'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      (select id from public.habits
       where source_stage_id = 'b1100000-0000-4000-8000-000000000002'),
      '{"start_value":1}'::jsonb,
      'user', 'user_edit', current_date - 14,
      'a5200000-0000-4000-8000-000000000008',
      (select updated_at from public.habits
       where source_stage_id = 'b1100000-0000-4000-8000-000000000002')
    )
  $$,
  'jawna edycja aktywnej praktyki również trafia do historii'
);

select ok(
  (
    select (public.preview_habit_revision_restore(
      habit.id,
      (select revision.id from public.habit_revisions revision
       where revision.habit_id = habit.id order by revision_number limit 1),
      current_date
    ) ->> 'path_conflict')::boolean
    from public.habits habit
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
  ),
  'preview jawnie wykrywa konflikt z aktywną ścieżką'
);

select throws_ok(
  $$
    select public.restore_habit_revision(
      habit.id,
      (select id from public.habit_revisions
       where habit_id = habit.id order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = habit.id order by revision_number desc limit 1),
      false, current_date,
      'a5200000-0000-4000-8000-000000000009'
    )
    from public.habits habit
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
  $$,
  '23514',
  'restore_habit_revision: path conflict requires preview',
  'rollback nie omija świadomego preview aktywnej ścieżki'
);

select lives_ok(
  $$
    select public.restore_habit_revision(
      habit.id,
      (select id from public.habit_revisions
       where habit_id = habit.id order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = habit.id order by revision_number desc limit 1),
      true, current_date,
      'a5200000-0000-4000-8000-000000000010'
    )
    from public.habits habit
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
  $$,
  'świadomie zaakceptowany konflikt przywraca wersję'
);

select ok(
  (
    select source = 'restore'
      and reason = 'rollback'
      and restores_revision_id is not null
    from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
    order by revision.revision_number desc limit 1
  ),
  'przywrócenie jest nową rewizją wskazującą wersję źródłową'
);

select lives_ok(
  $$
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'abandoned', false
    )
  $$,
  'zakończenie ścieżki współpracuje z historią'
);

select ok(
  (
    select reason = 'path_end'
      and (after_snapshot ->> 'archived')::boolean
    from public.habit_revisions revision
    join public.habits habit on habit.id = revision.habit_id
    where habit.source_stage_id = 'b1100000-0000-4000-8000-000000000002'
    order by revision.revision_number desc limit 1
  ),
  'zakończenie zapisuje jedną rewizję path_end dla aktywnej praktyki'
);

select ok(
  (
    select (public.preview_habit_revision_restore(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number limit 1),
      current_date
    ) ->> 'can_restore')::boolean
  ),
  'wcześniejsza wersja mieści się bez skonfigurowanego budżetu'
);

select lives_ok(
  $$
    select public.restore_habit_revision(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number desc limit 1),
      false, current_date,
      'a5200000-0000-4000-8000-000000000011'
    )
  $$,
  'przywrócenie zwykłego nawyku działa po preview'
);

select is(
  (
    select count(*)::integer from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
      and reason = 'rollback'
  ),
  1,
  'przywrócenie dopisuje jedną rewizję rollback'
);

select lives_ok(
  $$
    select public.restore_habit_revision(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
         and reason <> 'rollback'
       order by revision_number desc limit 1),
      false, current_date,
      'a5200000-0000-4000-8000-000000000011'
    )
  $$,
  'retry restore zwraca wynik przed kontrolą oczekiwanej wersji'
);

select is(
  (
    select count(*)::integer from public.habit_revisions
    where habit_id = 'a5100000-0000-4000-8000-000000000001'
      and reason = 'rollback'
  ),
  1,
  'retry restore nie duplikuje historii'
);

select throws_ok(
  $$
    select public.restore_habit_revision(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       and reason = 'archived' limit 1),
      false, current_date,
      'a5200000-0000-4000-8000-000000000012'
    )
  $$,
  '40001',
  'restore_habit_revision: stale habit version',
  'konflikt offline z inną wersją nie nadpisuje zmian drugiego urządzenia'
);

select lives_ok(
  $$
    select public.update_habit_with_revision(
      'a5100000-0000-4000-8000-000000000001',
      '{"start_value":1}'::jsonb,
      'user', 'user_edit', current_date,
      'a5200000-0000-4000-8000-000000000013',
      (select updated_at from public.habits
       where id = 'a5100000-0000-4000-8000-000000000001')
    )
  $$,
  'przygotowanie małej bieżącej wersji działa'
);

reset role;
insert into public.day_plans (
  user_id, plan_date, daily_ceiling, minute_budget, timezone, day_start_hour
) values (
  'a5400000-0000-4000-8000-000000000001', current_date,
  5, 5, 'Europe/Berlin', 4
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a5400000-0000-4000-8000-000000000001', true);

select ok(
  not (public.preview_habit_revision_restore(
    'a5100000-0000-4000-8000-000000000001',
    (select id from public.habit_revisions
     where habit_id = 'a5100000-0000-4000-8000-000000000001'
     order by revision_number limit 1),
    current_date
  ) ->> 'can_restore')::boolean,
  'preview blokuje wersję przekraczającą bieżący budżet minut'
);

select throws_ok(
  $$
    select public.restore_habit_revision(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number limit 1),
      (select id from public.habit_revisions
       where habit_id = 'a5100000-0000-4000-8000-000000000001'
       order by revision_number desc limit 1),
      false, current_date,
      'a5200000-0000-4000-8000-000000000014'
    )
  $$,
  '23514',
  'restore_habit_revision: budget conflict',
  'RPC nie pozwala ominąć blokady budżetu'
);

select set_config('request.jwt.claim.sub', 'a5400000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.habit_revisions),
  0,
  'RLS nie pokazuje rewizji innego użytkownika'
);

select throws_ok(
  $$
    select public.preview_habit_revision_restore(
      'a5100000-0000-4000-8000-000000000001',
      (select id from public.habit_revisions limit 1),
      current_date
    )
  $$,
  'P0002',
  'preview_habit_revision_restore: revision not found',
  'RPC preview nie ujawnia obcej historii'
);

select throws_like(
  $$
    insert into public.habit_revisions (
      habit_id, user_id, revision_number, source, reason, effective_on,
      idempotency_key, after_snapshot
    ) values (
      'a5100000-0000-4000-8000-000000000001',
      'a5400000-0000-4000-8000-000000000001',
      99, 'user', 'user_edit', current_date,
      'a5200000-0000-4000-8000-000000000099', '{}'::jsonb
    )
  $$,
  '%permission denied for table habit_revisions%',
  'klient nie może dopisywać rewizji poza triggerem'
);

reset role;
insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, started_on
) values (
  'a5100000-0000-4000-8000-000000000003',
  'a5400000-0000-4000-8000-000000000003',
  'Do usunięcia', 'minutes', 1, 0, 'completion', 'daily', current_date
);

delete from auth.users where id = 'a5400000-0000-4000-8000-000000000003';

select is(
  (select count(*)::integer from public.habit_revisions
   where user_id = 'a5400000-0000-4000-8000-000000000003'),
  0,
  'usunięcie konta obejmuje prywatne snapshoty rewizji'
);

select * from finish();
rollback;
