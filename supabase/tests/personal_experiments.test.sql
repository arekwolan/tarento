begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b4000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'w4-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b4000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'w4-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4000000-0000-4000-8000-000000000001', true);

update public.profiles
set timezone = 'UTC', day_start_hour = 0, daily_ceiling = 6
where id = (select auth.uid());

select ok(
  (select relrowsecurity from pg_class where oid = 'public.personal_experiments'::regclass),
  'personal_experiments ma włączone RLS'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.personal_experiment_commands'::regclass),
  'komendy idempotencji mają włączone RLS'
);

insert into public.habits (
  id, user_id, title, unit, start_value, increment_value, progression_mode,
  schedule_type, reminder_time, time_of_day, started_on
) values
  (
    'b4100000-0000-4000-8000-000000000001',
    (select auth.uid()), 'Eksperyment celu', 'minutes', 5, 0, 'completion',
    'daily', '08:00', 'morning', current_date - 30
  ),
  (
    'b4100000-0000-4000-8000-000000000002',
    (select auth.uid()), 'Eksperyment pory', 'minutes', 5, 0, 'completion',
    'daily', null, 'morning', current_date - 60
  ),
  (
    'b4100000-0000-4000-8000-000000000003',
    (select auth.uid()), 'Kontrola okazji', 'minutes', 5, 0, 'completion',
    'daily', null, 'morning', current_date - 60
  );

select is(
  (
    public.create_personal_experiment_draft(
      'b4100000-0000-4000-8000-000000000001',
      'target_size', null, null, 5, 2, false, current_date - 14,
      'b4200000-0000-4000-8000-000000000001'
    ) ->> 'state'
  ),
  'draft',
  'utworzenie planu zapisuje stan draft'
);

select ok(
  (
    select planned_a_end - planned_a_start = 6
      and planned_b_end - planned_b_start = 6
    from public.personal_experiments
    where habit_id = 'b4100000-0000-4000-8000-000000000001'
  ),
  'plan zawiera dwa kolejne bloki po siedem codziennych okazji'
);

select is(
  (
    public.run_personal_experiment_action(
      (select id from public.personal_experiments
       where habit_id = 'b4100000-0000-4000-8000-000000000001'),
      'start', current_date - 14,
      'b4200000-0000-4000-8000-000000000002'
    ) ->> 'state'
  ),
  'active',
  'start uruchamia blok A'
);

select is(
  (select start_value from public.habits
   where id = 'b4100000-0000-4000-8000-000000000001'),
  5::numeric,
  'wariant A zachowuje zadany cel'
);

select lives_ok(
  $$
    select public.run_personal_experiment_action(
      (select id from public.personal_experiments
       where habit_id = 'b4100000-0000-4000-8000-000000000001'),
      'start', current_date - 14,
      'b4200000-0000-4000-8000-000000000002'
    )
  $$,
  'retry offline startu jest idempotentny'
);

select is(
  (select count(*)::integer from public.personal_experiment_commands
   where idempotency_key = 'b4200000-0000-4000-8000-000000000002'),
  1,
  'retry nie duplikuje komendy'
);

set local role service_role;

-- Cztery wykonania A są zapisane przed snapshotami planu; wynik po dołączeniu
-- day_plan_items nadal czyta dokładnie log danego dnia.
insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value, value_completed
)
select
  'b4100000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  current_date - 14 + offsets.value,
  'done', 5, 5
from generate_series(0, 3) offsets(value);

insert into public.day_plans (
  id, user_id, plan_date, daily_ceiling, minute_budget, timezone,
  day_start_hour, is_rest, is_quiet_week
)
select
  ('b4300000-0000-4000-8000-' || lpad((offsets.value + 1)::text, 12, '0'))::uuid,
  'b4000000-0000-4000-8000-000000000001',
  current_date - 14 + offsets.value,
  6, 60, 'UTC', 0, false, false
from generate_series(0, 6) offsets(value);

insert into public.day_plan_items (
  day_plan_id, user_id, habit_id, plan_state, reason, sort_order,
  target_value, estimated_minutes
)
select
  plan.id,
  plan.user_id,
  'b4100000-0000-4000-8000-000000000001',
  'planned', 'within_limit', 0, 5, 5
from public.day_plans plan
where plan.plan_date between current_date - 14 and current_date - 8
order by plan.plan_date;

set local role authenticated;
select public.sync_personal_experiment(current_date - 7);

select is(
  (select current_block from public.personal_experiments
   where habit_id = 'b4100000-0000-4000-8000-000000000001'),
  'b',
  'po siedmiu planned A następny logiczny dzień uruchamia B'
);

select ok(
  (
    select source = 'experiment' and reason = 'experiment_b'
    from public.habit_revisions
    where habit_id = 'b4100000-0000-4000-8000-000000000001'
    order by revision_number desc limit 1
  ),
  'przejście do B jest zwykłą rewizją z jawnym źródłem'
);

set local role service_role;

insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value, value_completed
)
select
  'b4100000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  current_date - 7 + offsets.value,
  'done', 2, 2
from generate_series(0, 5) offsets(value);

insert into public.day_plans (
  id, user_id, plan_date, daily_ceiling, minute_budget, timezone,
  day_start_hour, is_rest, is_quiet_week
)
select
  ('b4400000-0000-4000-8000-' || lpad((offsets.value + 1)::text, 12, '0'))::uuid,
  'b4000000-0000-4000-8000-000000000001',
  current_date - 7 + offsets.value,
  6, 60, 'UTC', 0, false, false
from generate_series(0, 6) offsets(value);

insert into public.day_plan_items (
  day_plan_id, user_id, habit_id, plan_state, reason, sort_order,
  target_value, estimated_minutes
)
select
  plan.id,
  plan.user_id,
  'b4100000-0000-4000-8000-000000000001',
  'planned', 'within_limit', 0, 2, 2
from public.day_plans plan
where plan.plan_date between current_date - 7 and current_date - 1
order by plan.plan_date;

set local role authenticated;
select public.sync_personal_experiment(current_date - 1);

select is(
  (select state from public.personal_experiments
   where habit_id = 'b4100000-0000-4000-8000-000000000001'),
  'completed',
  'siódma planned B domyka eksperyment'
);

select is(
  (
    select a_completed::text || '/' || a_expected::text
    from public.personal_experiments
    where habit_id = 'b4100000-0000-4000-8000-000000000001'
  ),
  '4/7',
  'wynik A zachowuje wykonane i oczekiwane'
);

select is(
  (
    select b_completed::text || '/' || b_expected::text
    from public.personal_experiments
    where habit_id = 'b4100000-0000-4000-8000-000000000001'
  ),
  '6/7',
  'wynik B zachowuje wykonane i oczekiwane'
);

select is(
  (
    public.run_personal_experiment_action(
      (select id from public.personal_experiments
       where habit_id = 'b4100000-0000-4000-8000-000000000001'),
      'choose_b', current_date,
      'b4200000-0000-4000-8000-000000000003'
    ) ->> 'decision'
  ),
  'b',
  'na końcu można jawnie wybrać B'
);

select is(
  (select start_value from public.habits
   where id = 'b4100000-0000-4000-8000-000000000001'),
  2::numeric,
  'wybór zwycięskiej wersji zostawia jej parametr'
);

select is(
  (select reason from public.habit_revisions
   where habit_id = 'b4100000-0000-4000-8000-000000000001'
   order by revision_number desc limit 1),
  'experiment_choice',
  'decyzja tworzy normalną rewizję'
);

select lives_ok(
  $$
    select public.run_personal_experiment_action(
      (select id from public.personal_experiments
       where habit_id = 'b4100000-0000-4000-8000-000000000001'),
      'choose_b', current_date,
      'b4200000-0000-4000-8000-000000000003'
    )
  $$,
  'retry wyboru po powrocie sieci nie wybiera drugi raz'
);

-- Przerwanie aktywnego eksperymentu przywraca wcześniejszą badaną wartość.
select public.create_personal_experiment_draft(
  'b4100000-0000-4000-8000-000000000001',
  'target_size', null, null, 2, 8, false, current_date,
  'b4200000-0000-4000-8000-000000000004'
);
select public.run_personal_experiment_action(
  (select id from public.personal_experiments
   where create_idempotency_key = 'b4200000-0000-4000-8000-000000000004'),
  'start', current_date,
  'b4200000-0000-4000-8000-000000000005'
);
select public.run_personal_experiment_action(
  (select id from public.personal_experiments
   where create_idempotency_key = 'b4200000-0000-4000-8000-000000000004'),
  'cancel', current_date,
  'b4200000-0000-4000-8000-000000000006'
);

select is(
  (select start_value from public.habits
   where id = 'b4100000-0000-4000-8000-000000000001'),
  2::numeric,
  'przerwanie przywraca konfigurację sprzed drugiego eksperymentu'
);

select lives_ok(
  $$
    select public.run_personal_experiment_action(
      (select id from public.personal_experiments
       where create_idempotency_key = 'b4200000-0000-4000-8000-000000000004'),
      'cancel', current_date,
      'b4200000-0000-4000-8000-000000000006'
    )
  $$,
  'retry przerwania jest idempotentny'
);

-- planned liczy się, wykonany overflow i planned w dniu rest nie liczą się.
set local role service_role;
insert into public.habit_logs (
  habit_id, user_id, log_date, status, target_value, value_completed
) values
  (
    'b4100000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    current_date - 40, 'done', 5, 5
  ),
  (
    'b4100000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    current_date - 39, 'done', 5, 5
  );

insert into public.day_plans (
  id, user_id, plan_date, daily_ceiling, minute_budget, timezone,
  day_start_hour, is_rest, is_quiet_week
) values
  (
    'b4500000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    current_date - 40, 6, 60, 'UTC', 0, false, false
  ),
  (
    'b4500000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    current_date - 39, 6, 60, 'UTC', 0, false, false
  ),
  (
    'b4500000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    current_date - 38, 6, 60, 'UTC', 0, true, false
  );

insert into public.day_plan_items (
  day_plan_id, user_id, habit_id, plan_state, reason, sort_order,
  target_value, estimated_minutes
) values
  (
    'b4500000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b4100000-0000-4000-8000-000000000003',
    'planned', 'within_limit', 0, 5, 5
  ),
  (
    'b4500000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'b4100000-0000-4000-8000-000000000003',
    'overflow', 'daily_ceiling', 0, 5, 5
  ),
  (
    'b4500000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    'b4100000-0000-4000-8000-000000000003',
    'planned', 'rest', 0, 5, 5
  );

reset role;
select is(
  (
    select expected from public.personal_experiment_period_counts(
      (select auth.uid()),
      'b4100000-0000-4000-8000-000000000003',
      public.habit_revision_snapshot(
        (select habit from public.habits habit
         where habit.id = 'b4100000-0000-4000-8000-000000000003')
      ),
      current_date - 40, current_date - 38, 7
    )
  ),
  1,
  'rest i overflow nie wchodzą do oczekiwanych okazji eksperymentu'
);

select is(
  (
    select completed from public.personal_experiment_period_counts(
      (select auth.uid()),
      'b4100000-0000-4000-8000-000000000003',
      public.habit_revision_snapshot(
        (select habit from public.habits habit
         where habit.id = 'b4100000-0000-4000-8000-000000000003')
      ),
      current_date - 40, current_date - 38, 7
    )
  ),
  1,
  'wykonany overflow nie poprawia wyniku bloku'
);

-- Brak opt-in zachowuje reminder; opt-in nie może go sam włączyć.
set local role authenticated;
select public.create_personal_experiment_draft(
  'b4100000-0000-4000-8000-000000000002',
  'time_of_day', 'morning', 'evening', null, null, false, current_date,
  'b4200000-0000-4000-8000-000000000007'
);

select ok(
  not (
    select variant_b ? 'reminder_time'
    from public.personal_experiments
    where create_idempotency_key = 'b4200000-0000-4000-8000-000000000007'
  ),
  'bez opt-in wariant nie zawiera zmiany przypomnienia'
);

select public.run_personal_experiment_action(
  (select id from public.personal_experiments
   where create_idempotency_key = 'b4200000-0000-4000-8000-000000000007'),
  'cancel', current_date,
  'b4200000-0000-4000-8000-000000000008'
);

select throws_ok(
  $$
    select public.create_personal_experiment_draft(
      'b4100000-0000-4000-8000-000000000002',
      'time_of_day', 'morning', 'evening', null, null, true, current_date,
      'b4200000-0000-4000-8000-000000000009'
    )
  $$,
  '23514',
  'personal_experiment: reminder opt-in cannot enable reminder',
  'eksperyment nigdy sam nie włącza przypomnienia'
);

-- Aktywna ścieżka z bliskim sufitem etapu blokuje plan na tym samym nawyku.
set local role service_role;
insert into public.paths (
  id, slug, version, title, hook, duration_days, language, is_published
) values (
  'b4600000-0000-4000-8000-000000000001',
  'w4-conflict', 1, 'Ścieżka testowa', 'Test', 30, 'pl', true
);
insert into public.path_stages (
  id, path_id, ordinal, name, description, daily_minutes_p50,
  min_days, max_days, completion_threshold
) values (
  'b4600000-0000-4000-8000-000000000002',
  'b4600000-0000-4000-8000-000000000001',
  1, 'Etap', 'Opis', 5, 1, 3, 0.5
);
insert into public.path_practices (
  id, stage_id, title, why, how, unit, schedule_type
) values (
  'b4600000-0000-4000-8000-000000000003',
  'b4600000-0000-4000-8000-000000000002',
  'Praktyka', 'Po co', 'Jak', 'minutes', 'daily'
);
insert into public.user_paths (
  id, user_id, path_id, state, current_stage_id, stage_entered_on, started_on
) values (
  'b4600000-0000-4000-8000-000000000004',
  'b4000000-0000-4000-8000-000000000001',
  'b4600000-0000-4000-8000-000000000001',
  'active', 'b4600000-0000-4000-8000-000000000002', current_date, current_date
);
insert into public.user_path_practices (
  user_path_id, practice_id, habit_id, user_id, activated_on
) values (
  'b4600000-0000-4000-8000-000000000004',
  'b4600000-0000-4000-8000-000000000003',
  'b4100000-0000-4000-8000-000000000003',
  'b4000000-0000-4000-8000-000000000001', current_date
);

reset role;
select ok(
  public.personal_experiment_has_path_conflict(
    (select auth.uid()),
    'b4100000-0000-4000-8000-000000000003',
    current_date + 14
  ),
  'bliska automatyczna zmiana ścieżki jest wykrywana'
);

set local role authenticated;
select throws_ok(
  $$
    select public.create_personal_experiment_draft(
      'b4100000-0000-4000-8000-000000000003',
      'target_size', null, null, 5, 3, false, current_date,
      'b4200000-0000-4000-8000-000000000010'
    )
  $$,
  '23514',
  'personal_experiment: path conflict',
  'konflikt ścieżki blokuje start planu'
);

set local role service_role;
update public.user_paths
set state = 'ended', ended_at = now(), ended_reason = 'completed'
where id = 'b4600000-0000-4000-8000-000000000004';
insert into public.quiet_weeks (user_id, started_on, ends_on)
values (
  'b4000000-0000-4000-8000-000000000001', current_date, current_date + 7
);
set local role authenticated;

select throws_ok(
  $$
    select public.create_personal_experiment_draft(
      'b4100000-0000-4000-8000-000000000003',
      'target_size', null, null, 5, 3, false, current_date,
      'b4200000-0000-4000-8000-000000000011'
    )
  $$,
  '23514',
  'personal_experiment: quiet week',
  'quiet week blokuje nowy eksperyment'
);

select set_config('request.jwt.claim.sub', 'b4000000-0000-4000-8000-000000000002', true);

select is(
  public.get_personal_experiment(
    'b4100000-0000-4000-8000-000000000001', current_date
  ),
  null::jsonb,
  'RLS i RPC nie ujawniają eksperymentu innemu użytkownikowi'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.personal_experiments', 'DELETE'
  ),
  'klient nie może fizycznie usunąć eksperymentu'
);

select * from finish();
rollback;
