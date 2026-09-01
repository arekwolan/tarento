begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'p0-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'p0-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

update public.profiles
set daily_ceiling = 3, timezone = 'Europe/Berlin', day_start_hour = 4
where id = (select auth.uid());

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, sort_order, started_on
)
select
  ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  (select auth.uid()),
  'Habit ' || n,
  'minutes', 5, 0, 'completion', 'daily', n,
  current_date
from generate_series(1, 5) as n;

select lives_ok(
  $$select public.ensure_day_plan(current_date)$$,
  'utworzenie planu nie zgłasza błędu'
);

select is(
  (select count(*)::integer from public.day_plans),
  1,
  'powstaje jeden plan dnia'
);

select is(
  (select count(*)::integer from public.day_plan_items),
  5,
  'snapshot zawiera pięć nawyków'
);

select is(
  (
    select count(*)::integer
    from public.day_plan_items
    where plan_state = 'planned'
  ),
  3,
  'limit 3 daje trzy planned'
);

select is(
  (
    select count(*)::integer
    from public.day_plan_items
    where plan_state = 'overflow'
  ),
  2,
  'dwie pozycje są neutralnym overflow'
);

insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value, value_completed
)
select
  i.habit_id, (select auth.uid()), p.plan_date, 'done',
  i.target_value, i.target_value
from public.day_plan_items i
join public.day_plans p on p.id = i.day_plan_id
where i.plan_state = 'overflow'
order by i.sort_order
limit 1;

select is(
  (
    select count(*)::integer
    from public.get_expected_habit_opportunities(
      current_date,
      current_date
    )
  ),
  4,
  'wykonane overflow dodaje pozytywną okazję bez długu za drugie overflow'
);

update public.profiles set daily_ceiling = 2 where id = (select auth.uid());
select public.ensure_day_plan(current_date);

select is(
  (
    select count(*)::integer
    from public.day_plan_items
    where plan_state = 'planned'
  ),
  2,
  'rekoncyliacja 3 do 2 zostawia dwa planned'
);

update public.profiles set daily_ceiling = 4 where id = (select auth.uid());
select public.ensure_day_plan(current_date);

select is(
  (
    select count(*)::integer
    from public.day_plan_items
    where plan_state = 'planned'
  ),
  4,
  'rekoncyliacja 2 do 4 promuje cztery nierozstrzygnięte pozycje'
);

select public.ensure_day_plan(current_date);
select public.ensure_day_plan(current_date);

select is(
  (select count(*)::integer from public.day_plan_items),
  5,
  'powtórzony retry nie duplikuje pozycji'
);

select public.upsert_habit_log_for_plan(
  i.habit_id,
  p.plan_date,
  'done',
  i.target_value,
  i.target_value,
  null
)
from public.day_plan_items i
join public.day_plans p on p.id = i.day_plan_id
where i.plan_state = 'planned'
order by i.sort_order
limit 1;

select public.upsert_habit_log_for_plan(
  i.habit_id,
  p.plan_date,
  'done',
  i.target_value,
  i.target_value,
  null
)
from public.day_plan_items i
join public.day_plans p on p.id = i.day_plan_id
where i.plan_state = 'planned'
order by i.sort_order
limit 1;

select is(
  (select count(*)::integer from public.habit_logs),
  2,
  'powtórzony replay logu offline jest idempotentny'
);

insert into public.rest_days (user_id, rest_date)
values ((select auth.uid()), current_date + 1);
select public.ensure_day_plan(current_date + 1);

select is(
  (
    select count(*)::integer
    from public.day_plan_items i
    join public.day_plans p on p.id = i.day_plan_id
    where p.plan_date = current_date + 1
      and i.plan_state = 'planned'
  ),
  0,
  'dzień odpoczynku nie ma expected planned'
);

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, sort_order, started_on
) values (
  '20000000-0000-0000-0000-999999999999',
  (select auth.uid()), 'Legacy habit', 'none', 1, 0, 'completion', 'daily', 99,
  current_date - 1
);

select is(
  (
    select scheduled
    from public.get_daily_summary(
      current_date - 1,
      current_date - 1
    )
  ),
  1,
  'stara data bez snapshotu używa kompatybilnego harmonogramu'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select is(
  (
    select count(*)::integer from public.day_plans
  ) + (
    select count(*)::integer from public.day_plan_items
  ),
  0,
  'RLS izoluje oba poziomy snapshotu między użytkownikami'
);

select * from finish();
rollback;
