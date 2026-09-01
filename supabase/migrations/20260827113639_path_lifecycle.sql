-- Cykl życia ścieżki poza stanem aktywnym: pauza, powrót, zakończenie.
--
-- Zasada, od której zależy całe copy tego modułu: porzucenie nie ma boleć.
-- Pauza jest jawna, darmowa i bez limitu. Powrót wznawia etap, na którym się
-- skończyło, z tygodniem wejściowym na obniżonych parametrach. Zakończenie
-- nie kasuje niczego samo z siebie — pyta użytkownika, co zrobić z praktykami.
--
-- Wszystkie operacje idą przez funkcje, bo każda dotyka naraz user_paths
-- i habits. security invoker: piszą wyłącznie wiersze wołającego, a RLS już
-- tego pilnuje.

-- Treść: co ścieżka deklaruje o swoim zakończeniu i powtarzaniu -------------

alter table public.paths
  add column closing_letter boolean not null default false,
  add column repeat_cooldown_days smallint check (repeat_cooldown_days > 0);

comment on column public.paths.closing_letter is
  'Czy zamknięcie ścieżki prosi o list do siebie za rok. Nie każda ścieżka go
   potrzebuje — po czternastu dniach taki list byłby pustym gestem.';
comment on column public.paths.repeat_cooldown_days is
  'Ile dni po zakończeniu ścieżka nie może zostać uruchomiona ponownie.
   NULL = bez ograniczeń. Reguła jest w treści, a nie w kodzie, żeby dodanie
   ścieżki zostało migracją, a nie zmianą warunku po slugu.';

-- „Droga wojownika" zamyka się listem do siebie za rok — to jedyna rzecz
-- w aplikacji, która wraca po roku.
update public.paths
set closing_letter = true
where slug = 'warrior-in-peacetime';

-- Parametry praktyki ---------------------------------------------------------
--
-- Jedno miejsce, w którym żyje współczynnik 0.6, i jedyne, które wie, że
-- wariant lekki i tydzień wejściowy się mnożą: ścieżka wzięta w wersji lekkiej
-- i wznowiona po pauzie startuje z 36% wartości z katalogu, a nie z 60%.
-- Odpowiednik po stronie klienta: src/features/paths/model/reentry.ts.

create or replace function public.path_practice_params(
  p_practice_id uuid,
  p_lite boolean,
  p_reentry boolean
)
returns table (start_value numeric, increment_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    -- Start nigdy nie schodzi poniżej jednego: praktyka o wartości zero to
    -- brak praktyki. Przyrost zerowy zostaje zerowy.
    greatest(round(p.start_value * f.factor), 1),
    round(p.increment_value * f.factor)
  from public.path_practices p
  cross join lateral (
    select power(0.6::numeric, (p_lite::int + p_reentry::int)) as factor
  ) f
  where p.id = p_practice_id;
$$;

comment on function public.path_practice_params(uuid, boolean, boolean) is
  'Parametry startowe praktyki po uwzględnieniu wariantu lekkiego i tygodnia
   wejściowego. Jedyne miejsce ze współczynnikiem 0.6 po stronie bazy.';

-- Materializacja czyta ten sam współczynnik ---------------------------------
--
-- Zmiana względem poprzedniej wersji: tydzień wejściowy bierze się z zapisu,
-- a nie z parametru. Etap, który przechodzi w trakcie tygodnia wejściowego,
-- dokłada praktyki na tych samych obniżonych parametrach co reszta listy.

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
    v_params.start_value,
    v_params.increment_value,
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

-- Pauza ----------------------------------------------------------------------

create or replace function public.pause_path(p_user_path_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.user_paths
  set state = 'paused', paused_at = now()
  where id = p_user_path_id
    and state = 'active';

  if not found then
    return;
  end if;

  -- Nawyki znikają z listy, ale nie dostają retired_on: to znacznik „ścieżka
  -- zdjęła praktykę na dobre", a pauza niczego nie zdejmuje na dobre.
  -- Powiadomienia gasną same — planuje je odczyt aktywnych nawyków, a ten
  -- filtruje retired_at.
  update public.habits h
  set retired_at = now()
  from public.user_path_practices upp
  where upp.habit_id = h.id
    and upp.user_path_id = p_user_path_id
    and upp.retired_on is null
    and h.retired_at is null;
end;
$$;

comment on function public.pause_path(uuid) is
  'Wstrzymuje ścieżkę i zdejmuje jej praktyki z listy. Bez limitu czasu,
   bez wygasania — wiersz czeka tak długo, jak trzeba.';

-- Powrót ---------------------------------------------------------------------

create or replace function public.resume_path(
  p_user_path_id uuid,
  p_today date,
  p_with_reentry boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lite boolean;
begin
  select coalesce((fit ->> 'lite')::boolean, false)
  into v_lite
  from public.user_paths
  where id = p_user_path_id;

  update public.user_paths
  set state = 'active',
      paused_at = null,
      -- Siedem dni tygodnia wejściowego. Cofnięcie pauzy (p_with_reentry
      -- false) niczego nie obniża: to nie jest powrót, tylko wycofanie gestu.
      reentry_until = case when p_with_reentry then p_today + 7 else null end
  where id = p_user_path_id
    and state = 'paused';

  if not found then
    return;
  end if;

  update public.habits h
  set retired_at = null,
      start_value = v.start_value,
      increment_value = v.increment_value
  from public.user_path_practices upp
  cross join lateral public.path_practice_params(
    upp.practice_id, v_lite, p_with_reentry
  ) v
  where upp.habit_id = h.id
    and upp.user_path_id = p_user_path_id
    and upp.retired_on is null;
end;
$$;

comment on function public.resume_path(uuid, date, boolean) is
  'Wznawia ścieżkę na etapie, na którym się skończyła. p_with_reentry true
   daje tydzień wejściowy na obniżonych parametrach; false to cofnięcie pauzy
   i powrót do wartości sprzed niej.';

create or replace function public.restore_path_parameters(p_user_path_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lite boolean;
begin
  select coalesce((fit ->> 'lite')::boolean, false)
  into v_lite
  from public.user_paths
  where id = p_user_path_id;

  update public.user_paths
  set reentry_until = null
  where id = p_user_path_id
    and reentry_until is not null;

  if not found then
    return;
  end if;

  update public.habits h
  set start_value = v.start_value,
      increment_value = v.increment_value
  from public.user_path_practices upp
  cross join lateral public.path_practice_params(upp.practice_id, v_lite, false) v
  where upp.habit_id = h.id
    and upp.user_path_id = p_user_path_id
    and upp.retired_on is null;
end;
$$;

comment on function public.restore_path_parameters(uuid) is
  'Koniec tygodnia wejściowego: parametry wracają do wartości etapu.
   Wołane przy wejściu na ekran „Dziś", cicho — użytkownik nie dostaje
   komunikatu o końcu taryfy ulgowej, bo nie było żadnej taryfy.';

-- Zakończenie ----------------------------------------------------------------

create or replace function public.end_path(
  p_user_path_id uuid,
  p_reason text,
  p_keep_practices boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.user_paths
  set state = 'ended',
      ended_at = now(),
      ended_reason = p_reason,
      paused_at = null,
      reentry_until = null
  where id = p_user_path_id
    and state <> 'ended';

  if not found then
    return;
  end if;

  if p_keep_practices then
    -- Nawyk traci pochodzenie i staje się zwykły. Most w user_path_practices
    -- zostaje: historia mówi, skąd się wziął, nawet gdy ekran już nie mówi.
    update public.habits h
    set source_path_id = null,
        source_stage_id = null,
        retired_at = null
    from public.user_path_practices upp
    where upp.habit_id = h.id
      and upp.user_path_id = p_user_path_id
      and upp.retired_on is null;
  else
    update public.habits h
    set archived_at = now()
    from public.user_path_practices upp
    where upp.habit_id = h.id
      and upp.user_path_id = p_user_path_id
      and upp.retired_on is null
      and h.archived_at is null;
  end if;
end;
$$;

comment on function public.end_path(uuid, text, boolean) is
  'Zamyka ścieżkę i rozstrzyga los praktyk: zostawia je na liście jako zwykłe
   nawyki albo archiwizuje. Praktyk zdjętych wcześniej przez ścieżkę
   (retired_on) nie dotyka — użytkownik nie miał ich na liście w chwili
   zakończenia.';

-- Granty ---------------------------------------------------------------------

revoke all on function public.path_practice_params(uuid, boolean, boolean) from public;
grant execute on function public.path_practice_params(uuid, boolean, boolean)
  to authenticated, service_role;

revoke all on function public.pause_path(uuid) from public;
grant execute on function public.pause_path(uuid) to authenticated, service_role;

revoke all on function public.resume_path(uuid, date, boolean) from public;
grant execute on function public.resume_path(uuid, date, boolean)
  to authenticated, service_role;

revoke all on function public.restore_path_parameters(uuid) from public;
grant execute on function public.restore_path_parameters(uuid)
  to authenticated, service_role;

revoke all on function public.end_path(uuid, text, boolean) from public;
grant execute on function public.end_path(uuid, text, boolean)
  to authenticated, service_role;
