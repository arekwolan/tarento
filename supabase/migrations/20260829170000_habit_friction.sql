-- W2: prywatna, strukturalna mapa tarcia.
--
-- Powód jest osobnym, opcjonalnym zdarzeniem. Nie zmienia habit_logs, serii,
-- statystyk ani notatki dnia. Tekstu dowolnego nie przechowujemy.

create table public.habit_friction_events (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_date date not null,
  reason text not null check (
    reason in (
      'forgot',
      'no_time',
      'too_big',
      'wrong_time',
      'environment',
      'not_today'
    )
  ),
  idempotency_key uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

comment on table public.habit_friction_events is
  'Opcjonalne enumy przeszkód per nawyk i dzień logiczny; bez free text.';

create unique index habit_friction_events_active_day_idx
  on public.habit_friction_events (habit_id, event_date)
  where archived_at is null;
create index habit_friction_events_user_reason_date_idx
  on public.habit_friction_events (user_id, reason, event_date desc)
  where archived_at is null;
create index habit_friction_events_habit_date_idx
  on public.habit_friction_events (habit_id, event_date desc, created_at desc);

create table public.habit_friction_responses (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (
    reason in (
      'forgot',
      'no_time',
      'too_big',
      'wrong_time',
      'environment',
      'not_today'
    )
  ),
  response text not null check (response in ('acted', 'dismissed')),
  effective_on date not null,
  suppressed_until date not null check (suppressed_until >= effective_on),
  idempotency_key uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

comment on table public.habit_friction_responses is
  'Append-only ślad obsługi lub wyciszenia deterministycznej sugestii.';

create index habit_friction_responses_user_habit_reason_idx
  on public.habit_friction_responses (
    user_id, habit_id, reason, effective_on desc, created_at desc
  );
create index habit_friction_responses_suppression_idx
  on public.habit_friction_responses (user_id, suppressed_until desc);

alter table public.habit_friction_events enable row level security;
alter table public.habit_friction_responses enable row level security;

create policy "habit_friction_events_select_own"
  on public.habit_friction_events for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits habit
      where habit.id = habit_friction_events.habit_id
        and habit.user_id = (select auth.uid())
    )
  );

create policy "habit_friction_responses_select_own"
  on public.habit_friction_responses for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits habit
      where habit.id = habit_friction_responses.habit_id
        and habit.user_id = (select auth.uid())
    )
  );

-- Klient czyta własne rekordy, ale każda mutacja przechodzi przez RPC.
revoke all on public.habit_friction_events from anon, authenticated;
revoke all on public.habit_friction_responses from anon, authenticated;
grant select on public.habit_friction_events to authenticated;
grant select on public.habit_friction_responses to authenticated;
grant all on public.habit_friction_events to service_role;
grant all on public.habit_friction_responses to service_role;

-- Zapis lub zmiana powodu ---------------------------------------------------

create or replace function public.save_habit_friction_event(
  p_habit_id uuid,
  p_event_date date,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date;
  v_existing public.habit_friction_events%rowtype;
  v_result public.habit_friction_events%rowtype;
  v_fingerprint text := md5(
    coalesce(p_habit_id::text, '') || '|'
    || coalesce(p_event_date::text, '') || '|'
    || coalesce(p_reason, '')
  );
begin
  if v_user_id is null then
    raise exception 'save_habit_friction_event: authentication required'
      using errcode = '28000';
  end if;

  if p_reason not in (
    'forgot', 'no_time', 'too_big', 'wrong_time', 'environment', 'not_today'
  ) then
    raise exception 'save_habit_friction_event: invalid reason'
      using errcode = '22023';
  end if;

  v_today := public.logical_today(v_user_id);
  -- Kolejka offline żyje maksymalnie dobę, siedem dni zostawia bezpieczny
  -- margines bez otwierania dowolnego backfillu z klienta.
  if p_event_date > v_today or p_event_date < v_today - 7 then
    raise exception 'save_habit_friction_event: invalid logical date'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.habit_friction_events event
  where event.user_id = v_user_id
    and event.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'save_habit_friction_event: idempotency key reused'
        using errcode = '22023';
    end if;
    return to_jsonb(v_existing);
  end if;

  perform 1 from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id
  for update;

  if not found then
    raise exception 'save_habit_friction_event: habit not found'
      using errcode = 'P0002';
  end if;

  -- Blokada nawyku serializuje dwa urządzenia zapisujące ten sam dzień.
  select * into v_existing
  from public.habit_friction_events event
  where event.user_id = v_user_id
    and event.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'save_habit_friction_event: idempotency key reused'
        using errcode = '22023';
    end if;
    return to_jsonb(v_existing);
  end if;

  select * into v_existing
  from public.habit_friction_events event
  where event.habit_id = p_habit_id
    and event.event_date = p_event_date
    and event.archived_at is null
  for update;

  if found and v_existing.reason = p_reason then
    return to_jsonb(v_existing);
  end if;

  if found then
    update public.habit_friction_events event
    set archived_at = now()
    where event.id = v_existing.id;
  end if;

  insert into public.habit_friction_events (
    habit_id,
    user_id,
    event_date,
    reason,
    idempotency_key,
    request_fingerprint
  ) values (
    p_habit_id,
    v_user_id,
    p_event_date,
    p_reason,
    p_idempotency_key,
    v_fingerprint
  )
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

-- Usunięcie i jego bezpieczne cofnięcie -----------------------------------

create or replace function public.set_habit_friction_event_archived(
  p_event_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_event public.habit_friction_events%rowtype;
  v_result public.habit_friction_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'set_habit_friction_event_archived: authentication required'
      using errcode = '28000';
  end if;

  select * into v_event
  from public.habit_friction_events event
  where event.id = p_event_id and event.user_id = v_user_id
  for update;

  if not found then
    raise exception 'set_habit_friction_event_archived: event not found'
      using errcode = 'P0002';
  end if;

  if p_archived and v_event.archived_at is not null then
    return to_jsonb(v_event);
  end if;
  if not p_archived and v_event.archived_at is null then
    return to_jsonb(v_event);
  end if;

  if not p_archived and exists (
    select 1 from public.habit_friction_events current_event
    where current_event.habit_id = v_event.habit_id
      and current_event.event_date = v_event.event_date
      and current_event.archived_at is null
      and current_event.id <> v_event.id
  ) then
    raise exception 'set_habit_friction_event_archived: stale event version'
      using errcode = '40001';
  end if;

  update public.habit_friction_events event
  set archived_at = case when p_archived then now() else null end
  where event.id = p_event_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

-- Jawna odpowiedź na pojedynczą sugestię ----------------------------------

create or replace function public.respond_habit_friction_suggestion(
  p_habit_id uuid,
  p_reason text,
  p_response text,
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
  v_today date;
  v_suppression_days constant integer := 30;
  v_existing public.habit_friction_responses%rowtype;
  v_result public.habit_friction_responses%rowtype;
  v_fingerprint text := md5(
    coalesce(p_habit_id::text, '') || '|'
    || coalesce(p_reason, '') || '|'
    || coalesce(p_response, '') || '|'
    || coalesce(p_effective_on::text, '')
  );
begin
  if v_user_id is null then
    raise exception 'respond_habit_friction_suggestion: authentication required'
      using errcode = '28000';
  end if;

  if p_reason not in (
    'forgot', 'no_time', 'too_big', 'wrong_time', 'environment', 'not_today'
  ) or p_response not in ('acted', 'dismissed') then
    raise exception 'respond_habit_friction_suggestion: invalid response'
      using errcode = '22023';
  end if;

  v_today := public.logical_today(v_user_id);
  if p_effective_on > v_today or p_effective_on < v_today - 7 then
    raise exception 'respond_habit_friction_suggestion: invalid logical date'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.habit_friction_responses response
  where response.user_id = v_user_id
    and response.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'respond_habit_friction_suggestion: idempotency key reused'
        using errcode = '22023';
    end if;
    return to_jsonb(v_existing);
  end if;

  perform 1 from public.habits habit
  where habit.id = p_habit_id and habit.user_id = v_user_id
  for update;

  if not found then
    raise exception 'respond_habit_friction_suggestion: habit not found'
      using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.habit_friction_responses response
  where response.user_id = v_user_id
    and response.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'respond_habit_friction_suggestion: idempotency key reused'
        using errcode = '22023';
    end if;
    return to_jsonb(v_existing);
  end if;

  insert into public.habit_friction_responses (
    habit_id,
    user_id,
    reason,
    response,
    effective_on,
    suppressed_until,
    idempotency_key,
    request_fingerprint
  ) values (
    p_habit_id,
    v_user_id,
    p_reason,
    p_response,
    p_effective_on,
    p_effective_on + v_suppression_days,
    p_idempotency_key,
    v_fingerprint
  )
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.save_habit_friction_event(uuid, date, text, uuid)
  from public;
grant execute on function public.save_habit_friction_event(uuid, date, text, uuid)
  to authenticated, service_role;

revoke all on function public.set_habit_friction_event_archived(uuid, boolean)
  from public;
grant execute on function public.set_habit_friction_event_archived(uuid, boolean)
  to authenticated, service_role;

revoke all on function public.respond_habit_friction_suggestion(
  uuid, text, text, date, uuid
) from public;
grant execute on function public.respond_habit_friction_suggestion(
  uuid, text, text, date, uuid
) to authenticated, service_role;
