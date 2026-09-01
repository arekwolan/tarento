-- Dopasowanie ścieżki do kontekstu użytkownika.
--
-- Raz, przy zapisie — nie codziennie i nie przy każdym etapie. Wynik siedzi
-- w user_paths.fit i od tej pory rozstrzyga, które praktyki powstają i od
-- jakich wartości. Ścieżka ma działać w całości bez ani jednego wywołania
-- modelu: fit z samym `lite` jest tym, co powstaje, gdy modelu nie ma.

alter table public.ai_generations
  drop constraint ai_generations_kind_check;

alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in ('daily_plan', 'habit_suggestion', 'downshift', 'path_fit'));

-- Sufit pominięć --------------------------------------------------------------
--
-- Ścieżka, z której zniknęła więcej niż połowa etapu, przestaje być tą
-- ścieżką. Walidator w funkcji brzegowej pilnuje tego po stronie modelu, ale
-- `fit` przychodzi z klienta i baza nie ma jak sprawdzić, kto go napisał —
-- dlatego ta sama reguła stoi tutaj jeszcze raz.

create or replace function public.capped_skip_ids(p_stage_id uuid, p_skip uuid[])
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (
      select count(*) from public.path_practices
      where stage_id = p_stage_id and id = any(coalesce(p_skip, '{}'::uuid[]))
    ) * 2 > (
      select count(*) from public.path_practices where stage_id = p_stage_id
    )
    -- Lista przekracza sufit: zostają wyłącznie praktyki wyłączalne, czyli
    -- dokładnie to, co dało się pominąć przed dopasowaniem.
    then coalesce(
      (
        select array_agg(id) from public.path_practices
        where stage_id = p_stage_id
          and is_optional
          and id = any(coalesce(p_skip, '{}'::uuid[]))
      ),
      '{}'::uuid[]
    )
    else coalesce(p_skip, '{}'::uuid[])
  end;
$$;

comment on function public.capped_skip_ids(uuid, uuid[]) is
  'Lista pominięć przycięta do połowy praktyk etapu. Powyżej sufitu zostają
   wyłącznie praktyki wyłączalne — dopasowanie nie ma prawa wypatroszyć etapu.';

-- Materializacja czyta dopasowanie -------------------------------------------
--
-- Zmiana względem 20260827113639: praktyka wskazana w `fit.adjust` startuje od
-- wartości z dopasowania. Bierzemy mniejszą z dwóch — dopasowanie schodzi
-- wyłącznie w dół, więc nigdy nie podnosi tego, co obniżył wariant lekki
-- albo tydzień wejściowy.

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
  v_reentry boolean;
  v_params record;
  v_adjust jsonb;
  v_start numeric;
  v_time_of_day text;
  v_habit_id uuid;
begin
  select * into v_practice
  from public.path_practices
  where id = p_practice_id;

  if not found then
    raise exception 'materialize_path_practice: brak praktyki %', p_practice_id
      using errcode = 'P0002';
  end if;

  select coalesce(up.reentry_until >= p_today, false)
  into v_reentry
  from public.user_paths up
  where up.id = p_user_path_id;

  select * into v_params
  from public.path_practice_params(p_practice_id, p_lite, coalesce(v_reentry, false));

  select elem into v_adjust
  from public.user_paths up
  cross join lateral jsonb_array_elements(
    coalesce(up.fit -> 'adjust', '[]'::jsonb)
  ) as elem
  where up.id = p_user_path_id
    and elem ->> 'practiceId' = p_practice_id::text
  limit 1;

  v_start := v_params.start_value;

  if v_adjust is not null and (v_adjust ->> 'startValue') is not null then
    v_start := least(v_start, greatest((v_adjust ->> 'startValue')::numeric, 1));
  end if;

  v_time_of_day := v_practice.time_of_day;

  -- Pora dnia z dopasowania wchodzi tylko wtedy, gdy jest jedną z trzech
  -- wartości, które zna CHECK na habits — inaczej zapis na ścieżkę wywracałby
  -- się na literówce w odpowiedzi modelu.
  if v_adjust is not null
     and (v_adjust ->> 'timeOfDay') in ('morning', 'afternoon', 'evening') then
    v_time_of_day := v_adjust ->> 'timeOfDay';
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
    v_start,
    v_params.increment_value,
    v_practice.target_value,
    v_practice.progression_mode,
    v_practice.schedule_type,
    v_practice.schedule_days,
    v_time_of_day,
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

-- Zapis na ścieżkę z dopasowaniem --------------------------------------------
--
-- Sygnatura rośnie o `p_fit`. Stara wersja znika, zamiast zostać jako
-- przeciążenie: dwie funkcje o tej samej nazwie i różnej liczbie argumentów
-- to dokładnie ten rodzaj niejednoznaczności, przez który klient przez pół
-- roku wołałby wersję bez dopasowania i nikt by tego nie zauważył.

drop function if exists public.enroll_in_path(uuid, boolean, date, uuid[]);

create or replace function public.enroll_in_path(
  p_path_id uuid,
  p_lite boolean,
  p_today date,
  p_skip_practice_ids uuid[],
  p_fit jsonb
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
  v_fit jsonb;
  v_skip uuid[];
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

  -- Pominięcia z dopasowania i pominięcia odznaczone przez użytkownika to
  -- jedna lista: po zapisie nie ma już powodu ich rozróżniać, bo obie znaczą
  -- „tej praktyki nie zakładamy".
  select coalesce(array_agg(distinct value::uuid), '{}'::uuid[])
  into v_skip
  from (
    select value from jsonb_array_elements_text(
      coalesce(p_fit -> 'skip', '[]'::jsonb)
    )
    union
    select unnest(coalesce(p_skip_practice_ids, '{}'::uuid[]))::text
  ) as ids(value);

  v_skip := public.capped_skip_ids(v_stage_id, v_skip);

  v_fit := coalesce(p_fit, '{}'::jsonb)
    || jsonb_build_object('lite', p_lite, 'skip', to_jsonb(v_skip));

  -- Indeks częściowy user_paths_one_active_idx odrzuci drugą aktywną ścieżkę.
  -- Nie sprawdzamy tego osobno: wyścig między dwoma urządzeniami i tak
  -- rozstrzyga baza, a nie odczyt sprzed zapisu.
  insert into public.user_paths (
    user_id, path_id, state, current_stage_id, stage_entered_on, started_on, fit
  )
  values (v_user_id, p_path_id, 'active', v_stage_id, p_today, p_today, v_fit)
  returning id into v_user_path_id;

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_stage_id
      -- Praktyka wskazana przez dopasowanie albo odznaczona przez użytkownika
      -- odpada zawsze; wariant lekki dodatkowo zdejmuje wszystkie wyłączalne.
      and id <> all(v_skip)
      and not (is_optional and p_lite)
    order by sort_order
  loop
    perform public.materialize_path_practice(
      v_user_path_id, v_practice_id, p_lite, p_today
    );
  end loop;

  return v_user_path_id;
end;
$$;

comment on function public.enroll_in_path(uuid, boolean, date, uuid[], jsonb) is
  'Zapisuje użytkownika na ścieżkę i materializuje praktyki pierwszego etapu.
   Jedna transakcja: albo powstaje komplet, albo nic. p_fit niesie dopasowanie
   (lite, skip, adjust, note) i zostaje zapisane w user_paths.fit.';

-- Przejście etapu czyta ten sam sufit -----------------------------------------

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
  v_skip uuid[];
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
  if v_user_path.state <> 'active'
     or v_user_path.current_stage_id is distinct from p_from_stage_id then
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

  select coalesce(array_agg(value::uuid), '{}'::uuid[])
  into v_skip
  from jsonb_array_elements_text(coalesce(v_user_path.fit -> 'skip', '[]'::jsonb));

  v_skip := public.capped_skip_ids(v_next.id, v_skip);

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_next.id
      and id <> all(v_skip)
      and not (is_optional and v_lite)
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

-- Granty ---------------------------------------------------------------------

revoke all on function public.capped_skip_ids(uuid, uuid[]) from public;
grant execute on function public.capped_skip_ids(uuid, uuid[])
  to authenticated, service_role;

revoke all on function public.enroll_in_path(uuid, boolean, date, uuid[], jsonb)
  from public;
grant execute on function public.enroll_in_path(uuid, boolean, date, uuid[], jsonb)
  to authenticated, service_role;
