-- Wyłączanie praktyk przy zapisie na ścieżkę.
--
-- Do tej pory praktykę oznaczoną `is_optional` pomijał wyłącznie wariant lekki,
-- czyli decyzja budżetu. Teraz pomija ją także użytkownik — jednym gestem,
-- przy zapisie, bez tłumaczenia się. Praktyka „Zimna woda" jest pierwszym
-- powodem: to jedyna praktyka w katalogu, której ktoś może nie chcieć
-- z przyczyn, o które aplikacja nie ma prawa pytać.
--
-- Lista pomijanych działa TYLKO na praktyki oznaczone jako wyłączalne.
-- Identyfikator praktyki obowiązkowej jest ignorowany — to granica między
-- dopasowaniem ścieżki a rozmontowaniem jej, i pilnuje jej baza, nie ekran.

drop function if exists public.enroll_in_path(uuid, boolean, date);

create or replace function public.enroll_in_path(
  p_path_id uuid,
  p_lite boolean,
  p_today date,
  p_skip_practice_ids uuid[]
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
  v_skip uuid[] := coalesce(p_skip_practice_ids, '{}'::uuid[]);
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
    case
      when p_lite or array_length(v_skip, 1) is not null
        then jsonb_build_object('lite', p_lite, 'skip', to_jsonb(v_skip))
      else null
    end
  )
  returning id into v_user_path_id;

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_stage_id
      -- Wyłączalna praktyka odpada, gdy prosi o to budżet (wariant lekki)
      -- albo sam użytkownik. Obowiązkowa nie odpada nigdy.
      and not (is_optional and (p_lite or id = any(v_skip)))
    order by sort_order
  loop
    perform public.materialize_path_practice(
      v_user_path_id, v_practice_id, p_lite, p_today
    );
  end loop;

  return v_user_path_id;
end;
$$;

comment on function public.enroll_in_path(uuid, boolean, date, uuid[]) is
  'Zapisuje użytkownika na ścieżkę i materializuje praktyki pierwszego etapu.
   Jedna transakcja: albo powstaje komplet, albo nic. p_skip_practice_ids
   pomija wyłącznie praktyki oznaczone jako wyłączalne.';

revoke all on function public.enroll_in_path(uuid, boolean, date, uuid[]) from public;
grant execute on function public.enroll_in_path(uuid, boolean, date, uuid[])
  to authenticated, service_role;

-- Przejście etapu czyta tę samą listę --------------------------------------
--
-- Bez tego praktyka wyłączona przy zapisie wracałaby na listę przy pierwszym
-- awansie etapu — a użytkownik nie miałby pojęcia, dlaczego.

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

  for v_practice_id in
    select id
    from public.path_practices
    where stage_id = v_next.id
      and not (is_optional and (v_lite or id = any(v_skip)))
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
