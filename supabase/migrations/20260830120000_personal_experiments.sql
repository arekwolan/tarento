-- Osobisty eksperyment A/B dla jednego istniejącego nawyku.
--
-- To nie jest test naukowy: wariant A zawsze poprzedza B, oba bloki są małe,
-- a wynik jest wyłącznie opisem wykonanych i oczekiwanych okazji. Jednostką
-- porównania jest planned z day_plan; rest, quiet week i overflow są neutralne.

-- Zmiany wykonywane przez eksperyment są normalnymi, append-only rewizjami.
alter table public.habit_revisions
  drop constraint habit_revisions_source_check,
  add constraint habit_revisions_source_check check (
    source in (
      'user', 'downshift', 'path', 'calibration', 'reentry', 'restore',
      'day_fit', 'experiment'
    )
  );

alter table public.habit_revisions
  drop constraint habit_revisions_reason_check,
  add constraint habit_revisions_reason_check check (
    reason in (
      'initial_snapshot',
      'created',
      'user_edit',
      'difficult_period',
      'path_materialized',
      'path_stage',
      'path_pause',
      'path_end',
      'time_calibration',
      'reentry',
      'reentry_complete',
      'retired',
      'restored',
      'archived',
      'rollback',
      'day_fit',
      'experiment_a',
      'experiment_b',
      'experiment_pause',
      'experiment_resume',
      'experiment_cancel',
      'experiment_choice'
    )
  );

create table public.personal_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  hypothesis text not null
    check (hypothesis in ('time_of_day', 'target_size')),
  state text not null default 'draft'
    check (state in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  current_block text check (current_block in ('a', 'b')),
  opportunity_target smallint not null default 7
    check (opportunity_target between 3 and 14),
  original_snapshot jsonb not null
    check (jsonb_typeof(original_snapshot) = 'object'),
  variant_a jsonb not null check (jsonb_typeof(variant_a) = 'object'),
  variant_b jsonb not null check (jsonb_typeof(variant_b) = 'object'),
  reminder_opt_in boolean not null default false,
  planned_a_start date not null,
  planned_a_end date not null,
  planned_b_start date not null,
  planned_b_end date not null,
  block_started_on date,
  a_expected integer not null default 0 check (a_expected between 0 and 14),
  a_completed integer not null default 0
    check (a_completed between 0 and a_expected),
  b_expected integer not null default 0 check (b_expected between 0 and 14),
  b_completed integer not null default 0
    check (b_completed between 0 and b_expected),
  paused_on date,
  started_on date,
  completed_on date,
  cancelled_on date,
  decision text check (decision in ('a', 'b', 'original')),
  decided_on date,
  create_idempotency_key uuid not null,
  transition_idempotency_key uuid not null default gen_random_uuid(),
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_experiments_plan_order check (
    planned_a_start <= planned_a_end
    and planned_a_end < planned_b_start
    and planned_b_start <= planned_b_end
  ),
  constraint personal_experiments_runtime_shape check (
    (state = 'draft' and current_block is null and block_started_on is null)
    or (state in ('active', 'paused') and current_block is not null)
    or (state in ('completed', 'cancelled'))
  ),
  constraint personal_experiments_pause_shape check (
    (state = 'paused' and paused_on is not null)
    or (state <> 'paused' and paused_on is null)
  ),
  constraint personal_experiments_decision_shape check (
    (decision is null and decided_on is null)
    or (state = 'completed' and decision is not null and decided_on is not null)
  ),
  unique (user_id, create_idempotency_key)
);

comment on table public.personal_experiments is
  'Dwa kolejne, nierandomizowane bloki jednego nawyku. Wynik jest opisowy, bez wniosków przyczynowych.';
comment on column public.personal_experiments.original_snapshot is
  'Pełny snapshot sprzed startu. Anulowanie i wybór original przywracają wyłącznie badaną cechę oraz jawnie zaakceptowane przypomnienie.';
comment on column public.personal_experiments.variant_a is
  'Wąski patch jednej cechy: time_of_day albo start_value; reminder_time występuje tylko po opt-in.';
comment on column public.personal_experiments.a_expected is
  'Zmaterializowane okazje z zamkniętych fragmentów bloku, np. sprzed pauzy. Bieżący fragment jest doliczany przy odczycie.';

-- Draft, aktywny, pauza i ukończony eksperyment czekający na decyzję są jedną
-- otwartą pracą. Zamknięte wyniki nie blokują następnego eksperymentu.
create unique index personal_experiments_one_open_idx
  on public.personal_experiments (user_id)
  where state in ('draft', 'active', 'paused')
     or (state = 'completed' and decision is null);

create index personal_experiments_habit_created_idx
  on public.personal_experiments (user_id, habit_id, created_at desc);

create trigger personal_experiments_set_updated_at
  before update on public.personal_experiments
  for each row execute function public.set_updated_at();

-- Każda komenda zmieniająca stan ma osobny klucz retry. Wiersz jest audytem
-- i jednocześnie ochroną przed dwukrotnym wykonaniem po odtworzeniu offline.
create table public.personal_experiment_commands (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null
    references public.personal_experiments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (
    action in (
      'start', 'pause', 'resume', 'cancel',
      'choose_a', 'choose_b', 'choose_original'
    )
  ),
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index personal_experiment_commands_experiment_idx
  on public.personal_experiment_commands (experiment_id, created_at);

alter table public.personal_experiments enable row level security;

create policy "personal_experiments_select_own"
  on public.personal_experiments for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.personal_experiment_commands enable row level security;

create policy "personal_experiment_commands_select_own"
  on public.personal_experiment_commands for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE/DELETE nie są dostępne bezpośrednio. Zapis przechodzi przez
-- atomowe RPC, które razem zmienia eksperyment, nawyk i habit_revisions.
revoke all on public.personal_experiments from anon, authenticated;
grant all on public.personal_experiments to service_role;
grant select on public.personal_experiments to authenticated;

revoke all on public.personal_experiment_commands from anon, authenticated;
grant all on public.personal_experiment_commands to service_role;
grant select on public.personal_experiment_commands to authenticated;

-- Forecast planu -----------------------------------------------------------

create or replace function public.personal_experiment_forecast_dates(
  p_user_id uuid,
  p_habit_id uuid,
  p_from date,
  p_count integer
)
returns table (ordinal integer, opportunity_on date)
language sql
stable
security definer
set search_path = ''
as $$
  with habit as (
    select h.*
    from public.habits h
    where h.id = p_habit_id
      and h.user_id = p_user_id
      and h.archived_at is null
      and h.retired_at is null
  ),
  candidates as (
    select p_from + offsets.value as day
    from generate_series(0, 90) offsets(value)
    cross join habit h
    left join public.day_plans plan
      on plan.user_id = p_user_id and plan.plan_date = p_from + offsets.value
    left join public.day_plan_items item
      on item.day_plan_id = plan.id and item.habit_id = p_habit_id
    where public.habit_is_scheduled_on(
        h.schedule_type, h.schedule_days, p_from + offsets.value
      )
      and not public.day_is_rest(p_user_id, p_from + offsets.value)
      and not public.day_is_quiet(p_user_id, p_from + offsets.value)
      and (
        plan.id is null
        or (
          not plan.is_rest
          and not plan.is_quiet_week
          and item.plan_state = 'planned'
        )
      )
    order by p_from + offsets.value
    limit greatest(p_count, 0)
  )
  select row_number() over (order by day)::integer, day::date
  from candidates;
$$;

revoke all on function public.personal_experiment_forecast_dates(
  uuid, uuid, date, integer
) from public;

-- Konflikt obejmuje dwie automatyczne zmiany praktyki ścieżki: koniec
-- reentry oraz najpóźniejszy dzień bieżącego etapu. Odległy etap nie blokuje.
create or replace function public.personal_experiment_has_path_conflict(
  p_user_id uuid,
  p_habit_id uuid,
  p_until date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_path_practices link
    join public.user_paths user_path on user_path.id = link.user_path_id
    join public.path_stages stage on stage.id = user_path.current_stage_id
    where link.user_id = p_user_id
      and link.habit_id = p_habit_id
      and link.retired_on is null
      and user_path.state = 'active'
      and (
        (
          user_path.reentry_until is not null
          and user_path.reentry_until between public.logical_today(p_user_id) and p_until
        )
        or user_path.stage_entered_on + stage.max_days <= p_until
      )
  );
$$;

revoke all on function public.personal_experiment_has_path_conflict(
  uuid, uuid, date
) from public;

-- Rzeczywiste okazje -------------------------------------------------------

-- Dla dnia ze snapshotem liczy się wyłącznie planned. W przeciwieństwie do
-- statystyk ogólnych wykonany overflow NIE staje się okazją eksperymentu.
-- Dla zamkniętego dnia bez snapshotu obowiązuje harmonogramowy fallback.
create or replace function public.personal_experiment_period_counts(
  p_user_id uuid,
  p_habit_id uuid,
  p_original_snapshot jsonb,
  p_from date,
  p_to date,
  p_limit integer
)
returns table (expected integer, completed integer, last_opportunity_on date)
language sql
stable
security definer
set search_path = ''
as $$
  with dates as (
    select p_from + offsets.value as day
    from generate_series(0, greatest(p_to - p_from, -1)) offsets(value)
    where p_to >= p_from and p_limit > 0
  ),
  outcomes as (
    select
      d.day,
      (log.status in ('done', 'partial')) as completed
    from dates d
    join public.day_plans plan
      on plan.user_id = p_user_id and plan.plan_date = d.day
    join public.day_plan_items item
      on item.day_plan_id = plan.id and item.habit_id = p_habit_id
    left join public.habit_logs log
      on log.habit_id = p_habit_id and log.log_date = d.day
    where item.plan_state = 'planned'
      and not plan.is_rest
      and not plan.is_quiet_week

    union all

    select
      d.day,
      (log.status in ('done', 'partial')) as completed
    from dates d
    left join public.habit_logs log
      on log.habit_id = p_habit_id and log.log_date = d.day
    where d.day < public.logical_today(p_user_id)
      and not exists (
        select 1 from public.day_plans plan
        where plan.user_id = p_user_id and plan.plan_date = d.day
      )
      and public.habit_is_scheduled_on(
        p_original_snapshot ->> 'schedule_type',
        case
          when p_original_snapshot -> 'schedule_days' is null
            or p_original_snapshot -> 'schedule_days' = 'null'::jsonb then null
          else array(
            select value::smallint
            from jsonb_array_elements_text(
              p_original_snapshot -> 'schedule_days'
            ) value
          )
        end,
        d.day
      )
      and not public.day_is_rest(p_user_id, d.day)
      and not public.day_is_quiet(p_user_id, d.day)
  ),
  limited as (
    select * from outcomes order by day limit greatest(p_limit, 0)
  )
  select
    count(*)::integer,
    count(*) filter (where completed)::integer,
    max(day)
  from limited;
$$;

revoke all on function public.personal_experiment_period_counts(
  uuid, uuid, jsonb, date, date, integer
) from public;

create or replace function public.personal_experiment_counts(
  p_experiment_id uuid,
  p_block text,
  p_through date
)
returns table (expected integer, completed integer, last_opportunity_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_experiment public.personal_experiments%rowtype;
  v_stored_expected integer;
  v_stored_completed integer;
  v_live_expected integer := 0;
  v_live_completed integer := 0;
  v_last date;
begin
  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.id = p_experiment_id;

  if not found or p_block not in ('a', 'b') then
    return query select 0, 0, null::date;
    return;
  end if;

  if p_block = 'a' then
    v_stored_expected := v_experiment.a_expected;
    v_stored_completed := v_experiment.a_completed;
  else
    v_stored_expected := v_experiment.b_expected;
    v_stored_completed := v_experiment.b_completed;
  end if;

  if v_experiment.current_block = p_block
     and v_experiment.block_started_on is not null
     and v_experiment.state in ('active', 'paused') then
    select period.expected, period.completed, period.last_opportunity_on
    into v_live_expected, v_live_completed, v_last
    from public.personal_experiment_period_counts(
      v_experiment.user_id,
      v_experiment.habit_id,
      v_experiment.original_snapshot,
      v_experiment.block_started_on,
      case
        when v_experiment.state = 'paused'
          then least(p_through, v_experiment.paused_on - 1)
        else p_through
      end,
      v_experiment.opportunity_target - v_stored_expected
    ) period;
  end if;

  return query select
    least(v_experiment.opportunity_target, v_stored_expected + coalesce(v_live_expected, 0)),
    v_stored_completed + coalesce(v_live_completed, 0),
    v_last;
end;
$$;

revoke all on function public.personal_experiment_counts(uuid, text, date)
  from public;

create or replace function public.personal_experiment_json(
  p_experiment_id uuid,
  p_through date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_experiment public.personal_experiments%rowtype;
  v_a record;
  v_b record;
begin
  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.id = p_experiment_id;

  if not found then return null; end if;

  select * into v_a
  from public.personal_experiment_counts(p_experiment_id, 'a', p_through);
  select * into v_b
  from public.personal_experiment_counts(p_experiment_id, 'b', p_through);

  return to_jsonb(v_experiment) || jsonb_build_object(
    'a_expected', coalesce(v_a.expected, v_experiment.a_expected),
    'a_completed', coalesce(v_a.completed, v_experiment.a_completed),
    'b_expected', coalesce(v_b.expected, v_experiment.b_expected),
    'b_completed', coalesce(v_b.completed, v_experiment.b_completed)
  );
end;
$$;

revoke all on function public.personal_experiment_json(uuid, date) from public;

-- Wąska zmiana nawyku z rewizją -------------------------------------------

create or replace function public.apply_personal_experiment_patch(
  p_experiment_id uuid,
  p_patch jsonb,
  p_reason text,
  p_effective_on date,
  p_idempotency_key uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_experiment public.personal_experiments%rowtype;
  v_habit public.habits%rowtype;
  v_start_value numeric;
  v_time_of_day text;
  v_reminder_time time;
  v_revision_number integer;
  v_fingerprint text := md5(
    p_experiment_id::text || '|' || p_patch::text || '|' || p_reason || '|'
    || p_effective_on::text
  );
begin
  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.id = p_experiment_id;

  select * into v_habit
  from public.habits habit
  where habit.id = v_experiment.habit_id
    and habit.user_id = v_experiment.user_id
  for update;

  if not found then
    raise exception 'personal_experiment: habit not found' using errcode = 'P0002';
  end if;

  if v_experiment.hypothesis = 'target_size' then
    if (select count(*) from jsonb_object_keys(p_patch)) <> 1
       or not (p_patch ? 'start_value') then
      raise exception 'personal_experiment: invalid target patch'
        using errcode = '22023';
    end if;
  elsif v_experiment.hypothesis = 'time_of_day' then
    if not (p_patch ? 'time_of_day')
       or exists (
         select 1 from jsonb_object_keys(p_patch) key
         where key not in ('time_of_day', 'reminder_time')
       )
       or ((p_patch ? 'reminder_time') <> v_experiment.reminder_opt_in) then
      raise exception 'personal_experiment: invalid time patch'
        using errcode = '22023';
    end if;
  end if;

  v_start_value := case
    when p_patch ? 'start_value' then (p_patch ->> 'start_value')::numeric
    else v_habit.start_value
  end;
  v_time_of_day := case
    when p_patch ? 'time_of_day' then p_patch ->> 'time_of_day'
    else v_habit.time_of_day
  end;
  v_reminder_time := case
    when p_patch ? 'reminder_time' then (p_patch ->> 'reminder_time')::time
    else v_habit.reminder_time
  end;

  if v_habit.start_value is not distinct from v_start_value
     and v_habit.time_of_day is not distinct from v_time_of_day
     and v_habit.reminder_time is not distinct from v_reminder_time then
    -- Końcowy wybór jest decyzją użytkownika także wtedy, gdy wybiera obecnie
    -- aktywne B. Zapisujemy ją jako pełnoprawną rewizję bez sztucznej zmiany
    -- parametru; retry nadal chroni unikalny klucz idempotencji.
    if p_reason = 'experiment_choice' and not exists (
      select 1 from public.habit_revisions revision
      where revision.habit_id = v_habit.id
        and revision.idempotency_key = p_idempotency_key
    ) then
      select coalesce(max(revision.revision_number), 0) + 1
      into v_revision_number
      from public.habit_revisions revision
      where revision.habit_id = v_habit.id;

      insert into public.habit_revisions (
        habit_id,
        user_id,
        revision_number,
        source,
        reason,
        effective_on,
        idempotency_key,
        request_fingerprint,
        before_snapshot,
        after_snapshot
      ) values (
        v_habit.id,
        v_habit.user_id,
        v_revision_number,
        'experiment',
        p_reason,
        p_effective_on,
        p_idempotency_key,
        v_fingerprint,
        public.habit_revision_snapshot(v_habit),
        public.habit_revision_snapshot(v_habit)
      );
    end if;
    return;
  end if;

  perform set_config('tarento.habit_revision_source', 'experiment', true);
  perform set_config('tarento.habit_revision_reason', p_reason, true);
  perform set_config('tarento.habit_revision_effective_on', p_effective_on::text, true);
  perform set_config(
    'tarento.habit_revision_idempotency_key', p_idempotency_key::text, true
  );
  perform set_config('tarento.habit_revision_restore_id', '', true);
  perform set_config('tarento.habit_revision_fingerprint', v_fingerprint, true);

  update public.habits habit
  set start_value = v_start_value,
      time_of_day = v_time_of_day,
      reminder_time = v_reminder_time
  where habit.id = v_habit.id;
end;
$$;

revoke all on function public.apply_personal_experiment_patch(
  uuid, jsonb, text, date, uuid
) from public;

-- Równoległa edycja badanej cechy z drugiego urządzenia unieważniłaby całe
-- porównanie. Pozostałe pola nawyku nadal można edytować; zablokowany jest
-- wyłącznie parametr hipotezy i jawnie dołączone przypomnienie.
create or replace function public.guard_personal_experiment_parameter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_experiment public.personal_experiments%rowtype;
  v_source text := nullif(
    current_setting('tarento.habit_revision_source', true), ''
  );
begin
  if v_source = 'experiment' then return new; end if;

  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.habit_id = new.id
    and (
      experiment.state in ('active', 'paused')
      or (experiment.state = 'completed' and experiment.decision is null)
    )
  limit 1;

  if not found then return new; end if;

  if (
    v_experiment.hypothesis = 'target_size'
    and old.start_value is distinct from new.start_value
  ) or (
    v_experiment.hypothesis = 'time_of_day'
    and (
      old.time_of_day is distinct from new.time_of_day
      or (
        v_experiment.reminder_opt_in
        and old.reminder_time is distinct from new.reminder_time
      )
    )
  ) then
    raise exception 'personal_experiment: tested setting locked'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger habits_guard_personal_experiment_parameter
  before update of start_value, time_of_day, reminder_time on public.habits
  for each row execute function public.guard_personal_experiment_parameter();

create or replace function public.personal_experiment_original_patch(
  p_experiment public.personal_experiments
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_experiment.hypothesis
    when 'target_size' then jsonb_build_object(
      'start_value', p_experiment.original_snapshot -> 'start_value'
    )
    else jsonb_build_object(
      'time_of_day', p_experiment.original_snapshot -> 'time_of_day'
    ) || case
      when p_experiment.reminder_opt_in then jsonb_build_object(
        'reminder_time', p_experiment.original_snapshot -> 'reminder_time'
      )
      else '{}'::jsonb
    end
  end;
$$;

revoke all on function public.personal_experiment_original_patch(
  public.personal_experiments
) from public;

-- Draft --------------------------------------------------------------------

create or replace function public.create_personal_experiment_draft(
  p_habit_id uuid,
  p_hypothesis text default null,
  p_a_time_of_day text default null,
  p_b_time_of_day text default null,
  p_a_target numeric default null,
  p_b_target numeric default null,
  p_reminder_opt_in boolean default false,
  p_today date default current_date,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_habit public.habits%rowtype;
  v_existing public.personal_experiments%rowtype;
  v_experiment public.personal_experiments%rowtype;
  v_original jsonb;
  v_variant_a jsonb;
  v_variant_b jsonb;
  v_dates date[];
  v_fingerprint text := md5(
    coalesce(p_habit_id::text, '') || '|' || coalesce(p_hypothesis, '') || '|'
    || coalesce(p_a_time_of_day, '') || '|' || coalesce(p_b_time_of_day, '') || '|'
    || coalesce(p_a_target::text, '') || '|' || coalesce(p_b_target::text, '') || '|'
    || coalesce(p_reminder_opt_in::text, '') || '|' || coalesce(p_today::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'personal_experiment: authentication required'
      using errcode = '28000';
  end if;

  select * into v_existing
  from public.personal_experiments experiment
  where experiment.user_id = v_user_id
    and experiment.create_idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'personal_experiment: idempotency key reused'
        using errcode = '22023';
    end if;
    return public.personal_experiment_json(v_existing.id, p_today);
  end if;

  if exists (
    select 1 from public.personal_experiments experiment
    where experiment.user_id = v_user_id
      and (
        experiment.state in ('draft', 'active', 'paused')
        or (experiment.state = 'completed' and experiment.decision is null)
      )
  ) then
    raise exception 'personal_experiment: another experiment open'
      using errcode = '23505';
  end if;

  select * into v_habit
  from public.habits habit
  where habit.id = p_habit_id
    and habit.user_id = v_user_id
    and habit.archived_at is null
    and habit.retired_at is null
  for update;

  if not found then
    raise exception 'personal_experiment: active habit not found'
      using errcode = 'P0002';
  end if;

  if public.day_is_quiet(v_user_id, p_today) then
    raise exception 'personal_experiment: quiet week'
      using errcode = '23514';
  end if;

  if p_hypothesis = 'time_of_day' then
    if p_a_time_of_day not in ('morning', 'afternoon', 'evening')
       or p_b_time_of_day not in ('morning', 'afternoon', 'evening')
       or p_a_time_of_day = p_b_time_of_day
       or p_a_target is not null
       or p_b_target is not null then
      raise exception 'personal_experiment: invalid time variants'
        using errcode = '22023';
    end if;

    if p_reminder_opt_in and v_habit.reminder_time is null then
      raise exception 'personal_experiment: reminder opt-in cannot enable reminder'
        using errcode = '23514';
    end if;

    v_variant_a := jsonb_build_object('time_of_day', p_a_time_of_day);
    v_variant_b := jsonb_build_object('time_of_day', p_b_time_of_day);

    if p_reminder_opt_in then
      v_variant_a := v_variant_a || jsonb_build_object(
        'reminder_time', case p_a_time_of_day
          when 'morning' then '08:00:00'
          when 'afternoon' then '14:00:00'
          else '20:00:00'
        end
      );
      v_variant_b := v_variant_b || jsonb_build_object(
        'reminder_time', case p_b_time_of_day
          when 'morning' then '08:00:00'
          when 'afternoon' then '14:00:00'
          else '20:00:00'
        end
      );
    end if;
  elsif p_hypothesis = 'target_size' then
    if p_a_target is null or p_b_target is null
       or p_a_target <= 0 or p_b_target <= 0
       or p_a_target = p_b_target
       or p_a_time_of_day is not null
       or p_b_time_of_day is not null
       or p_reminder_opt_in then
      raise exception 'personal_experiment: invalid target variants'
        using errcode = '22023';
    end if;

    v_variant_a := jsonb_build_object('start_value', p_a_target);
    v_variant_b := jsonb_build_object('start_value', p_b_target);
  else
    raise exception 'personal_experiment: invalid hypothesis'
      using errcode = '22023';
  end if;

  select array_agg(forecast.opportunity_on order by forecast.ordinal)
  into v_dates
  from public.personal_experiment_forecast_dates(
    v_user_id, p_habit_id, p_today, 14
  ) forecast;

  if coalesce(array_length(v_dates, 1), 0) < 14 then
    raise exception 'personal_experiment: not enough opportunities'
      using errcode = '23514';
  end if;

  if public.personal_experiment_has_path_conflict(
    v_user_id, p_habit_id, v_dates[14]
  ) then
    raise exception 'personal_experiment: path conflict'
      using errcode = '23514';
  end if;

  v_original := public.habit_revision_snapshot(v_habit);

  insert into public.personal_experiments (
    user_id,
    habit_id,
    hypothesis,
    original_snapshot,
    variant_a,
    variant_b,
    reminder_opt_in,
    planned_a_start,
    planned_a_end,
    planned_b_start,
    planned_b_end,
    create_idempotency_key,
    request_fingerprint
  ) values (
    v_user_id,
    p_habit_id,
    p_hypothesis,
    v_original,
    v_variant_a,
    v_variant_b,
    p_reminder_opt_in,
    v_dates[1],
    v_dates[7],
    v_dates[8],
    v_dates[14],
    p_idempotency_key,
    v_fingerprint
  )
  returning * into v_experiment;

  return public.personal_experiment_json(v_experiment.id, p_today);
end;
$$;

-- Synchronizacja bloków ----------------------------------------------------

create or replace function public.sync_personal_experiment(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_experiment public.personal_experiments%rowtype;
  v_counts record;
  v_b_start date;
begin
  if v_user_id is null then return null; end if;

  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.user_id = v_user_id
    and experiment.state = 'active'
  for update;

  if not found then return null; end if;

  if v_experiment.current_block = 'a' then
    select * into v_counts
    from public.personal_experiment_counts(v_experiment.id, 'a', p_today - 1);

    if v_counts.expected >= v_experiment.opportunity_target then
      -- Jeśli plan dzisiejszego dnia już istnieje, zachowuje snapshot A i B
      -- zaczyna się jutro. W przeciwnym razie B może bezpiecznie wejść dziś.
      v_b_start := case
        when exists (
          select 1 from public.day_plans plan
          where plan.user_id = v_user_id and plan.plan_date = p_today
        ) then p_today + 1
        else p_today
      end;

      update public.personal_experiments experiment
      set a_expected = v_counts.expected,
          a_completed = v_counts.completed,
          current_block = 'b',
          block_started_on = v_b_start
      where experiment.id = v_experiment.id
      returning * into v_experiment;

      perform public.apply_personal_experiment_patch(
        v_experiment.id,
        v_experiment.variant_b,
        'experiment_b',
        v_b_start,
        v_experiment.transition_idempotency_key
      );
    end if;
  end if;

  if v_experiment.current_block = 'b' and v_experiment.block_started_on <= p_today then
    select * into v_counts
    from public.personal_experiment_counts(v_experiment.id, 'b', p_today);

    if v_counts.expected >= v_experiment.opportunity_target then
      update public.personal_experiments experiment
      set b_expected = v_counts.expected,
          b_completed = v_counts.completed,
          state = 'completed',
          completed_on = coalesce(v_counts.last_opportunity_on, p_today)
      where experiment.id = v_experiment.id
      returning * into v_experiment;
    end if;
  end if;

  return public.personal_experiment_json(v_experiment.id, p_today);
end;
$$;

-- BEFORE pozwala przełączyć A -> B przed utworzeniem pozycji dnia. AFTER
-- domyka siódmą okazję B dopiero po poznaniu planned/overflow.
create or replace function public.sync_personal_experiment_for_day_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_personal_experiment(new.plan_date);
  return new;
end;
$$;

create trigger day_plans_sync_personal_experiment_before
  before insert or update on public.day_plans
  for each row execute function public.sync_personal_experiment_for_day_plan();

create trigger day_plans_sync_personal_experiment_after
  after insert or update on public.day_plans
  for each row execute function public.sync_personal_experiment_for_day_plan();

create or replace function public.sync_personal_experiment_for_day_plan_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_date date;
begin
  select plan.plan_date into v_plan_date
  from public.day_plans plan
  where plan.id = new.day_plan_id;

  if v_plan_date is not null then
    perform public.sync_personal_experiment(v_plan_date);
  end if;
  return new;
end;
$$;

-- Pozycje powstają po wierszu day_plans. Ten trigger widzi już ostateczne
-- planned/overflow i może domknąć siódmą okazję B tego samego dnia.
create trigger day_plan_items_sync_personal_experiment
  after insert or update of plan_state on public.day_plan_items
  for each row execute function public.sync_personal_experiment_for_day_plan_item();

-- Komendy użytkownika ------------------------------------------------------

create or replace function public.run_personal_experiment_action(
  p_experiment_id uuid,
  p_action text,
  p_today date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_experiment public.personal_experiments%rowtype;
  v_existing public.personal_experiment_commands%rowtype;
  v_counts record;
  v_patch jsonb;
  v_dates date[];
  v_needed integer;
  v_fingerprint text := md5(
    coalesce(p_experiment_id::text, '') || '|' || coalesce(p_action, '') || '|'
    || coalesce(p_today::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'personal_experiment: authentication required'
      using errcode = '28000';
  end if;

  if p_action not in (
    'start', 'pause', 'resume', 'cancel',
    'choose_a', 'choose_b', 'choose_original'
  ) then
    raise exception 'personal_experiment: invalid action'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.personal_experiment_commands command
  where command.user_id = v_user_id
    and command.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'personal_experiment: idempotency key reused'
        using errcode = '22023';
    end if;
    return public.personal_experiment_json(p_experiment_id, p_today);
  end if;

  select * into v_experiment
  from public.personal_experiments experiment
  where experiment.id = p_experiment_id
    and experiment.user_id = v_user_id
  for update;

  if not found then
    raise exception 'personal_experiment: experiment not found'
      using errcode = 'P0002';
  end if;

  select 0::integer as expected, 0::integer as completed into v_counts;

  if p_action = 'start' then
    if v_experiment.state <> 'draft' then
      raise exception 'personal_experiment: draft required'
        using errcode = '23514';
    end if;
    if public.day_is_quiet(v_user_id, p_today) then
      raise exception 'personal_experiment: quiet week'
        using errcode = '23514';
    end if;

    select array_agg(forecast.opportunity_on order by forecast.ordinal)
    into v_dates
    from public.personal_experiment_forecast_dates(
      v_user_id, v_experiment.habit_id, p_today, 14
    ) forecast;

    if coalesce(array_length(v_dates, 1), 0) < 14 then
      raise exception 'personal_experiment: not enough opportunities'
        using errcode = '23514';
    end if;
    if public.personal_experiment_has_path_conflict(
      v_user_id, v_experiment.habit_id, v_dates[14]
    ) then
      raise exception 'personal_experiment: path conflict'
        using errcode = '23514';
    end if;

    perform public.apply_personal_experiment_patch(
      v_experiment.id,
      v_experiment.variant_a,
      'experiment_a',
      p_today,
      p_idempotency_key
    );

    update public.personal_experiments experiment
    set state = 'active',
        current_block = 'a',
        block_started_on = p_today,
        started_on = p_today,
        planned_a_start = v_dates[1],
        planned_a_end = v_dates[7],
        planned_b_start = v_dates[8],
        planned_b_end = v_dates[14]
    where experiment.id = v_experiment.id
    returning * into v_experiment;

  elsif p_action = 'pause' then
    if v_experiment.state <> 'active' then
      raise exception 'personal_experiment: active required'
        using errcode = '23514';
    end if;

    select * into v_counts
    from public.personal_experiment_counts(
      v_experiment.id, v_experiment.current_block, p_today - 1
    );

    update public.personal_experiments experiment
    set state = 'paused',
        paused_on = p_today,
        a_expected = case when v_experiment.current_block = 'a'
          then v_counts.expected else experiment.a_expected end,
        a_completed = case when v_experiment.current_block = 'a'
          then v_counts.completed else experiment.a_completed end,
        b_expected = case when v_experiment.current_block = 'b'
          then v_counts.expected else experiment.b_expected end,
        b_completed = case when v_experiment.current_block = 'b'
          then v_counts.completed else experiment.b_completed end
    where experiment.id = v_experiment.id
    returning * into v_experiment;

    perform public.apply_personal_experiment_patch(
      v_experiment.id,
      public.personal_experiment_original_patch(v_experiment),
      'experiment_pause',
      p_today,
      p_idempotency_key
    );

  elsif p_action = 'resume' then
    if v_experiment.state <> 'paused' then
      raise exception 'personal_experiment: paused required'
        using errcode = '23514';
    end if;
    if public.day_is_quiet(v_user_id, p_today) then
      raise exception 'personal_experiment: quiet week'
        using errcode = '23514';
    end if;

    v_needed := case v_experiment.current_block
      when 'a' then
        (v_experiment.opportunity_target - v_experiment.a_expected)
        + v_experiment.opportunity_target
      else v_experiment.opportunity_target - v_experiment.b_expected
    end;
    select array_agg(forecast.opportunity_on order by forecast.ordinal)
    into v_dates
    from public.personal_experiment_forecast_dates(
      v_user_id, v_experiment.habit_id, p_today, v_needed
    ) forecast;

    if coalesce(array_length(v_dates, 1), 0) < v_needed then
      raise exception 'personal_experiment: not enough opportunities'
        using errcode = '23514';
    end if;
    if v_needed > 0 and public.personal_experiment_has_path_conflict(
      v_user_id, v_experiment.habit_id, v_dates[v_needed]
    ) then
      raise exception 'personal_experiment: path conflict'
        using errcode = '23514';
    end if;

    v_patch := case v_experiment.current_block
      when 'a' then v_experiment.variant_a
      else v_experiment.variant_b
    end;

    perform public.apply_personal_experiment_patch(
      v_experiment.id,
      v_patch,
      'experiment_resume',
      p_today,
      p_idempotency_key
    );

    update public.personal_experiments experiment
    set state = 'active',
        paused_on = null,
        block_started_on = p_today
    where experiment.id = v_experiment.id
    returning * into v_experiment;

  elsif p_action = 'cancel' then
    if v_experiment.state not in ('draft', 'active', 'paused') then
      raise exception 'personal_experiment: open experiment required'
        using errcode = '23514';
    end if;

    if v_experiment.state = 'active' then
      select * into v_counts
      from public.personal_experiment_counts(
        v_experiment.id, v_experiment.current_block, p_today - 1
      );
    end if;

    if v_experiment.state <> 'draft' then
      perform public.apply_personal_experiment_patch(
        v_experiment.id,
        public.personal_experiment_original_patch(v_experiment),
        'experiment_cancel',
        p_today,
        p_idempotency_key
      );
    end if;

    update public.personal_experiments experiment
    set state = 'cancelled',
        cancelled_on = p_today,
        paused_on = null,
        a_expected = case
          when v_experiment.state = 'active' and v_experiment.current_block = 'a'
            then v_counts.expected
          else experiment.a_expected
        end,
        a_completed = case
          when v_experiment.state = 'active' and v_experiment.current_block = 'a'
            then v_counts.completed
          else experiment.a_completed
        end,
        b_expected = case
          when v_experiment.state = 'active' and v_experiment.current_block = 'b'
            then v_counts.expected
          else experiment.b_expected
        end,
        b_completed = case
          when v_experiment.state = 'active' and v_experiment.current_block = 'b'
            then v_counts.completed
          else experiment.b_completed
        end
    where experiment.id = v_experiment.id
    returning * into v_experiment;

  else
    if v_experiment.state <> 'completed' or v_experiment.decision is not null then
      raise exception 'personal_experiment: completed decision required'
        using errcode = '23514';
    end if;

    if p_action = 'choose_a' then
      v_patch := v_experiment.variant_a;
    elsif p_action = 'choose_b' then
      v_patch := v_experiment.variant_b;
    else
      v_patch := public.personal_experiment_original_patch(v_experiment);
    end if;

    perform public.apply_personal_experiment_patch(
      v_experiment.id,
      v_patch,
      'experiment_choice',
      p_today,
      p_idempotency_key
    );

    update public.personal_experiments experiment
    set decision = case p_action
          when 'choose_a' then 'a'
          when 'choose_b' then 'b'
          else 'original'
        end,
        decided_on = p_today
    where experiment.id = v_experiment.id
    returning * into v_experiment;
  end if;

  insert into public.personal_experiment_commands (
    experiment_id, user_id, action, idempotency_key, request_fingerprint
  ) values (
    v_experiment.id, v_user_id, p_action, p_idempotency_key, v_fingerprint
  );

  return public.personal_experiment_json(v_experiment.id, p_today);
end;
$$;

-- Odczyt synchronizuje stan online, ale niczego nie udaje offline: wtedy
-- TanStack Query pokazuje ostatni persystowany snapshot i ponawia połączenie.
create or replace function public.get_personal_experiment(
  p_habit_id uuid,
  p_today date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'personal_experiment: authentication required'
      using errcode = '28000';
  end if;

  perform public.sync_personal_experiment(p_today);

  select experiment.id into v_id
  from public.personal_experiments experiment
  where experiment.user_id = v_user_id
    and experiment.habit_id = p_habit_id
  order by
    case
      when experiment.state in ('draft', 'active', 'paused') then 0
      when experiment.state = 'completed' and experiment.decision is null then 0
      else 1
    end,
    experiment.created_at desc
  limit 1;

  return case when v_id is null then null
    else public.personal_experiment_json(v_id, p_today)
  end;
end;
$$;

revoke all on function public.create_personal_experiment_draft(
  uuid, text, text, text, numeric, numeric, boolean, date, uuid
) from public;
grant execute on function public.create_personal_experiment_draft(
  uuid, text, text, text, numeric, numeric, boolean, date, uuid
) to authenticated, service_role;

revoke all on function public.sync_personal_experiment(date) from public;
grant execute on function public.sync_personal_experiment(date)
  to authenticated, service_role;

revoke all on function public.run_personal_experiment_action(
  uuid, text, date, uuid
) from public;
grant execute on function public.run_personal_experiment_action(
  uuid, text, date, uuid
) to authenticated, service_role;

revoke all on function public.get_personal_experiment(uuid, date) from public;
grant execute on function public.get_personal_experiment(uuid, date)
  to authenticated, service_role;
