-- W1: append-only historia definicji nawyku.
--
-- Trigger jest ostatnią linią obrony: obejmuje zarówno mutacje klienta, jak
-- i istniejące, wielowierszowe RPC ścieżek. Zmiana habits oraz rewizja żyją
-- w tej samej transakcji, więc nie istnieje stan „zmieniono bez historii”.

create table public.habit_revisions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  source text not null check (
    source in ('user', 'downshift', 'path', 'calibration', 'reentry', 'restore', 'day_fit')
  ),
  reason text not null check (
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
      'day_fit'
    )
  ),
  effective_on date not null,
  idempotency_key uuid not null,
  request_fingerprint text check (
    request_fingerprint is null or char_length(request_fingerprint) = 32
  ),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  restores_revision_id uuid references public.habit_revisions (id),
  created_at timestamptz not null default now(),
  unique (habit_id, revision_number),
  unique (habit_id, idempotency_key),
  constraint habit_revisions_before_object_check check (
    before_snapshot is null or jsonb_typeof(before_snapshot) = 'object'
  ),
  constraint habit_revisions_after_object_check check (
    jsonb_typeof(after_snapshot) = 'object'
  ),
  constraint habit_revisions_restore_check check (
    (reason = 'rollback' and restores_revision_id is not null)
    or (reason <> 'rollback' and restores_revision_id is null)
  )
);

comment on table public.habit_revisions is
  'Append-only wersje definicji nawyku. Log ukończenia nie tworzy rewizji.';
comment on column public.habit_revisions.effective_on is
  'Data logiczna, od której wersja obowiązuje; nie jest wyliczana z UTC.';
comment on column public.habit_revisions.request_fingerprint is
  'Hash treści RPC. Ten sam klucz idempotencji nie może oznaczać innej zmiany.';

create index habit_revisions_user_habit_created_idx
  on public.habit_revisions (user_id, habit_id, revision_number desc);
create index habit_revisions_habit_effective_idx
  on public.habit_revisions (habit_id, effective_on desc, revision_number desc);

alter table public.habit_revisions enable row level security;

create policy "habit_revisions_select_own"
  on public.habit_revisions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits habit
      where habit.id = habit_revisions.habit_id
        and habit.user_id = (select auth.uid())
    )
  );

-- Historia powstaje wyłącznie w triggerze. Klient nie może dopisywać,
-- poprawiać ani usuwać rewizji pod spodem.
revoke all on public.habit_revisions from anon, authenticated;
grant all on public.habit_revisions to service_role;
grant select on public.habit_revisions to authenticated;

-- Kanoniczny, ograniczony snapshot -----------------------------------------

create or replace function public.habit_revision_snapshot(p_habit public.habits)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'title', p_habit.title,
    'description', p_habit.description,
    'icon', p_habit.icon,
    'color', p_habit.color,
    'unit', p_habit.unit,
    'category', p_habit.category,
    'start_value', p_habit.start_value,
    'increment_value', p_habit.increment_value,
    'target_value', p_habit.target_value,
    'progression_mode', p_habit.progression_mode,
    'schedule_type', p_habit.schedule_type,
    'schedule_days', to_jsonb(p_habit.schedule_days),
    'reminder_time', case
      when p_habit.reminder_time is null then null
      else p_habit.reminder_time::text
    end,
    'time_of_day', p_habit.time_of_day,
    'source_book', p_habit.source_book,
    'source_author', p_habit.source_author,
    'source_path_id', p_habit.source_path_id,
    'source_stage_id', p_habit.source_stage_id,
    'retired', p_habit.retired_at is not null,
    'archived', p_habit.archived_at is not null
  );
$$;

comment on function public.habit_revision_snapshot(public.habits) is
  'Tylko pola potrzebne do czytelnego diffu i przywrócenia. Bez logów, promptów i sekretów.';

revoke all on function public.habit_revision_snapshot(public.habits) from public;
grant execute on function public.habit_revision_snapshot(public.habits)
  to authenticated, service_role;

-- Bezpieczna baza dla istniejących nawyków. To snapshot stanu w chwili
-- migracji, a nie próba odtworzenia zmian, których baza wcześniej nie znała.
insert into public.habit_revisions (
  habit_id,
  user_id,
  revision_number,
  source,
  reason,
  effective_on,
  idempotency_key,
  before_snapshot,
  after_snapshot
)
select
  habit.id,
  habit.user_id,
  1,
  case when habit.source_path_id is null then 'user' else 'path' end,
  'initial_snapshot',
  public.logical_today(habit.user_id),
  gen_random_uuid(),
  null,
  public.habit_revision_snapshot(habit)
from public.habits habit
where not exists (
  select 1 from public.habit_revisions revision
  where revision.habit_id = habit.id
);

-- Kontekst lifecycle ścieżki -----------------------------------------------

create or replace function public.set_habit_revision_context_from_user_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state = 'active' and new.state = 'paused' then
    perform set_config('tarento.habit_revision_source', 'path', true);
    perform set_config('tarento.habit_revision_reason', 'path_pause', true);
  elsif old.state = 'paused' and new.state = 'active' then
    perform set_config(
      'tarento.habit_revision_source',
      case when new.reentry_until is null then 'restore' else 'reentry' end,
      true
    );
    perform set_config(
      'tarento.habit_revision_reason',
      case when new.reentry_until is null then 'restored' else 'reentry' end,
      true
    );
  elsif old.reentry_until is not null and new.reentry_until is null then
    perform set_config('tarento.habit_revision_source', 'reentry', true);
    perform set_config('tarento.habit_revision_reason', 'reentry_complete', true);
  elsif old.state is distinct from new.state and new.state = 'ended' then
    perform set_config('tarento.habit_revision_source', 'path', true);
    perform set_config('tarento.habit_revision_reason', 'path_end', true);
  end if;

  return new;
end;
$$;

create trigger user_paths_set_habit_revision_context
  after update on public.user_paths
  for each row execute function public.set_habit_revision_context_from_user_path();

-- Trigger append-only ------------------------------------------------------

create or replace function public.capture_habit_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb := public.habit_revision_snapshot(new);
  v_source text := nullif(current_setting('tarento.habit_revision_source', true), '');
  v_reason text := nullif(current_setting('tarento.habit_revision_reason', true), '');
  v_effective_text text := nullif(
    current_setting('tarento.habit_revision_effective_on', true), ''
  );
  v_idempotency_text text := nullif(
    current_setting('tarento.habit_revision_idempotency_key', true), ''
  );
  v_restore_text text := nullif(
    current_setting('tarento.habit_revision_restore_id', true), ''
  );
  v_fingerprint text := nullif(
    current_setting('tarento.habit_revision_fingerprint', true), ''
  );
  v_number integer;
begin
  if tg_op = 'UPDATE' then
    v_before := public.habit_revision_snapshot(old);
    if v_before = v_after then
      return new;
    end if;
  end if;

  if v_source is null then
    if tg_op = 'INSERT' then
      v_source := case when new.source_path_id is null then 'user' else 'path' end;
    elsif old.retired_at is not null and new.retired_at is null then
      v_source := 'restore';
    elsif new.source_path_id is not null or old.source_path_id is not null then
      v_source := 'path';
    else
      v_source := 'user';
    end if;
  end if;

  if v_reason is null then
    if tg_op = 'INSERT' then
      v_reason := case
        when new.source_path_id is null then 'created'
        else 'path_materialized'
      end;
    elsif (old.archived_at is null) is distinct from (new.archived_at is null) then
      v_reason := case when new.archived_at is null then 'restored' else 'archived' end;
    elsif (old.retired_at is null) is distinct from (new.retired_at is null) then
      v_reason := case
        when new.retired_at is null then 'restored'
        when new.source_path_id is null then 'retired'
        else 'path_stage'
      end;
    elsif old.source_path_id is distinct from new.source_path_id
       or old.source_stage_id is distinct from new.source_stage_id then
      v_reason := 'path_end';
    elsif v_source = 'path' then
      v_reason := 'path_stage';
    else
      v_reason := 'user_edit';
    end if;
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_number
  from public.habit_revisions revision
  where revision.habit_id = new.id;

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
    after_snapshot,
    restores_revision_id
  ) values (
    new.id,
    new.user_id,
    v_number,
    v_source,
    v_reason,
    coalesce(v_effective_text::date, public.logical_today(new.user_id)),
    coalesce(v_idempotency_text::uuid, gen_random_uuid()),
    v_fingerprint,
    v_before,
    v_after,
    v_restore_text::uuid
  );

  return new;
end;
$$;

create trigger habits_capture_revision
  after insert or update on public.habits
  for each row execute function public.capture_habit_revision();

-- Atomowa edycja definicji -------------------------------------------------

create or replace function public.update_habit_with_revision(
  p_habit_id uuid,
  p_values jsonb,
  p_source text,
  p_reason text,
  p_effective_on date,
  p_idempotency_key uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_habit public.habits%rowtype;
  v_next public.habits%rowtype;
  v_result public.habits%rowtype;
  v_existing public.habit_revisions%rowtype;
  v_fingerprint text := md5(
    coalesce(p_values::text, '') || '|' || coalesce(p_source, '') || '|'
    || coalesce(p_reason, '') || '|' || coalesce(p_effective_on::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'update_habit_with_revision: authentication required'
      using errcode = '28000';
  end if;

  if jsonb_typeof(p_values) <> 'object'
     or p_source not in ('user', 'downshift', 'calibration', 'day_fit')
     or (p_source = 'user' and p_reason <> 'user_edit')
     or (p_source = 'downshift' and p_reason <> 'difficult_period')
     or (p_source = 'calibration' and p_reason <> 'time_calibration')
     or (p_source = 'day_fit' and p_reason <> 'day_fit')
     or exists (
       select 1
       from jsonb_object_keys(p_values) key
       where key not in (
         'title', 'description', 'icon', 'unit', 'category', 'start_value',
         'increment_value', 'target_value', 'progression_mode', 'schedule_type',
         'schedule_days', 'reminder_time', 'time_of_day', 'source_book',
         'source_author'
       )
     ) then
    raise exception 'update_habit_with_revision: invalid change'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.habit_revisions revision
  where revision.habit_id = p_habit_id
    and revision.user_id = v_user_id
    and revision.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'update_habit_with_revision: idempotency key reused'
        using errcode = '22023';
    end if;
    select * into v_result from public.habits habit
    where habit.id = p_habit_id and habit.user_id = v_user_id;
    return to_jsonb(v_result);
  end if;

  select * into v_habit
  from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id
  for update;

  if not found then
    raise exception 'update_habit_with_revision: habit not found'
      using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.habit_revisions revision
  where revision.habit_id = p_habit_id
    and revision.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'update_habit_with_revision: idempotency key reused'
        using errcode = '22023';
    end if;
    return to_jsonb(v_habit);
  end if;

  if p_expected_updated_at is not null
     and v_habit.updated_at is distinct from p_expected_updated_at then
    raise exception 'update_habit_with_revision: stale habit version'
      using errcode = '40001';
  end if;

  select * into v_next from jsonb_populate_record(v_habit, p_values);

  if public.habit_revision_snapshot(v_habit) = public.habit_revision_snapshot(v_next) then
    return to_jsonb(v_habit);
  end if;

  perform set_config('tarento.habit_revision_source', p_source, true);
  perform set_config('tarento.habit_revision_reason', p_reason, true);
  perform set_config('tarento.habit_revision_effective_on', p_effective_on::text, true);
  perform set_config(
    'tarento.habit_revision_idempotency_key', p_idempotency_key::text, true
  );
  perform set_config('tarento.habit_revision_restore_id', '', true);
  perform set_config('tarento.habit_revision_fingerprint', v_fingerprint, true);

  update public.habits habit
  set title = v_next.title,
      description = v_next.description,
      icon = v_next.icon,
      unit = v_next.unit,
      category = v_next.category,
      start_value = v_next.start_value,
      increment_value = v_next.increment_value,
      target_value = v_next.target_value,
      progression_mode = v_next.progression_mode,
      schedule_type = v_next.schedule_type,
      schedule_days = case
        when v_next.schedule_type = 'custom' then v_next.schedule_days
        else null
      end,
      reminder_time = v_next.reminder_time,
      time_of_day = v_next.time_of_day,
      source_book = v_next.source_book,
      source_author = v_next.source_author
  where habit.id = p_habit_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

-- Atomowy retirement/archive i ich cofnięcie ------------------------------

create or replace function public.set_habit_lifecycle_with_revision(
  p_habit_id uuid,
  p_state text,
  p_effective_on date,
  p_idempotency_key uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_habit public.habits%rowtype;
  v_result public.habits%rowtype;
  v_existing public.habit_revisions%rowtype;
  v_source text;
  v_reason text;
  v_fingerprint text := md5(
    coalesce(p_state, '') || '|' || coalesce(p_effective_on::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'set_habit_lifecycle_with_revision: authentication required'
      using errcode = '28000';
  end if;

  if p_state not in ('retired', 'active', 'archived', 'unarchived') then
    raise exception 'set_habit_lifecycle_with_revision: invalid state'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.habit_revisions revision
  where revision.habit_id = p_habit_id
    and revision.user_id = v_user_id
    and revision.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'set_habit_lifecycle_with_revision: idempotency key reused'
        using errcode = '22023';
    end if;
    select * into v_result from public.habits habit
    where habit.id = p_habit_id and habit.user_id = v_user_id;
    return to_jsonb(v_result);
  end if;

  select * into v_habit
  from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id
  for update;

  if not found then
    raise exception 'set_habit_lifecycle_with_revision: habit not found'
      using errcode = 'P0002';
  end if;

  if p_expected_updated_at is not null
     and v_habit.updated_at is distinct from p_expected_updated_at then
    raise exception 'set_habit_lifecycle_with_revision: stale habit version'
      using errcode = '40001';
  end if;

  if (p_state = 'retired' and v_habit.retired_at is not null)
     or (p_state = 'active' and v_habit.retired_at is null)
     or (p_state = 'archived' and v_habit.archived_at is not null)
     or (p_state = 'unarchived' and v_habit.archived_at is null) then
    return to_jsonb(v_habit);
  end if;

  v_source := case
    when p_state in ('active', 'unarchived') then 'restore'
    else 'user'
  end;
  v_reason := case p_state
    when 'retired' then 'retired'
    when 'archived' then 'archived'
    else 'restored'
  end;

  perform set_config('tarento.habit_revision_source', v_source, true);
  perform set_config('tarento.habit_revision_reason', v_reason, true);
  perform set_config('tarento.habit_revision_effective_on', p_effective_on::text, true);
  perform set_config(
    'tarento.habit_revision_idempotency_key', p_idempotency_key::text, true
  );
  perform set_config('tarento.habit_revision_restore_id', '', true);
  perform set_config('tarento.habit_revision_fingerprint', v_fingerprint, true);

  update public.habits habit
  set retired_at = case
        when p_state = 'retired' then now()
        when p_state = 'active' then null
        else habit.retired_at
      end,
      archived_at = case
        when p_state = 'archived' then now()
        when p_state = 'unarchived' then null
        else habit.archived_at
      end
  where habit.id = p_habit_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

-- Preview budżetu i aktywnej ścieżki --------------------------------------

create or replace function public.habit_revision_snapshot_minutes(p_snapshot jsonb)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_snapshot ->> 'unit'
    when 'minutes' then greatest(coalesce((p_snapshot ->> 'start_value')::numeric, 0), 0)
    when 'seconds' then greatest(coalesce((p_snapshot ->> 'start_value')::numeric, 0), 0) / 60
    else 3
  end;
$$;

create or replace function public.preview_habit_revision_restore(
  p_habit_id uuid,
  p_revision_id uuid,
  p_effective_on date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_habit public.habits%rowtype;
  v_revision public.habit_revisions%rowtype;
  v_snapshot jsonb;
  v_schedule_days smallint[];
  v_scheduled boolean;
  v_budget integer;
  v_daily_ceiling integer;
  v_used numeric := 0;
  v_count integer := 0;
  v_current_minutes numeric;
  v_restored_minutes numeric;
  v_fits_budget boolean;
  v_fits_ceiling boolean;
  v_path_conflict boolean;
begin
  if v_user_id is null then
    raise exception 'preview_habit_revision_restore: authentication required'
      using errcode = '28000';
  end if;

  select * into v_habit from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id;
  select * into v_revision from public.habit_revisions revision
  where revision.id = p_revision_id
    and revision.habit_id = p_habit_id
    and revision.user_id = v_user_id;

  if v_habit.id is null or v_revision.id is null then
    raise exception 'preview_habit_revision_restore: revision not found'
      using errcode = 'P0002';
  end if;

  v_snapshot := v_revision.after_snapshot;
  v_schedule_days := case
    when v_snapshot -> 'schedule_days' is null
      or v_snapshot -> 'schedule_days' = 'null'::jsonb then null
    else array(
      select value::smallint
      from jsonb_array_elements_text(v_snapshot -> 'schedule_days') value
    )
  end;
  v_scheduled := public.habit_is_scheduled_on(
    v_snapshot ->> 'schedule_type', v_schedule_days, p_effective_on
  );

  select plan.minute_budget, plan.daily_ceiling,
         coalesce(sum(item.estimated_minutes) filter (
           where item.plan_state = 'planned' and item.habit_id <> p_habit_id
         ), 0),
         count(*) filter (
           where item.plan_state = 'planned' and item.habit_id <> p_habit_id
         )::integer
  into v_budget, v_daily_ceiling, v_used, v_count
  from public.day_plans plan
  left join public.day_plan_items item on item.day_plan_id = plan.id
  where plan.user_id = v_user_id and plan.plan_date = p_effective_on
  group by plan.id;

  if not found then
    v_budget := public.allocated_window_minutes(v_user_id, p_effective_on);
    select profile.daily_ceiling into v_daily_ceiling
    from public.profiles profile where profile.id = v_user_id;

    select
      coalesce(sum(case habit.unit
        when 'minutes' then greatest(habit.start_value, 0)
        when 'seconds' then greatest(habit.start_value, 0) / 60
        else 3
      end), 0),
      count(*)::integer
    into v_used, v_count
    from public.habits habit
    where habit.user_id = v_user_id
      and habit.id <> p_habit_id
      and habit.archived_at is null
      and habit.retired_at is null
      and public.habit_is_scheduled_on(
        habit.schedule_type, habit.schedule_days, p_effective_on
      );
  end if;

  v_current_minutes := case v_habit.unit
    when 'minutes' then greatest(v_habit.start_value, 0)
    when 'seconds' then greatest(v_habit.start_value, 0) / 60
    else 3
  end;
  v_restored_minutes := case
    when v_scheduled then public.habit_revision_snapshot_minutes(v_snapshot)
    else 0
  end;
  v_fits_budget := v_budget is null or v_used + v_restored_minutes <= v_budget;
  v_fits_ceiling := not v_scheduled or v_count + 1 <= v_daily_ceiling;

  select exists (
    select 1
    from public.user_path_practices link
    join public.user_paths user_path on user_path.id = link.user_path_id
    where link.habit_id = p_habit_id
      and link.user_id = v_user_id
      and user_path.state = 'active'
      and public.habit_revision_snapshot(v_habit) is distinct from v_snapshot
  ) into v_path_conflict;

  return jsonb_build_object(
    'habit_id', p_habit_id,
    'revision_id', p_revision_id,
    'current_snapshot', public.habit_revision_snapshot(v_habit),
    'target_snapshot', v_snapshot,
    'current_minutes', round(v_current_minutes, 2),
    'restored_minutes', round(v_restored_minutes, 2),
    'used_other_minutes', round(v_used, 2),
    'budget_minutes', v_budget,
    'fits_budget', v_fits_budget,
    'fits_daily_ceiling', v_fits_ceiling,
    'path_conflict', v_path_conflict,
    'can_restore', v_fits_budget and v_fits_ceiling
  );
end;
$$;

-- Przywrócenie jest nową rewizją, nigdy przepisywaniem starej -------------

create or replace function public.restore_habit_revision(
  p_habit_id uuid,
  p_revision_id uuid,
  p_expected_revision_id uuid,
  p_accept_path_conflict boolean,
  p_effective_on date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_habit public.habits%rowtype;
  v_result public.habits%rowtype;
  v_target public.habit_revisions%rowtype;
  v_latest_id uuid;
  v_preview jsonb;
  v_snapshot jsonb;
  v_schedule_days smallint[];
  v_existing public.habit_revisions%rowtype;
  v_fingerprint text := md5(
    coalesce(p_revision_id::text, '') || '|'
    || coalesce(p_expected_revision_id::text, '') || '|'
    || coalesce(p_accept_path_conflict::text, '') || '|'
    || coalesce(p_effective_on::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'restore_habit_revision: authentication required'
      using errcode = '28000';
  end if;

  select * into v_existing
  from public.habit_revisions revision
  where revision.habit_id = p_habit_id
    and revision.user_id = v_user_id
    and revision.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'restore_habit_revision: idempotency key reused'
        using errcode = '22023';
    end if;
    select * into v_result from public.habits habit
    where habit.id = p_habit_id and habit.user_id = v_user_id;
    return to_jsonb(v_result);
  end if;

  select * into v_habit
  from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id
  for update;

  if not found or v_habit.archived_at is not null or v_habit.retired_at is not null then
    raise exception 'restore_habit_revision: active habit not found'
      using errcode = 'P0002';
  end if;

  select revision.id into v_latest_id
  from public.habit_revisions revision
  where revision.habit_id = p_habit_id
  order by revision.revision_number desc
  limit 1;

  if v_latest_id is distinct from p_expected_revision_id then
    raise exception 'restore_habit_revision: stale habit version'
      using errcode = '40001';
  end if;

  select * into v_target
  from public.habit_revisions revision
  where revision.id = p_revision_id
    and revision.habit_id = p_habit_id
    and revision.user_id = v_user_id;

  if not found then
    raise exception 'restore_habit_revision: revision not found'
      using errcode = 'P0002';
  end if;

  v_preview := public.preview_habit_revision_restore(
    p_habit_id, p_revision_id, p_effective_on
  );

  if not coalesce((v_preview ->> 'can_restore')::boolean, false) then
    raise exception 'restore_habit_revision: budget conflict'
      using errcode = '23514';
  end if;

  if coalesce((v_preview ->> 'path_conflict')::boolean, false)
     and not p_accept_path_conflict then
    raise exception 'restore_habit_revision: path conflict requires preview'
      using errcode = '23514';
  end if;

  v_snapshot := v_target.after_snapshot;
  v_schedule_days := case
    when v_snapshot -> 'schedule_days' is null
      or v_snapshot -> 'schedule_days' = 'null'::jsonb then null
    else array(
      select value::smallint
      from jsonb_array_elements_text(v_snapshot -> 'schedule_days') value
    )
  end;

  perform set_config('tarento.habit_revision_source', 'restore', true);
  perform set_config('tarento.habit_revision_reason', 'rollback', true);
  perform set_config('tarento.habit_revision_effective_on', p_effective_on::text, true);
  perform set_config(
    'tarento.habit_revision_idempotency_key', p_idempotency_key::text, true
  );
  perform set_config('tarento.habit_revision_restore_id', p_revision_id::text, true);
  perform set_config('tarento.habit_revision_fingerprint', v_fingerprint, true);

  update public.habits habit
  set title = v_snapshot ->> 'title',
      description = v_snapshot ->> 'description',
      icon = v_snapshot ->> 'icon',
      color = v_snapshot ->> 'color',
      unit = v_snapshot ->> 'unit',
      category = v_snapshot ->> 'category',
      start_value = (v_snapshot ->> 'start_value')::numeric,
      increment_value = (v_snapshot ->> 'increment_value')::numeric,
      target_value = (v_snapshot ->> 'target_value')::numeric,
      progression_mode = v_snapshot ->> 'progression_mode',
      schedule_type = v_snapshot ->> 'schedule_type',
      schedule_days = case
        when v_snapshot ->> 'schedule_type' = 'custom' then v_schedule_days
        else null
      end,
      reminder_time = (v_snapshot ->> 'reminder_time')::time,
      time_of_day = v_snapshot ->> 'time_of_day',
      source_book = v_snapshot ->> 'source_book',
      source_author = v_snapshot ->> 'source_author'
  where habit.id = p_habit_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.update_habit_with_revision(
  uuid, jsonb, text, text, date, uuid, timestamptz
) from public;
grant execute on function public.update_habit_with_revision(
  uuid, jsonb, text, text, date, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.set_habit_lifecycle_with_revision(
  uuid, text, date, uuid, timestamptz
) from public;
grant execute on function public.set_habit_lifecycle_with_revision(
  uuid, text, date, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.preview_habit_revision_restore(uuid, uuid, date)
  from public;
grant execute on function public.preview_habit_revision_restore(uuid, uuid, date)
  to authenticated, service_role;

revoke all on function public.restore_habit_revision(
  uuid, uuid, uuid, boolean, date, uuid
) from public;
grant execute on function public.restore_habit_revision(
  uuid, uuid, uuid, boolean, date, uuid
) to authenticated, service_role;

revoke all on function public.habit_revision_snapshot_minutes(jsonb) from public;
grant execute on function public.habit_revision_snapshot_minutes(jsonb)
  to authenticated, service_role;
