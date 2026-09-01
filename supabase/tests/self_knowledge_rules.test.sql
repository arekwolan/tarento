begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b3400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'w3-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b3400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'w3-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

update public.profiles
set timezone = 'UTC', day_start_hour = 0
where id in (
  'b3400000-0000-4000-8000-000000000001',
  'b3400000-0000-4000-8000-000000000002'
);

create temp table w3_test_context on commit drop as
select
  public.logical_today('b3400000-0000-4000-8000-000000000001') as logical_day,
  public.logical_today('b3400000-0000-4000-8000-000000000002') as other_logical_day;
grant select on w3_test_context to authenticated;

select has_table('public', 'self_rules', 'W3 ma tabelę prywatnych reguł');
select has_table('public', 'self_rule_events', 'W3 ma append-only audyt reguł');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3400000-0000-4000-8000-000000000001', true);

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, time_of_day, started_on
) values (
  'b3100000-0000-4000-8000-000000000001', (select auth.uid()),
  'Prywatna nazwa', 'minutes', 5, 0, 'completion', 'daily', 'evening',
  (select logical_day from w3_test_context) - 30
);

insert into public.day_templates (
  id, user_id, name, kind, wake_time, sleep_time, self_minutes, sort_order
) values (
  'b3500000-0000-4000-8000-000000000001', (select auth.uid()),
  'Mój dzień', 'workday', '07:00', '23:00', 30, 0
);
insert into public.day_rotations (user_id, anchor_date, template_ids)
values (
  (select auth.uid()), (select logical_day from w3_test_context),
  array['b3500000-0000-4000-8000-000000000001'::uuid]
);
select public.ensure_day_plan((select logical_day from w3_test_context));

select is(
  (select day_kind from public.day_plans limit 1),
  'workday',
  'nowy plan zapisuje typ dnia bez rekonstruowania starszej historii'
);

select ok(
  not (
    select to_jsonb(evidence) ?| array['note', 'title', 'evidence']
    from public.get_self_rule_evidence(
      (select logical_day from w3_test_context),
      (select logical_day from w3_test_context)
    ) evidence
    limit 1
  ),
  'evidence RPC nie zwraca notatek, nazw ani tekstowego dowodu transferu'
);

select lives_ok(
  $$
    select public.sync_self_rule_candidates(
      jsonb_build_array(jsonb_build_object(
        'rule_type', 'time_of_day',
        'subject_habit_id', 'b3100000-0000-4000-8000-000000000001',
        'preferred_value', 'evening',
        'comparison_value', 'morning',
        'preferred_completed', 5,
        'preferred_opportunities', 6,
        'comparison_completed', 1,
        'comparison_opportunities', 6,
        'range_start', (select logical_day from w3_test_context) - 20,
        'range_end', (select logical_day from w3_test_context) - 1
      )),
      (select logical_day from w3_test_context)
    )
  $$,
  'deterministyczny kandydat zapisuje się przez RPC'
);

select is((select count(*)::integer from public.self_rules), 1, 'powstaje jedna reguła');
select ok(
  (
    select status = 'candidate'
      and algorithm_version = 'self-rules-v1'
      and sample_size = 12
      and not (evidence_snapshot ? 'title')
    from public.self_rules
  ),
  'kandydat ma status, wersję, próbę i nie zawiera prywatnej nazwy'
);
select is(
  (select count(*)::integer from public.self_rule_events where event_type = 'generated'),
  1,
  'wygenerowanie ma append-only zdarzenie'
);

select lives_ok(
  $$
    select public.sync_self_rule_candidates(
      jsonb_build_array(jsonb_build_object(
        'rule_type', 'time_of_day',
        'subject_habit_id', 'b3100000-0000-4000-8000-000000000001',
        'preferred_value', 'evening', 'comparison_value', 'morning',
        'preferred_completed', 5, 'preferred_opportunities', 6,
        'comparison_completed', 1, 'comparison_opportunities', 6,
        'range_start', (select logical_day from w3_test_context) - 20,
        'range_end', (select logical_day from w3_test_context) - 1
      )), (select logical_day from w3_test_context)
    )
  $$,
  'ponowna synchronizacja tego samego evidence jest idempotentna'
);
select is((select count(*)::integer from public.self_rules), 1, 'retry nie duplikuje reguły');

select throws_ok(
  $$
    select public.sync_self_rule_candidates(
      jsonb_build_array(jsonb_build_object(
        'rule_type', 'target_size',
        'subject_habit_id', 'b3100000-0000-4000-8000-000000000001',
        'preferred_value', 'smaller', 'comparison_value', 'larger',
        'preferred_completed', 4, 'preferred_opportunities', 5,
        'comparison_completed', 1, 'comparison_opportunities', 5,
        'range_start', (select logical_day from w3_test_context) - 10,
        'range_end', (select logical_day from w3_test_context) - 1
      )), (select logical_day from w3_test_context)
    )
  $$,
  '22023',
  'sync_self_rule_candidates: insufficient evidence',
  'serwer odrzuca próbę mniejszą od minimum'
);

select lives_ok(
  $$
    select public.decide_self_rule(
      (select id from public.self_rules), 'accept',
      (select logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000001'
    )
  $$,
  'użytkownik akceptuje kandydata ręcznie'
);
select is((select status from public.self_rules), 'accepted', 'akceptacja zmienia status');
select is(
  (select count(*)::integer from public.self_rule_events where event_type = 'accepted'),
  1,
  'akceptacja dopisuje decyzję do audytu'
);
select lives_ok(
  $$
    select public.decide_self_rule(
      (select id from public.self_rules), 'accept',
      (select logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000001'
    )
  $$,
  'retry akceptacji jest idempotentny'
);
select is(
  (select count(*)::integer from public.self_rule_events
   where idempotency_key = 'b3200000-0000-4000-8000-000000000001'),
  1,
  'retry nie duplikuje decyzji'
);

select lives_ok(
  $$
    select public.sync_self_rule_candidates(
      jsonb_build_array(jsonb_build_object(
        'rule_type', 'friction',
        'subject_habit_id', 'b3100000-0000-4000-8000-000000000001',
        'preferred_value', 'no_time',
        'comparison_value', null,
        'preferred_completed', 0, 'preferred_opportunities', 3,
        'comparison_completed', 0, 'comparison_opportunities', 0,
        'range_start', (select logical_day from w3_test_context) - 10,
        'range_end', (select logical_day from w3_test_context) - 1
      )), (select logical_day from w3_test_context)
    )
  $$,
  'zamknięty wzorzec tarcia tworzy osobnego kandydata'
);
select lives_ok(
  $$
    select public.decide_self_rule(
      (select id from public.self_rules where rule_type = 'friction'), 'reject',
      (select logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000005'
    )
  $$,
  'użytkownik może odrzucić kandydata'
);
select is(
  (select status from public.self_rules where rule_type = 'friction'),
  'rejected',
  'odrzucona reguła zachowuje jawny status'
);

select lives_ok(
  $$
    select public.sync_self_rule_candidates(
      jsonb_build_array(jsonb_build_object(
        'rule_type', 'time_of_day',
        'subject_habit_id', 'b3100000-0000-4000-8000-000000000001',
        'preferred_value', 'morning', 'comparison_value', 'evening',
        'preferred_completed', 6, 'preferred_opportunities', 6,
        'comparison_completed', 1, 'comparison_opportunities', 6,
        'range_start', (select logical_day from w3_test_context) - 14,
        'range_end', (select logical_day from w3_test_context) - 1
      )), (select logical_day from w3_test_context)
    )
  $$,
  'sprzeczne nowe dane uruchamiają rewaluację'
);
select ok(
  (select review_required_at is not null from public.self_rules
   where rule_type = 'time_of_day'),
  'zaakceptowana reguła jest oznaczona do ponownego sprawdzenia'
);
select is(
  (select evidence_snapshot ->> 'preferred_value' from public.self_rules
   where rule_type = 'time_of_day'),
  'evening',
  'sprzeczność nie nadpisuje pierwotnego evidence'
);
select is(
  (select count(*)::integer from public.self_rule_events
   where event_type = 'review_required'),
  1,
  'nowy snapshot trafia do osobnego zdarzenia rewaluacji'
);
select lives_ok(
  $$
    select public.decide_self_rule(
      (select id from public.self_rules where rule_type = 'time_of_day'), 'review_keep',
      (select logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000002'
    )
  $$,
  'użytkownik świadomie potwierdza regułę po rewaluacji'
);
select ok(
  (select review_required_at is null and status = 'accepted'
   from public.self_rules where rule_type = 'time_of_day'),
  'ponowne sprawdzenie zachowuje status i czyści znacznik'
);

select lives_ok(
  $$
    select public.set_self_rule_archived(
      (select id from public.self_rules where rule_type = 'time_of_day'), true,
      (select logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000003'
    )
  $$,
  'prywatną regułę można usunąć miękko'
);
select ok(
  (select archived_at is not null from public.self_rules
   where rule_type = 'time_of_day'),
  'soft delete zachowuje audyt'
);

select throws_like(
  $$
    insert into public.self_rules (
      user_id, rule_key, rule_type, subject_habit_id, algorithm_version,
      conclusion_key, evidence_snapshot, evidence_hash, sample_size,
      range_start, range_end, reevaluate_on
    ) values (
      (select auth.uid()), 'fake:key', 'friction',
      'b3100000-0000-4000-8000-000000000001', 'fake', 'forgot', '{}'::jsonb,
      md5('fake'), 3, current_date - 3, current_date - 1, current_date + 30
    )
  $$,
  '%permission denied for table self_rules%',
  'klient nie może ominąć RPC bezpośrednim insertem'
);
select throws_like(
  $$ update public.self_rule_events set event_type = 'accepted' $$,
  '%permission denied for table self_rule_events%',
  'audyt jest append-only dla klienta'
);

select set_config('request.jwt.claim.sub', 'b3400000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.self_rules), 0, 'RLS izoluje reguły');
select is((select count(*)::integer from public.self_rule_events), 0, 'RLS izoluje audyt child table');
select throws_ok(
  $$
    select public.decide_self_rule(
      (select id from public.self_rules), 'accept',
      (select other_logical_day from w3_test_context),
      'b3200000-0000-4000-8000-000000000004'
    )
  $$,
  'P0002',
  'decide_self_rule: rule not found',
  'RPC nie pozwala zdecydować o cudzej regule'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
delete from auth.users where id = 'b3400000-0000-4000-8000-000000000001';
select is(
  (
    select
      (select count(*) from public.self_rules
       where user_id = 'b3400000-0000-4000-8000-000000000001')
      +
      (select count(*) from public.self_rule_events
       where user_id = 'b3400000-0000-4000-8000-000000000001')
  )::integer,
  0,
  'usunięcie konta obejmuje reguły i ich dowody'
);

select * from finish();
rollback;
