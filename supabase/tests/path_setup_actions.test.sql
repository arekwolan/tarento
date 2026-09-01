begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b3900000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'p9-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b3900000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'p9-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

-- Testowa ścieżka B1 dostaje po jednym setupie na etap. Para z ordinalami
-- zachowuje istniejący constraint provenance prywatnych propozycji.
update public.path_stages
set environment_setup = case ordinal
      when 1 then 'Połóż notes na biurku.'
      when 2 then 'Otwórz notes na pustej stronie.'
      else 'Przygotuj długopis obok notesu.'
    end,
    environment_setup_note_ordinals = array[1]::smallint[]
where path_id = 'b1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3900000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001', false, current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'zapis materializuje setupy razem z praktykami'
);

select is(
  (select count(*)::integer from public.path_setup_actions),
  3,
  'każdy etap ma najwyżej jeden osobny setup enrollmentu'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'w pierwszej dobie widać pending bieżącego etapu'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'ponowne otwarcie tego samego dnia nie duplikuje i nie ukrywa setupu'
);

select ok(
  (
    select title = 'Połóż notes na biurku.'
      and explanation is null
      and sort_order = 1
      and status = 'pending'
    from public.get_today_path_setup_actions(current_date)
  ),
  'setup ma tytuł, opcjonalne wyjaśnienie, kolejność i jawny status'
);

select throws_ok(
  $$ update public.path_setup_actions set status = 'completed' $$,
  '42501',
  'permission denied for table path_setup_actions',
  'klient nie może ominąć RPC bezpośrednią mutacją'
);

select lives_ok(
  $$
    insert into public.habit_logs (
      habit_id, user_id, log_date, status, target_value, value_completed
    )
    select habit.id, habit.user_id, current_date, 'done', habit.start_value,
           habit.start_value
    from public.habits habit
    where habit.user_id = 'b3900000-0000-4000-8000-000000000001'
      and habit.source_stage_id = 'b1100000-0000-4000-8000-000000000001'
    limit 1
  $$,
  'praktykę można wykonać mimo pending setupu'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'wykonanie praktyki nie rozstrzyga setupu automatycznie'
);

select results_eq(
  $$
    select * from public.get_habit_streak(
      (select id from public.habits
       where source_stage_id = 'b1100000-0000-4000-8000-000000000001'
         and user_id = 'b3900000-0000-4000-8000-000000000001'
       limit 1)
    )
  $$,
  $$ values (1, 1) $$,
  'seria pochodzi wyłącznie z logu praktyki'
);

select set_config(
  'test.p9_stats_before',
  (
    select md5(coalesce(jsonb_agg(to_jsonb(stats) order by stats.habit_id)::text, '[]'))
    from public.get_habit_stats(current_date) stats
  ),
  true
);

select lives_ok(
  $$
    select public.resolve_path_setup_action(
      (select id from public.get_today_path_setup_actions(current_date)),
      'completed',
      'b3910000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'ukończenie setupu zapisuje terminalną decyzję'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  0,
  'ukończony setup znika na stałe z Dzisiaj'
);

select lives_ok(
  $$
    select public.resolve_path_setup_action(
      (select id from public.path_setup_actions
       where stage_id = 'b1100000-0000-4000-8000-000000000001'),
      'completed',
      'b3910000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'retry offline z tym samym request id jest idempotentny'
);

select is(
  (
    select count(*)::integer from public.path_setup_actions
    where stage_id = 'b1100000-0000-4000-8000-000000000001'
      and status = 'completed'
  ),
  1,
  'retry nie tworzy drugiego setupu ani logu decyzji'
);

select is(
  (select count(*)::integer from public.habit_logs),
  1,
  'ukończenie setupu nie tworzy habit logu'
);

select results_eq(
  $$
    select * from public.get_habit_streak(
      (select id from public.habits
       where source_stage_id = 'b1100000-0000-4000-8000-000000000001'
         and user_id = 'b3900000-0000-4000-8000-000000000001'
       limit 1)
    )
  $$,
  $$ values (1, 1) $$,
  'ukończenie setupu nie zwiększa serii'
);

select is(
  (
    select md5(coalesce(jsonb_agg(to_jsonb(stats) order by stats.habit_id)::text, '[]'))
    from public.get_habit_stats(current_date) stats
  ),
  current_setting('test.p9_stats_before'),
  'ukończenie setupu nie zmienia statystyk ani adherence'
);

select lives_ok(
  $$
    select public.advance_path_stage(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'przejście etapu aktywuje zwykły lifecycle kolejnego etapu'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'setup nowego etapu pojawia się przed jego praktyką'
);

select is(
  (select title from public.get_today_path_setup_actions(current_date)),
  'Otwórz notes na pustej stronie.',
  'Dzisiaj pokazuje setup wyłącznie bieżącego etapu'
);

select lives_ok(
  $$
    select public.resolve_path_setup_action(
      (select id from public.get_today_path_setup_actions(current_date)),
      'dismissed',
      'b3910000-0000-4000-8000-000000000002',
      current_date
    )
  $$,
  'użytkownik może odrzucić jednorazowe przygotowanie'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  0,
  'dismiss usuwa kartę bez powrotu'
);

select is(
  (select count(*)::integer from public.habit_logs where status = 'skipped'),
  0,
  'dismiss nie jest porażką ani pominięciem praktyki'
);

select lives_ok(
  $$
    select public.advance_path_stage(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000002',
      current_date
    )
  $$,
  'kolejny etap nadal działa po dismiss'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'trzeci etap ma własny pending setup'
);

select lives_ok(
  $$
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'completed', true
    )
  $$,
  'zakończenie ścieżki rozlicza setupy bez osobnego przepływu'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  0,
  'po zakończeniu ścieżki żaden setup nie wraca na Dzisiaj'
);

select ok(
  (
    select archived_at is not null and status = 'pending'
    from public.path_setup_actions
    where stage_id = 'b1100000-0000-4000-8000-000000000003'
  ),
  'pending na końcu ścieżki jest archiwizowany, nie zaliczany ani przenoszony'
);

select set_config(
  'test.p9_user_one_action',
  (
    select id::text from public.path_setup_actions
    where stage_id = 'b1100000-0000-4000-8000-000000000001'
  ),
  true
);

select set_config('request.jwt.claim.sub', 'b3900000-0000-4000-8000-000000000002', true);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001', false, current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":"","setupSkip":["b1100000-0000-4000-8000-000000000002"]}'::jsonb
    )
  $$,
  'preview może zapisać usunięty setup przyszłego etapu'
);

select is(
  (select count(*)::integer from public.path_setup_actions),
  3,
  'RLS pokazuje drugiemu użytkownikowi tylko jego trzy setupy'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  1,
  'drugi enrollment ma własny pierwszy setup'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date + 1)),
  0,
  'pending nie wraca po pierwszej logicznej dobie etapu'
);

select lives_ok(
  $$
    select public.advance_path_stage(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'etap można zmienić bez rozstrzygania informacyjnego setupu'
);

select ok(
  (
    select archived_at is not null and status = 'pending'
    from public.path_setup_actions
    where stage_id = 'b1100000-0000-4000-8000-000000000001'
  ),
  'pending opuszczonego etapu jest jawnie archiwizowany'
);

select is(
  (
    select status from public.path_setup_actions
    where stage_id = 'b1100000-0000-4000-8000-000000000002'
  ),
  'dismissed',
  'setup usunięty w preview nie aktywuje się później'
);

select is(
  (select count(*)::integer from public.get_today_path_setup_actions(current_date)),
  0,
  'odrzucony setup etapu nie pojawia się na Dzisiaj'
);

select throws_ok(
  format(
    'select public.resolve_path_setup_action(%L::uuid, %L, %L::uuid, current_date)',
    current_setting('test.p9_user_one_action'),
    'completed',
    'b3910000-0000-4000-8000-000000000003'
  ),
  'P0002',
  'resolve_path_setup_action: brak akcji',
  'drugi użytkownik nie może rozstrzygnąć cudzego setupu'
);

select lives_ok(
  $$ select public.delete_user_account() $$,
  'usunięcie konta obejmuje setupy enrollmentu'
);

reset role;

select is(
  (
    select count(*)::integer from public.path_setup_actions
    where user_id = 'b3900000-0000-4000-8000-000000000002'
  ),
  0,
  'account delete fizycznie usuwa prywatne setupy przez cascade'
);

select * from finish();
rollback;
