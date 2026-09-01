-- P9: jednorazowe przygotowanie środowiska na początku etapu.
--
-- Setup action jest celowo osobnym bytem od habits i habit_logs. Nie ma
-- harmonogramu, celu, przypomnienia ani statusu skipped, więc jego wykonanie
-- nie może wejść do serii, adherence ani dziennego limitu zadań.

create table public.path_setup_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_path_id uuid not null references public.user_paths (id) on delete cascade,
  stage_id uuid not null references public.path_stages (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  explanation text check (
    explanation is null or char_length(btrim(explanation)) between 1 and 240
  ),
  sort_order smallint not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'dismissed')),
  decided_on date,
  client_request_id uuid,
  status_changed_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_path_id, stage_id),
  unique (user_id, client_request_id),
  constraint path_setup_actions_resolution_shape check (
    (status = 'pending' and decided_on is null and client_request_id is null)
    or (status in ('completed', 'dismissed') and decided_on is not null)
  )
);

comment on table public.path_setup_actions is
  'Jednorazowe przygotowanie przypięte do konkretnego etapu i zapisu. Nigdy nawyk.';
comment on column public.path_setup_actions.explanation is
  'Opcjonalne krótkie wyjaśnienie. Definicje ze starszym environment_setup mają NULL.';
comment on column public.path_setup_actions.archived_at is
  'Pending starego etapu jest archiwizowany, nigdy przenoszony do następnego.';

create index path_setup_actions_today_idx
  on public.path_setup_actions (user_id, user_path_id, stage_id, sort_order)
  where status = 'pending' and archived_at is null;

create trigger path_setup_actions_set_updated_at
  before update on public.path_setup_actions
  for each row execute function public.set_updated_at();

-- Materializacja -----------------------------------------------------------
--
-- Wszystkie setupy wersji ścieżki powstają razem z enrollmentem. Dzięki temu
-- usunięcie propozycji w preview można zapisać jako dismissed także dla
-- przyszłego etapu, bez osobnej operacji podczas przejścia. Klucz setupSkip
-- jest technicznym dodatkiem do user_paths.fit; nie zmienia dopasowania
-- praktyk i nie jest wejściem do AI.

create or replace function public.materialize_path_setup_actions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.path_setup_actions (
    user_id, user_path_id, stage_id, title, explanation, sort_order,
    status, decided_on, status_changed_at
  )
  select
    new.user_id,
    new.id,
    stage.id,
    btrim(stage.environment_setup),
    null,
    stage.ordinal,
    case when exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(new.fit, '{}'::jsonb) -> 'setupSkip') = 'array'
            then new.fit -> 'setupSkip'
          else '[]'::jsonb
        end
      ) skipped(value)
      where skipped.value = stage.id::text
    ) then 'dismissed' else 'pending' end,
    case when exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(new.fit, '{}'::jsonb) -> 'setupSkip') = 'array'
            then new.fit -> 'setupSkip'
          else '[]'::jsonb
        end
      ) skipped(value)
      where skipped.value = stage.id::text
    ) then new.started_on else null end,
    now()
  from public.path_stages stage
  where stage.path_id = new.path_id
    and stage.environment_setup is not null
  order by stage.ordinal;

  return new;
end;
$$;

create trigger user_paths_materialize_setup_actions
  after insert on public.user_paths
  for each row execute function public.materialize_path_setup_actions();

-- Przejście etapu i zakończenie -------------------------------------------
--
-- Jedna jawna reguła: pending z opuszczanego etapu jest archiwizowany.
-- Nigdy nie przechodzi na następny etap. Zakończenie zapisu archiwizuje
-- wszystkie pozostałe pending, także te przygotowane dla przyszłych etapów.

create or replace function public.reconcile_path_setup_actions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_stage_id is distinct from old.current_stage_id
     and old.current_stage_id is not null then
    update public.path_setup_actions
    set archived_at = now()
    where user_path_id = new.id
      and user_id = new.user_id
      and stage_id = old.current_stage_id
      and status = 'pending'
      and archived_at is null;
  end if;

  if new.state = 'ended' and old.state is distinct from 'ended' then
    update public.path_setup_actions
    set archived_at = now()
    where user_path_id = new.id
      and user_id = new.user_id
      and status = 'pending'
      and archived_at is null;
  end if;

  return new;
end;
$$;

create trigger user_paths_reconcile_setup_actions
  after update of current_stage_id, state on public.user_paths
  for each row execute function public.reconcile_path_setup_actions();

-- Widok dnia ---------------------------------------------------------------
--
-- „Etap właśnie się rozpoczął” ma jednoznaczną definicję: logiczna data
-- wejścia w etap jest równa logicznej dacie ekranu Dzisiaj. Powtórne otwarcie
-- tego samego dnia nadal pokazuje pending; następnego dnia setup już nie wraca.

create or replace function public.get_today_path_setup_actions(p_today date)
returns setof public.path_setup_actions
language sql
stable
security invoker
set search_path = ''
as $$
  select action.*
  from public.path_setup_actions action
  join public.user_paths enrollment on enrollment.id = action.user_path_id
  where action.user_id = (select auth.uid())
    and action.status = 'pending'
    and action.archived_at is null
    and enrollment.user_id = (select auth.uid())
    and enrollment.state = 'active'
    and enrollment.current_stage_id = action.stage_id
    and enrollment.stage_entered_on = p_today
  order by action.sort_order, action.created_at;
$$;

-- Terminalna decyzja jest idempotentna po client_request_id. Ponieważ
-- p_today jest zapisany w persystowanej mutacji, retry po powrocie sieci
-- dotyczy tej samej doby logicznej, w której użytkownik dotknął przycisku.

create or replace function public.resolve_path_setup_action(
  p_action_id uuid,
  p_status text,
  p_client_request_id uuid,
  p_today date
)
returns setof public.path_setup_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_action public.path_setup_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'resolve_path_setup_action: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  if p_status not in ('completed', 'dismissed') then
    raise exception 'resolve_path_setup_action: niepoprawny status'
      using errcode = '22023';
  end if;

  select action.* into v_action
  from public.path_setup_actions action
  where action.id = p_action_id
    and action.user_id = v_user_id
  for update;

  if not found then
    raise exception 'resolve_path_setup_action: brak akcji'
      using errcode = 'P0002';
  end if;

  if v_action.status = p_status
     and v_action.client_request_id = p_client_request_id then
    return next v_action;
    return;
  end if;

  if v_action.status <> 'pending' or v_action.archived_at is not null then
    raise exception 'resolve_path_setup_action: akcja jest już zamknięta'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.user_paths enrollment
    where enrollment.id = v_action.user_path_id
      and enrollment.user_id = v_user_id
      and enrollment.state = 'active'
      and enrollment.current_stage_id = v_action.stage_id
      and enrollment.stage_entered_on = p_today
  ) then
    raise exception 'resolve_path_setup_action: etap nie jest już w pierwszej dobie'
      using errcode = '23514';
  end if;

  update public.path_setup_actions
  set status = p_status,
      decided_on = p_today,
      client_request_id = p_client_request_id,
      status_changed_at = now()
  where id = v_action.id
  returning * into v_action;

  return next v_action;
end;
$$;

-- RLS i granty -------------------------------------------------------------

alter table public.path_setup_actions enable row level security;

create policy "path_setup_actions_select_own"
  on public.path_setup_actions for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_paths enrollment
      where enrollment.id = path_setup_actions.user_path_id
        and enrollment.user_id = (select auth.uid())
    )
  );

revoke all on public.path_setup_actions from anon, authenticated;
grant all on public.path_setup_actions to service_role;
grant select on public.path_setup_actions to authenticated;

revoke all on function public.materialize_path_setup_actions() from public;
revoke all on function public.reconcile_path_setup_actions() from public;
revoke all on function public.get_today_path_setup_actions(date) from public;
revoke all on function public.resolve_path_setup_action(uuid, text, uuid, date)
  from public;
grant execute on function public.get_today_path_setup_actions(date)
  to authenticated, service_role;
grant execute on function public.resolve_path_setup_action(uuid, text, uuid, date)
  to authenticated, service_role;

-- Backfill zapisów istniejących w chwili wdrożenia. Etapy już opuszczone
-- i zakończone zapisy dostają archived_at; przyszły setup czeka na swój etap.
insert into public.path_setup_actions (
  user_id, user_path_id, stage_id, title, explanation, sort_order,
  status, decided_on, status_changed_at, archived_at
)
select
  enrollment.user_id,
  enrollment.id,
  stage.id,
  btrim(stage.environment_setup),
  null,
  stage.ordinal,
  case when exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(coalesce(enrollment.fit, '{}'::jsonb) -> 'setupSkip') = 'array'
          then enrollment.fit -> 'setupSkip'
        else '[]'::jsonb
      end
    ) skipped(value)
    where skipped.value = stage.id::text
  ) then 'dismissed' else 'pending' end,
  case when exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(coalesce(enrollment.fit, '{}'::jsonb) -> 'setupSkip') = 'array'
          then enrollment.fit -> 'setupSkip'
        else '[]'::jsonb
      end
    ) skipped(value)
    where skipped.value = stage.id::text
  ) then enrollment.started_on else null end,
  now(),
  case
    when enrollment.state = 'ended'
      or stage.ordinal < coalesce(current_stage.ordinal, stage.ordinal)
    then now()
    else null
  end
from public.user_paths enrollment
join public.path_stages stage on stage.path_id = enrollment.path_id
left join public.path_stages current_stage on current_stage.id = enrollment.current_stage_id
where stage.environment_setup is not null
on conflict (user_path_id, stage_id) do nothing;
