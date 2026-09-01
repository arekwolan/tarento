-- B3: sprawdzian transferu i prywatne potwierdzenie wdrożenia.
--
-- Odpowiedź nie jest logiem dziennym ani warunkiem zaliczenia. Powstaje tylko
-- wtedy, gdy użytkownik sam otwiera przejście etapu. Historia jest append-only:
-- klient nie ma UPDATE/DELETE, a ponowna odpowiedź tworzy nowy wiersz.

alter table public.user_paths
  add constraint user_paths_id_user_id_unique unique (id, user_id);

create table public.path_transfer_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_path_id uuid not null,
  stage_id uuid not null references public.path_stages (id),
  client_request_id uuid not null,
  response text not null
    check (response in ('yes', 'not_yet', 'no_opportunity')),
  decision text not null
    check (decision in ('advance', 'stay', 'downshift')),
  evidence text check (evidence is null or char_length(evidence) between 1 and 280),
  protocol_type text not null
    check (protocol_type in ('tarento', 'book_protocol')),
  answered_on date not null,
  defer_until date,
  advanced_to_stage_id uuid references public.path_stages (id),
  retired_habit_ids uuid[] not null default '{}'::uuid[],
  retired_titles text[] not null default '{}'::text[],
  supersedes_response_id uuid references public.path_transfer_responses (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id),
  constraint path_transfer_responses_user_path_owner_fkey
    foreign key (user_path_id, user_id)
    references public.user_paths (id, user_id)
    on delete cascade,
  constraint path_transfer_response_decision_check check (
    (response = 'yes' and decision in ('advance', 'stay'))
    or (response = 'not_yet' and decision in ('advance', 'stay', 'downshift'))
    or (response = 'no_opportunity' and decision in ('advance', 'stay'))
  ),
  constraint path_transfer_response_defer_check check (
    (decision = 'advance' and defer_until is null)
    or (decision in ('stay', 'downshift') and defer_until is not null)
  ),
  constraint path_transfer_response_supersedes_check check (
    supersedes_response_id is null or supersedes_response_id <> id
  )
);

comment on table public.path_transfer_responses is
  'Append-only odpowiedzi na jedno pytanie o transfer praktyki. Tekst dowodu
   jest prywatny i nigdy nie trafia do analityki.';
comment on column public.path_transfer_responses.response is
  'Deklaracja transferu, nie ocena wykonania: tak / jeszcze nie / brak okazji.';
comment on column public.path_transfer_responses.defer_until is
  'Neutralne odłożenie kolejnego pytania. Nie zmienia logów ani serii.';

create index path_transfer_responses_user_path_stage_created_idx
  on public.path_transfer_responses (user_path_id, stage_id, created_at desc)
  where archived_at is null;

create index path_transfer_responses_user_created_idx
  on public.path_transfer_responses (user_id, created_at desc)
  where archived_at is null;

create table public.path_implementation_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_path_id uuid not null unique,
  path_id uuid not null references public.paths (id),
  protocol_type text not null
    check (protocol_type in ('tarento', 'book_protocol')),
  source_type text,
  source_title text not null,
  source_author text,
  completed_stages jsonb not null,
  practice_outcomes jsonb not null,
  user_sentence text
    check (user_sentence is null or char_length(user_sentence) between 1 and 280),
  answers_archived_at timestamptz,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint path_implementation_confirmations_user_path_owner_fkey
    foreign key (user_path_id, user_id)
    references public.user_paths (id, user_id)
    on delete cascade,
  constraint path_implementation_confirmations_stages_check
    check (jsonb_typeof(completed_stages) = 'array'),
  constraint path_implementation_confirmations_practices_check
    check (jsonb_typeof(practice_outcomes) = 'array')
);

comment on table public.path_implementation_confirmations is
  'Prywatny snapshot zakończenia. Liczby wykonania i odpowiedzi transferu są
   prezentowane osobno; rekord nie twierdzi, że protokół spowodował zmianę.';

create index path_implementation_confirmations_user_completed_idx
  on public.path_implementation_confirmations (user_id, completed_at desc);

-- RLS -----------------------------------------------------------------------

alter table public.path_transfer_responses enable row level security;

create policy "path_transfer_responses_select_own_parent"
  on public.path_transfer_responses for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_paths up
      where up.id = path_transfer_responses.user_path_id
        and up.user_id = (select auth.uid())
    )
  );

alter table public.path_implementation_confirmations enable row level security;

create policy "path_implementation_confirmations_select_own_parent"
  on public.path_implementation_confirmations for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_paths up
      where up.id = path_implementation_confirmations.user_path_id
        and up.user_id = (select auth.uid())
    )
  );

-- Brak bezpośrednich polityk zapisu. Odpowiedź, przejście i potwierdzenie są
-- jedną transakcją w ograniczonych RPC; klient nie może przepisywać historii.
revoke all on public.path_transfer_responses from anon, authenticated;
grant all on public.path_transfer_responses to service_role;
grant select on public.path_transfer_responses to authenticated;

revoke all on public.path_implementation_confirmations from anon, authenticated;
grant all on public.path_implementation_confirmations to service_role;
grant select on public.path_implementation_confirmations to authenticated;

-- Idempotentna odpowiedź i świadome przejście -------------------------------

create or replace function public.submit_path_transfer(
  p_user_path_id uuid,
  p_stage_id uuid,
  p_client_request_id uuid,
  p_response text,
  p_decision text,
  p_evidence text,
  p_today date
)
returns table (
  response_id uuid,
  next_stage_id uuid,
  retired_habit_ids uuid[],
  retired_titles text[],
  deferred_until date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_path public.user_paths%rowtype;
  v_stage public.path_stages%rowtype;
  v_path public.paths%rowtype;
  v_existing public.path_transfer_responses%rowtype;
  v_evidence text := nullif(btrim(p_evidence), '');
  v_ratio numeric;
  v_next_stage_id uuid;
  v_retired_ids uuid[] := '{}'::uuid[];
  v_retired_titles text[] := '{}'::text[];
  v_defer_until date;
  v_response_id uuid;
begin
  if v_user_id is null then
    raise exception 'submit_path_transfer: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  if p_response not in ('yes', 'not_yet', 'no_opportunity')
     or p_decision not in ('advance', 'stay', 'downshift')
     or (p_response = 'yes' and p_decision = 'downshift')
     or (p_response = 'no_opportunity' and p_decision = 'downshift')
     or (v_evidence is not null and char_length(v_evidence) > 280) then
    raise exception 'submit_path_transfer: niepoprawna odpowiedź'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.path_transfer_responses response
  where response.user_id = v_user_id
    and response.client_request_id = p_client_request_id;

  if found then
    if v_existing.user_path_id <> p_user_path_id
       or v_existing.stage_id <> p_stage_id
       or v_existing.response <> p_response
       or v_existing.decision <> p_decision
       or v_existing.evidence is distinct from v_evidence then
      raise exception 'submit_path_transfer: request id użyty z inną treścią'
        using errcode = '22023';
    end if;

    return query select
      v_existing.id,
      v_existing.advanced_to_stage_id,
      v_existing.retired_habit_ids,
      v_existing.retired_titles,
      v_existing.defer_until;
    return;
  end if;

  select * into v_user_path
  from public.user_paths up
  where up.id = p_user_path_id
    and up.user_id = v_user_id
  for update;

  if not found
     or v_user_path.state <> 'active'
     or v_user_path.current_stage_id is distinct from p_stage_id then
    raise exception 'submit_path_transfer: etap nie jest aktywny'
      using errcode = '23514';
  end if;

  -- Drugie sprawdzenie po blokadzie obsługuje dwa równoległe retry.
  select * into v_existing
  from public.path_transfer_responses response
  where response.user_id = v_user_id
    and response.client_request_id = p_client_request_id;

  if found then
    return query select
      v_existing.id,
      v_existing.advanced_to_stage_id,
      v_existing.retired_habit_ids,
      v_existing.retired_titles,
      v_existing.defer_until;
    return;
  end if;

  select * into v_stage
  from public.path_stages stage
  where stage.id = p_stage_id
    and stage.path_id = v_user_path.path_id;

  if not found then
    raise exception 'submit_path_transfer: etap nie należy do ścieżki'
      using errcode = '23514';
  end if;

  select * into v_path from public.paths where id = v_user_path.path_id;

  if v_user_path.reentry_until is not null
     and v_user_path.reentry_until >= p_today then
    raise exception 'submit_path_transfer: trwa spokojne ponowne wejście'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.path_transfer_responses response
    where response.user_path_id = p_user_path_id
      and response.stage_id = p_stage_id
      and response.archived_at is null
      and response.defer_until >= p_today
  ) then
    raise exception 'submit_path_transfer: sprawdzian jest odłożony'
      using errcode = '23514';
  end if;

  v_ratio := public.get_path_completion_ratio(p_user_path_id, p_today, 14);

  if not (
    (p_today - v_user_path.stage_entered_on >= v_stage.min_days
      and coalesce(v_ratio, 0) >= v_stage.completion_threshold)
    or p_today - v_user_path.stage_entered_on >= v_stage.max_days
  ) then
    raise exception 'submit_path_transfer: etap nie jest gotowy'
      using errcode = '23514';
  end if;

  if p_decision = 'downshift' and not exists (
    select 1
    from public.user_path_practices upp
    join public.path_practices practice on practice.id = upp.practice_id
    join public.habits habit on habit.id = upp.habit_id
    where upp.user_path_id = p_user_path_id
      and practice.stage_id = p_stage_id
      and upp.retired_on is null
      and habit.archived_at is null
      and habit.retired_at is null
  ) then
    raise exception 'submit_path_transfer: brak praktyki do zmniejszenia'
      using errcode = '23514';
  end if;

  if p_decision = 'advance' then
    select advanced.next_stage_id,
           advanced.retired_habit_ids,
           advanced.retired_titles
    into v_next_stage_id, v_retired_ids, v_retired_titles
    from public.advance_path_stage(p_user_path_id, p_stage_id, p_today) advanced;
  else
    -- Siedem dni to stała domenowa B3, nie wartość z UI. Brak okazji i
    -- zmniejszenie praktyki nie zmieniają serii ani logów.
    v_defer_until := p_today + 7;
  end if;

  insert into public.path_transfer_responses (
    user_id, user_path_id, stage_id, client_request_id, response, decision,
    evidence, protocol_type, answered_on, defer_until, advanced_to_stage_id,
    retired_habit_ids, retired_titles
  ) values (
    v_user_id, p_user_path_id, p_stage_id, p_client_request_id, p_response,
    p_decision, v_evidence, v_path.path_kind, p_today, v_defer_until,
    v_next_stage_id, coalesce(v_retired_ids, '{}'::uuid[]),
    coalesce(v_retired_titles, '{}'::text[])
  ) returning id into v_response_id;

  return query select
    v_response_id,
    v_next_stage_id,
    coalesce(v_retired_ids, '{}'::uuid[]),
    coalesce(v_retired_titles, '{}'::text[]),
    v_defer_until;
end;
$$;

comment on function public.submit_path_transfer(uuid, uuid, uuid, text, text, text, date) is
  'Append-only odpowiedź, opcjonalne odłożenie i istniejące advance_path_stage
   w jednej transakcji. client_request_id zabezpiecza retry offline.';

-- Klient przechodzi etap wyłącznie przez sprawdzian. Funkcja niskiego poziomu
-- pozostaje dostępna wewnętrznie dla RPC i service_role.
revoke execute on function public.advance_path_stage(uuid, uuid, date)
  from authenticated;

revoke all on function public.submit_path_transfer(uuid, uuid, uuid, text, text, text, date)
  from public;
grant execute on function public.submit_path_transfer(uuid, uuid, uuid, text, text, text, date)
  to authenticated, service_role;

-- Potwierdzenie zakończenia --------------------------------------------------

create or replace function public.end_path(
  p_user_path_id uuid,
  p_reason text,
  p_keep_practices boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_path public.user_paths%rowtype;
  v_path public.paths%rowtype;
  v_today date;
  v_completed_stages jsonb := '[]'::jsonb;
  v_practice_outcomes jsonb := '[]'::jsonb;
  v_user_sentence text;
begin
  select * into v_user_path
  from public.user_paths up
  where up.id = p_user_path_id
    and up.user_id = v_user_id;

  if not found or v_user_path.state = 'ended' then
    return;
  end if;

  if p_reason not in ('completed', 'abandoned') then
    raise exception 'end_path: niepoprawny powód' using errcode = '22023';
  end if;

  select * into v_path from public.paths where id = v_user_path.path_id;
  v_today := public.logical_today(v_user_id);

  if p_reason = 'completed' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'stageId', stage.id,
          'ordinal', stage.ordinal,
          'name', stage.name
        ) order by stage.ordinal
      ),
      '[]'::jsonb
    )
    into v_completed_stages
    from public.path_stages stage
    join public.path_stages current_stage
      on current_stage.id = v_user_path.current_stage_id
    where stage.path_id = v_user_path.path_id
      and stage.ordinal <= current_stage.ordinal;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'practiceId', practice.id,
          'stageId', stage.id,
          'stageOrdinal', stage.ordinal,
          'title', habit.title,
          'state', case
            when p_keep_practices and link.retired_on is null then 'kept'
            else 'retired'
          end,
          'scheduled', (
            select count(*)
            from generate_series(
              link.activated_on,
              least(coalesce(link.retired_on, v_today), v_today),
              interval '1 day'
            ) day(value)
            where public.habit_is_scheduled_on(
              habit.schedule_type, habit.schedule_days, day.value::date
            )
              and not exists (
                select 1 from public.rest_days rest
                where rest.user_id = v_user_id
                  and (
                    rest.rest_date = day.value::date
                    or rest.weekday = extract(dow from day.value)::smallint
                  )
              )
          ),
          'completed', (
            select count(*)
            from public.habit_logs log
            where log.habit_id = habit.id
              and log.log_date between link.activated_on
                and least(coalesce(link.retired_on, v_today), v_today)
              and log.status in ('done', 'partial')
          )
        ) order by stage.ordinal, practice.sort_order
      ),
      '[]'::jsonb
    )
    into v_practice_outcomes
    from public.user_path_practices link
    join public.path_practices practice on practice.id = link.practice_id
    join public.path_stages stage on stage.id = practice.stage_id
    join public.habits habit on habit.id = link.habit_id
    where link.user_path_id = p_user_path_id;

    select response.evidence into v_user_sentence
    from public.path_transfer_responses response
    where response.user_path_id = p_user_path_id
      and response.archived_at is null
      and response.evidence is not null
    order by response.created_at desc
    limit 1;
  end if;

  update public.user_paths
  set state = 'ended',
      ended_at = now(),
      ended_reason = p_reason,
      paused_at = null,
      reentry_until = null
  where id = p_user_path_id
    and state <> 'ended';

  if p_keep_practices then
    update public.habits habit
    set source_path_id = case
          when path.path_kind = 'book_protocol' then habit.source_path_id
          else null
        end,
        source_stage_id = case
          when path.path_kind = 'book_protocol' then habit.source_stage_id
          else null
        end,
        retired_at = null
    from public.user_path_practices link
    join public.user_paths up on up.id = link.user_path_id
    join public.paths path on path.id = up.path_id
    where link.habit_id = habit.id
      and link.user_path_id = p_user_path_id
      and link.retired_on is null;
  else
    update public.habits habit
    set archived_at = now()
    from public.user_path_practices link
    where link.habit_id = habit.id
      and link.user_path_id = p_user_path_id
      and link.retired_on is null
      and habit.archived_at is null;
  end if;

  if p_reason = 'completed' then
    insert into public.path_implementation_confirmations (
      user_id, user_path_id, path_id, protocol_type, source_type,
      source_title, source_author, completed_stages, practice_outcomes,
      user_sentence
    ) values (
      v_user_id, p_user_path_id, v_path.id, v_path.path_kind,
      v_path.source_type,
      coalesce(v_path.source_title, v_path.title),
      v_path.source_author,
      v_completed_stages,
      v_practice_outcomes,
      v_user_sentence
    ) on conflict (user_path_id) do nothing;
  end if;
end;
$$;

comment on function public.end_path(uuid, text, boolean) is
  'Kończy wspólny lifecycle. Dla completed tworzy prywatne potwierdzenie,
   w którym wykonanie i deklaracje transferu pozostają odrębnymi danymi.';

-- Usunięcie prywatnych odpowiedzi -------------------------------------------

create or replace function public.archive_path_transfer_data(p_user_path_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'archive_path_transfer_data: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_paths up
    where up.id = p_user_path_id and up.user_id = v_user_id
  ) then
    raise exception 'archive_path_transfer_data: brak zapisu'
      using errcode = 'P0002';
  end if;

  update public.path_transfer_responses response
  set evidence = null,
      archived_at = coalesce(response.archived_at, now())
  where response.user_path_id = p_user_path_id
    and response.user_id = v_user_id;

  update public.path_implementation_confirmations confirmation
  set user_sentence = null,
      answers_archived_at = coalesce(confirmation.answers_archived_at, now())
  where confirmation.user_path_id = p_user_path_id
    and confirmation.user_id = v_user_id;
end;
$$;

revoke all on function public.archive_path_transfer_data(uuid) from public;
grant execute on function public.archive_path_transfer_data(uuid)
  to authenticated, service_role;
