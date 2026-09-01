-- Działanie ścieżek: zapis, przejście etapu, wycofanie praktyki.
--
-- Każda z tych operacji dotyka naraz user_paths, habits i user_path_practices.
-- Z klienta byłaby to seria żądań, z których każde może nie dojść osobno —
-- i wtedy użytkownik zostaje z nawykami bez ścieżki albo ze ścieżką bez
-- nawyków. Jedno wywołanie funkcji to jedna transakcja i ten stan przestaje
-- być możliwy.
--
-- security invoker, nie definer: funkcje piszą wyłącznie wiersze wołającego,
-- a polityki RLS z migracji ścieżek już tego pilnują. Definer zdjąłby tę
-- kontrolę bez żadnego zysku — atomowość bierze się z transakcji, nie
-- z uprawnień.
--
-- p_today przychodzi z klienta, bo „dzisiaj" w Tarento to doba logiczna
-- (getLogicalToday), a nie current_date serwera. Odhaczenie o 1:30 w nocy
-- domyka dzień poprzedni, więc data etapu też musi iść tą samą miarą.

-- Materializacja praktyki --------------------------------------------------

create or replace function public.materialize_path_practice(
  p_user_path_id uuid,
  p_practice_id uuid,
  p_lite boolean,
  p_today date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_practice public.path_practices%rowtype;
  -- Wariant lekki: te same praktyki, mniejsze liczby. Współczynnik ma
  -- odpowiednik w src/features/paths/model/fit.ts (LITE_FACTOR) — obie strony
  -- muszą liczyć tak samo, bo klient pokazuje pozycje optymistycznie, zanim
  -- serwer je zapisze.
  v_factor numeric := case when p_lite then 0.6 else 1 end;
  v_habit_id uuid;
begin
  select * into v_practice
  from public.path_practices
  where id = p_practice_id;

  if not found then
    raise exception 'materialize_path_practice: brak praktyki %', p_practice_id
      using errcode = 'P0002';
  end if;

  insert into public.habits (
    user_id,
    title,
    -- „Jak" trafia do opisu nawyku; „po co" zostaje w katalogu ścieżki.
    description,
    unit,
    category,
    start_value,
    increment_value,
    target_value,
    progression_mode,
    schedule_type,
    schedule_days,
    time_of_day,
    sort_order,
    started_on,
    source_path_id,
    source_stage_id
  )
  select
    v_user_id,
    v_practice.title,
    v_practice.how,
    v_practice.unit,
    v_practice.category,
    greatest(round(v_practice.start_value * v_factor), 1),
    round(v_practice.increment_value * v_factor),
    v_practice.target_value,
    v_practice.progression_mode,
    v_practice.schedule_type,
    v_practice.schedule_days,
    v_practice.time_of_day,
    v_practice.sort_order,
    p_today,
    s.path_id,
    s.id
  from public.path_stages s
  where s.id = v_practice.stage_id
  returning id into v_habit_id;

  insert into public.user_path_practices (
    user_path_id, practice_id, habit_id, user_id, activated_on
  )
  values (p_user_path_id, p_practice_id, v_habit_id, v_user_id, p_today);

  return v_habit_id;
end;
$$;

comment on function public.materialize_path_practice(uuid, uuid, boolean, date) is
  'Praktyka ścieżki → wiersz w habits plus most w user_path_practices.
   Jedyne miejsce, w którym powstaje nawyk pochodzący ze ścieżki.';

-- Zapis na ścieżkę ----------------------------------------------------------

create or replace function public.enroll_in_path(
  p_path_id uuid,
  p_lite boolean,
  p_today date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_stage_id uuid;
  v_practice_id uuid;
  v_user_path_id uuid;
begin
  if v_user_id is null then
    raise exception 'enroll_in_path: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  select id into v_stage_id
  from public.path_stages
  where path_id = p_path_id
  order by ordinal
  limit 1;

  if v_stage_id is null then
    raise exception 'enroll_in_path: ścieżka % nie ma etapów', p_path_id
      using errcode = 'P0002';
  end if;

  -- Indeks częściowy user_paths_one_active_idx odrzuci drugą aktywną ścieżkę.
  -- Nie sprawdzamy tego osobno: wyścig między dwoma urządzeniami i tak
  -- rozstrzyga baza, a nie odczyt sprzed zapisu.
  insert into public.user_paths (
    user_id, path_id, state, current_stage_id, stage_entered_on, started_on, fit
  )
  values (
    v_user_id,
    p_path_id,
    'active',
    v_stage_id,
    p_today,
    p_today,
    case when p_lite then jsonb_build_object('lite', true) else null end
  )
  returning id into v_user_path_id;

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_stage_id
      -- Wariant lekki pomija praktyki oznaczone jako wyłączalne.
      and (not p_lite or not is_optional)
    order by sort_order
  loop
    perform public.materialize_path_practice(
      v_user_path_id, v_practice_id, p_lite, p_today
    );
  end loop;

  return v_user_path_id;
end;
$$;

comment on function public.enroll_in_path(uuid, boolean, date) is
  'Zapisuje użytkownika na ścieżkę i materializuje praktyki pierwszego etapu.
   Jedna transakcja: albo powstaje komplet, albo nic.';

-- Przejście etapu -----------------------------------------------------------

create or replace function public.advance_path_stage(
  p_user_path_id uuid,
  p_from_stage_id uuid,
  p_today date
)
returns table (
  next_stage_id uuid,
  retired_habit_ids uuid[],
  retired_titles text[]
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_path public.user_paths%rowtype;
  v_lite boolean;
  v_current public.path_stages%rowtype;
  v_next public.path_stages%rowtype;
  v_practice_id uuid;
  v_retired_ids uuid[] := '{}';
  v_retired_titles text[] := '{}';
begin
  select * into v_user_path
  from public.user_paths
  where id = p_user_path_id;

  if not found then
    raise exception 'advance_path_stage: brak zapisu %', p_user_path_id
      using errcode = 'P0002';
  end if;

  -- Idempotencja: dwa dotknięcia „Zaczynam" nie przesuwają etapu dwa razy.
  -- Drugie wywołanie widzi już inny current_stage_id i nie robi nic.
  if v_user_path.state <> 'active' or v_user_path.current_stage_id is distinct from p_from_stage_id then
    return;
  end if;

  select * into v_current
  from public.path_stages
  where id = p_from_stage_id;

  select * into v_next
  from public.path_stages
  where path_id = v_current.path_id
    and ordinal > v_current.ordinal
  order by ordinal
  limit 1;

  -- Ostatni etap: zakończenie ścieżki ma własny przepływ (pytanie o praktyki),
  -- więc tutaj tylko sygnalizujemy brak następnego etapu.
  if not found then
    next_stage_id := null;
    retired_habit_ids := v_retired_ids;
    retired_titles := v_retired_titles;
    return next;
    return;
  end if;

  v_lite := coalesce((v_user_path.fit ->> 'lite')::boolean, false);

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_next.id
      and (not v_lite or not is_optional)
    order by sort_order
  loop
    perform public.materialize_path_practice(
      p_user_path_id, v_practice_id, v_lite, p_today
    );
  end loop;

  -- Każdy etap coś oddaje: praktyki wskazane przez retires_practice_id
  -- schodzą z listy. Najpierw zbieramy, co schodzi — klient dostaje tytuły
  -- do toasta z akcją „Cofnij", więc lista musi powstać przed zmianą stanu.
  select
    coalesce(array_agg(h.id order by h.sort_order), '{}'::uuid[]),
    coalesce(array_agg(h.title order by h.sort_order), '{}'::text[])
  into v_retired_ids, v_retired_titles
  from public.habits h
  join public.user_path_practices upp on upp.habit_id = h.id
  where upp.user_path_id = p_user_path_id
    and upp.retired_on is null
    and h.archived_at is null
    and upp.practice_id in (
      select retires_practice_id
      from public.path_practices
      where stage_id = v_next.id
        and retires_practice_id is not null
    );

  update public.habits
  set retired_at = now()
  where id = any(v_retired_ids);

  update public.user_path_practices
  set retired_on = p_today
  where user_path_id = p_user_path_id
    and habit_id = any(v_retired_ids);

  update public.user_paths
  set current_stage_id = v_next.id,
      stage_entered_on = p_today
  where id = p_user_path_id;

  next_stage_id := v_next.id;
  retired_habit_ids := v_retired_ids;
  retired_titles := v_retired_titles;
  return next;
end;
$$;

comment on function public.advance_path_stage(uuid, uuid, date) is
  'Przesuwa zapis na kolejny etap: materializuje nowe praktyki, wycofuje te
   wskazane przez retires_practice_id i przestawia current_stage_id.
   Zwraca pusty next_stage_id, gdy etap był ostatni.';

-- Wycofanie i jego cofnięcie ------------------------------------------------

create or replace function public.set_path_practice_retired(
  p_habit_id uuid,
  p_retired boolean,
  p_today date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.habits
  set retired_at = case when p_retired then now() else null end
  where id = p_habit_id;

  update public.user_path_practices
  set retired_on = case when p_retired then p_today else null end
  where habit_id = p_habit_id;
end;
$$;

comment on function public.set_path_practice_retired(uuid, boolean, date) is
  'Zdejmuje praktykę z listy albo ją przywraca — obie kolumny naraz, bo nawyk
   widoczny mimo wycofanego mostu (i odwrotnie) to stan nie do wytłumaczenia.
   Pod akcję „Cofnij" w toaście.';

-- Wykonanie w oknie ---------------------------------------------------------

create or replace function public.get_path_completion_ratio(
  p_user_path_id uuid,
  p_today date,
  p_days integer default 14
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with rest as (
    select
      coalesce(
        array_agg(r.weekday) filter (where r.weekday is not null),
        '{}'::smallint[]
      ) as dows,
      coalesce(
        array_agg(r.rest_date) filter (where r.rest_date is not null),
        '{}'::date[]
      ) as dates
    from public.rest_days r
    where r.user_id = (select auth.uid())
  ),
  slots as (
    select h.id as habit_id, d.day::date as day
    from public.user_path_practices upp
    join public.habits h on h.id = upp.habit_id
    cross join rest
    cross join lateral generate_series(
      greatest(h.started_on, p_today - p_days),
      p_today - 1,
      interval '1 day'
    ) as d(day)
    where upp.user_path_id = p_user_path_id
      and h.archived_at is null
      -- Dzień po wycofaniu praktyki nie jest pominięciem — jej już nie ma.
      and (h.retired_at is null or d.day::date < h.retired_at::date)
      and public.habit_is_scheduled_on(h.schedule_type, h.schedule_days, d.day::date)
      -- Dzień pusty jest przezroczysty, tak samo jak w serii (reguła z P4).
      and not (d.day::date = any(rest.dates))
      and not (extract(dow from d.day)::smallint = any(rest.dows))
  )
  select case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where l.status in ('done', 'partial'))::numeric / count(*),
      4
    )
  end
  from slots s
  left join public.habit_logs l
    on l.habit_id = s.habit_id
   and l.log_date = s.day;
$$;

comment on function public.get_path_completion_ratio(uuid, date, integer) is
  'Udział wykonanych dni wśród zaplanowanych, w oknie p_days dni kończącym się
   wczoraj — wejście do kryterium przejścia etapu. Dzisiaj nie wchodzi, bo doba
   jeszcze trwa i nierozpoczęty dzień nie jest pominięciem.';

-- Granty ---------------------------------------------------------------------

revoke all on function public.materialize_path_practice(uuid, uuid, boolean, date)
  from public;
grant execute on function public.materialize_path_practice(uuid, uuid, boolean, date)
  to authenticated, service_role;

revoke all on function public.enroll_in_path(uuid, boolean, date) from public;
grant execute on function public.enroll_in_path(uuid, boolean, date)
  to authenticated, service_role;

revoke all on function public.advance_path_stage(uuid, uuid, date) from public;
grant execute on function public.advance_path_stage(uuid, uuid, date)
  to authenticated, service_role;

revoke all on function public.set_path_practice_retired(uuid, boolean, date) from public;
grant execute on function public.set_path_practice_retired(uuid, boolean, date)
  to authenticated, service_role;

revoke all on function public.get_path_completion_ratio(uuid, date, integer) from public;
grant execute on function public.get_path_completion_ratio(uuid, date, integer)
  to authenticated, service_role;
