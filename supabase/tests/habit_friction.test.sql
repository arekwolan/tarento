begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a6400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'w2-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a6400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'w2-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

update public.profiles
set timezone = 'America/Los_Angeles', day_start_hour = 12
where id = 'a6400000-0000-4000-8000-000000000001';

create temp table w2_test_context on commit drop as
select
  public.logical_today('a6400000-0000-4000-8000-000000000001') as logical_day,
  public.logical_today('a6400000-0000-4000-8000-000000000002') as other_logical_day;
grant select on w2_test_context to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400000-0000-4000-8000-000000000001', true);

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, time_of_day, started_on
) values
  (
    'a6100000-0000-4000-8000-000000000001', (select auth.uid()),
    'Tarcie pierwsze', 'minutes', 5, 0, 'completion', 'daily', 'morning',
    (select logical_day from w2_test_context)
  ),
  (
    'a6100000-0000-4000-8000-000000000002', (select auth.uid()),
    'Tarcie enumy', 'minutes', 3, 0, 'completion', 'daily', 'evening',
    (select logical_day from w2_test_context)
  );

insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value
) values (
  'a6100000-0000-4000-8000-000000000001', (select auth.uid()),
  (select logical_day from w2_test_context), 'skipped', 5
);

select is(
  (select count(*)::integer from public.habit_friction_events),
  0,
  'ręczne skipped nie wymaga i nie tworzy automatycznie powodu'
);

select lives_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'forgot',
      'a6200000-0000-4000-8000-000000000001'
    )
  $$,
  'opcjonalny enum zapisuje się osobno od logu'
);

select is(
  (
    select event_date from public.habit_friction_events
    where idempotency_key = 'a6200000-0000-4000-8000-000000000001'
  ),
  (select logical_day from w2_test_context),
  'zdarzenie zachowuje dzień logiczny profilu i strefę użytkownika'
);

select is(
  (
    select status from public.habit_logs
    where habit_id = 'a6100000-0000-4000-8000-000000000001'
  ),
  'skipped',
  'wybór przeszkody nie zmienia semantyki skipped'
);

select lives_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'forgot',
      'a6200000-0000-4000-8000-000000000001'
    )
  $$,
  'retry tego samego zapisu jest idempotentny'
);

select is(
  (
    select count(*)::integer from public.habit_friction_events
    where idempotency_key = 'a6200000-0000-4000-8000-000000000001'
  ),
  1,
  'retry offline nie duplikuje zdarzenia'
);

select throws_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'no_time',
      'a6200000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'save_habit_friction_event: idempotency key reused',
  'ten sam klucz nie może opisywać innego powodu'
);

select throws_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'brak_dyscypliny',
      'a6200000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'save_habit_friction_event: invalid reason',
  'serwer odrzuca etykietę spoza neutralnego katalogu'
);

select throws_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context) + 1,
      'forgot',
      'a6200000-0000-4000-8000-000000000003'
    )
  $$,
  '22023',
  'save_habit_friction_event: invalid logical date',
  'klient nie może zapisać przeszkody w przyszłym dniu'
);

do $$
declare
  v_today date := (select logical_day from w2_test_context);
begin
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today, 'forgot',
    'a6200000-0000-4000-8000-000000000010'
  );
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today - 1, 'no_time',
    'a6200000-0000-4000-8000-000000000011'
  );
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today - 2, 'too_big',
    'a6200000-0000-4000-8000-000000000012'
  );
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today - 3, 'wrong_time',
    'a6200000-0000-4000-8000-000000000013'
  );
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today - 4, 'environment',
    'a6200000-0000-4000-8000-000000000014'
  );
  perform public.save_habit_friction_event(
    'a6100000-0000-4000-8000-000000000002', v_today - 5, 'not_today',
    'a6200000-0000-4000-8000-000000000015'
  );
end;
$$;

select is(
  (
    select count(distinct reason)::integer from public.habit_friction_events
    where habit_id = 'a6100000-0000-4000-8000-000000000002'
      and archived_at is null
  ),
  6,
  'wszystkie sześć neutralnych enumów przechodzi walidację'
);

select lives_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'no_time',
      'a6200000-0000-4000-8000-000000000020'
    )
  $$,
  'powód dla tego samego dnia można świadomie zmienić'
);

select is(
  (
    select count(*)::integer from public.habit_friction_events
    where habit_id = 'a6100000-0000-4000-8000-000000000001'
      and event_date = (select logical_day from w2_test_context)
      and archived_at is null
  ),
  1,
  'per nawyk i dzień istnieje najwyżej jeden aktywny powód'
);

select ok(
  (
    select archived_at is not null from public.habit_friction_events
    where idempotency_key = 'a6200000-0000-4000-8000-000000000001'
  ),
  'zmiana powodu zachowuje poprzedni rekord jako soft delete'
);

select lives_ok(
  $$
    select public.set_habit_friction_event_archived(
      (select id from public.habit_friction_events
       where idempotency_key = 'a6200000-0000-4000-8000-000000000020'),
      true
    )
  $$,
  'użytkownik może usunąć aktywny powód'
);

select lives_ok(
  $$
    select public.set_habit_friction_event_archived(
      (select id from public.habit_friction_events
       where idempotency_key = 'a6200000-0000-4000-8000-000000000020'),
      true
    )
  $$,
  'retry usunięcia jest bezpiecznym no-op'
);

select is(
  (
    select count(*)::integer from public.habit_friction_events
    where habit_id = 'a6100000-0000-4000-8000-000000000001'
      and archived_at is null
  ),
  0,
  'usunięty powód nie wchodzi do aktywnej mapy ani eksportu'
);

select lives_ok(
  $$
    select public.set_habit_friction_event_archived(
      (select id from public.habit_friction_events
       where idempotency_key = 'a6200000-0000-4000-8000-000000000020'),
      false
    )
  $$,
  'akcję usunięcia można cofnąć'
);

select lives_ok(
  $$
    select public.set_habit_friction_event_archived(
      (select id from public.habit_friction_events
       where idempotency_key = 'a6200000-0000-4000-8000-000000000020'),
      false
    )
  $$,
  'retry cofnięcia nie zmienia stanu po raz drugi'
);

select is(
  (
    select reason from public.habit_friction_events
    where habit_id = 'a6100000-0000-4000-8000-000000000001'
      and archived_at is null
  ),
  'no_time',
  'cofnięcie przywraca dokładnie usunięty enum'
);

select lives_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select logical_day from w2_test_context),
      'too_big',
      'a6200000-0000-4000-8000-000000000021'
    )
  $$,
  'nowszy wybór zastępuje przywrócony powód'
);

select throws_ok(
  $$
    select public.set_habit_friction_event_archived(
      (select id from public.habit_friction_events
       where idempotency_key = 'a6200000-0000-4000-8000-000000000020'),
      false
    )
  $$,
  '40001',
  'set_habit_friction_event_archived: stale event version',
  'stare cofnięcie offline nie nadpisuje nowszego powodu'
);

select lives_ok(
  $$
    select public.respond_habit_friction_suggestion(
      'a6100000-0000-4000-8000-000000000001', 'too_big', 'dismissed',
      (select logical_day from w2_test_context),
      'a6200000-0000-4000-8000-000000000030'
    )
  $$,
  'sugestię można wyciszyć bez usuwania zdarzeń'
);

select is(
  (
    select suppressed_until - effective_on
    from public.habit_friction_responses
    where idempotency_key = 'a6200000-0000-4000-8000-000000000030'
  ),
  30,
  'okres wyciszenia ma stałe trzydzieści dni'
);

select lives_ok(
  $$
    select public.respond_habit_friction_suggestion(
      'a6100000-0000-4000-8000-000000000001', 'too_big', 'dismissed',
      (select logical_day from w2_test_context),
      'a6200000-0000-4000-8000-000000000030'
    )
  $$,
  'retry odpowiedzi na sugestię jest idempotentny'
);

select is(
  (
    select count(*)::integer from public.habit_friction_responses
    where idempotency_key = 'a6200000-0000-4000-8000-000000000030'
  ),
  1,
  'retry nie duplikuje wyciszenia'
);

select throws_ok(
  $$
    select public.respond_habit_friction_suggestion(
      'a6100000-0000-4000-8000-000000000001', 'too_big', 'acted',
      (select logical_day from w2_test_context),
      'a6200000-0000-4000-8000-000000000030'
    )
  $$,
  '22023',
  'respond_habit_friction_suggestion: idempotency key reused',
  'klucz odpowiedzi nie może dostać innej decyzji'
);

select lives_ok(
  $$
    select public.respond_habit_friction_suggestion(
      'a6100000-0000-4000-8000-000000000002', 'environment', 'acted',
      (select logical_day from w2_test_context),
      'a6200000-0000-4000-8000-000000000031'
    )
  $$,
  'jednorazowe przygotowanie zapisuje tylko enum decyzji'
);

select is(
  (
    select reminder_time from public.habits
    where id = 'a6100000-0000-4000-8000-000000000002'
  ),
  null,
  'powód forgot ani sugestia nigdy nie włączają przypomnienia automatycznie'
);

select throws_like(
  $$
    insert into public.habit_friction_events (
      habit_id, user_id, event_date, reason, idempotency_key, request_fingerprint
    ) values (
      'a6100000-0000-4000-8000-000000000001', (select auth.uid()),
      (select logical_day from w2_test_context) - 1, 'forgot',
      'a6200000-0000-4000-8000-000000000040', md5('direct')
    )
  $$,
  '%permission denied for table habit_friction_events%',
  'klient nie może ominąć RPC bezpośrednim insertem'
);

select throws_like(
  $$
    update public.habit_friction_responses set response = 'acted'
  $$,
  '%permission denied for table habit_friction_responses%',
  'klient nie może przepisać append-only odpowiedzi'
);

select set_config('request.jwt.claim.sub', 'a6400000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.habit_friction_events),
  0,
  'RLS nie pokazuje zdarzeń innego użytkownika'
);

select is(
  (select count(*)::integer from public.habit_friction_responses),
  0,
  'RLS nie pokazuje odpowiedzi innego użytkownika'
);

select throws_ok(
  $$
    select public.save_habit_friction_event(
      'a6100000-0000-4000-8000-000000000001',
      (select other_logical_day from w2_test_context), 'forgot',
      'a6200000-0000-4000-8000-000000000041'
    )
  $$,
  'P0002',
  'save_habit_friction_event: habit not found',
  'RPC nie pozwala dopisać powodu do cudzego nawyku'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

delete from auth.users where id = 'a6400000-0000-4000-8000-000000000001';

select is(
  (
    select
      (select count(*) from public.habit_friction_events
       where user_id = 'a6400000-0000-4000-8000-000000000001')
      +
      (select count(*) from public.habit_friction_responses
       where user_id = 'a6400000-0000-4000-8000-000000000001')
  )::integer,
  0,
  'usunięcie konta obejmuje zdarzenia i odpowiedzi mapy tarcia'
);

select * from finish();
rollback;
