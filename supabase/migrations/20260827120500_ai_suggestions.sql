-- Podpowiedzi AI: telemetria trafności oraz kontekst, który funkcja brzegowa
-- składa sama, bez udziału klienta.
--
-- Klient wysyła wyłącznie intencję („chcę więcej czytać"). Wszystko, co model
-- musi wiedzieć o dobie użytkownika, funkcja czyta stąd kluczem service_role.
-- Dzięki temu nie da się rozszerzyć budżetu podmieniając ciało żądania.

-- Telemetria trafności --------------------------------------------------------

alter table public.ai_generations
  add column accepted_at timestamptz,
  add column rejected_reason text;

comment on column public.ai_generations.accepted_at is
  'Kiedy użytkownik użył propozycji. NULL = obejrzał i nie wziął. Bez tej
   kolumny nie da się zmierzyć, czy podpowiedzi są cokolwiek warte.';
comment on column public.ai_generations.rejected_reason is
  'Nazwa reguły walidatora, przez którą odpowiedź modelu poszła do kosza
   i wróciła wersja deterministyczna. Zapisuje wyłącznie Edge Function.';

-- Klient oznacza użycie propozycji, ale nie dopisuje wierszy: licznik kosztów
-- ma pozostać sterowany wyłącznie przez funkcję (patrz brak polityki INSERT
-- w migracji 20260825134154). Grant kolumnowy pilnuje, żeby UPDATE nie sięgnął
-- po nic poza tymi dwoma polami — RLS nie umie ograniczać kolumn.
create policy "ai_generations_update_own"
  on public.ai_generations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant update (accepted_at, rejected_reason) on public.ai_generations to authenticated;

-- Doba logiczna po stronie serwera -------------------------------------------
--
-- Odpowiednik getLogicalToday() z @/lib/date. Funkcja brzegowa nie dostaje
-- daty od klienta — data jest częścią kontekstu, a kontekstu klient nie
-- ustala (CLAUDE.md, reguła krytyczna 2 i reguła krytyczna 1).

create or replace function public.logical_today(p_user_id uuid)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when extract(hour from (now() at time zone p.timezone)) < p.day_start_hour
      then ((now() at time zone p.timezone)::date - 1)
    else (now() at time zone p.timezone)::date
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

comment on function public.logical_today(uuid) is
  'Dzień, który dla użytkownika jest „dzisiaj". Mirror getLogicalToday()
   z @/lib/date: doba kończy się o day_start_hour czasu lokalnego.';

-- Okno dnia po stronie serwera ------------------------------------------------
--
-- Mirror allocatedWindow() z src/features/day-budget/model/windows.ts. Ta sama
-- semantyka: jedno okno, dosunięte do najdłuższego wolnego pasa doby, przycięte
-- deklaracją selfMinutes. Wolnej puli nie sumujemy (IDEAS.md §H) — liczba jest
-- granicą, nie inwentarzem.
--
-- Liczone na masce 1440 minut, a nie na przedziałach: maska jest odporna na
-- bloki nakładające się i stykające bez osobnego scalania, a koszt (kilka
-- tysięcy iteracji przy jednym wywołaniu modelu) jest bez znaczenia.

create or replace function public.allocated_window_minutes(
  p_user_id uuid,
  p_date date
)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- Okno krótsze niż to nie jest oknem: kilku minut między dwoma blokami nie
  -- da się na nic wykorzystać. Ta sama stała co MIN_WINDOW_MINUTES w windows.ts.
  c_min_window constant integer := 10;
  v_rotation public.day_rotations%rowtype;
  v_length integer;
  v_template public.day_templates%rowtype;
  v_free boolean[];
  v_wake integer;
  v_sleep integer;
  v_minute integer;
  v_from integer;
  v_to integer;
  v_run integer := 0;
  v_longest integer := 0;
begin
  select * into v_rotation
  from public.day_rotations
  where user_id = p_user_id;

  if not found then
    return null;
  end if;

  v_length := coalesce(array_length(v_rotation.template_ids, 1), 0);
  if v_length = 0 then
    return null;
  end if;

  -- Reszta z dzielenia, nie samo `%`: data sprzed kotwicy daje różnicę ujemną,
  -- a wtedy `%` oddałoby indeks ujemny i rotacja urwałaby się na kotwicy.
  select * into v_template
  from public.day_templates
  where id = v_rotation.template_ids[
        (((p_date - v_rotation.anchor_date) % v_length) + v_length) % v_length + 1]
    and user_id = p_user_id
    and archived_at is null;

  if not found then
    return null;
  end if;

  v_wake := extract(hour from v_template.wake_time) * 60
          + extract(minute from v_template.wake_time);
  v_sleep := extract(hour from v_template.sleep_time) * 60
           + extract(minute from v_template.sleep_time);

  v_free := array_fill(false, array[1440]);

  -- Czuwanie. Sen przed pobudką oznacza dyżur nocny: czuwanie przechodzi przez
  -- północ i rozpada się na dwa pasy, tak samo jak po stronie klienta. Skan
  -- niżej jest liniowy, więc te dwa pasy nigdy nie skleją się w jedno okno.
  if v_sleep > v_wake then
    for v_minute in v_wake .. v_sleep - 1 loop
      v_free[v_minute + 1] := true;
    end loop;
  else
    for v_minute in v_wake .. 1439 loop
      v_free[v_minute + 1] := true;
    end loop;
    for v_minute in 0 .. v_sleep - 1 loop
      v_free[v_minute + 1] := true;
    end loop;
  end if;

  -- Zajęte pasy. Zarchiwizowany blok nie zajmuje już czasu (reguła 4).
  for v_from, v_to in
    select
      extract(hour from b.start_time) * 60 + extract(minute from b.start_time),
      extract(hour from b.end_time) * 60 + extract(minute from b.end_time)
    from public.day_blocks b
    where b.template_id = v_template.id
      and b.archived_at is null
  loop
    for v_minute in v_from .. least(v_to, 1440) - 1 loop
      v_free[v_minute + 1] := false;
    end loop;
  end loop;

  for v_minute in 0 .. 1439 loop
    if v_free[v_minute + 1] then
      v_run := v_run + 1;
      if v_run > v_longest then
        v_longest := v_run;
      end if;
    else
      v_run := 0;
    end if;
  end loop;

  if v_longest < c_min_window then
    return null;
  end if;

  return least(greatest(v_template.self_minutes, 0), v_longest);
end;
$$;

comment on function public.allocated_window_minutes(uuid, date) is
  'Okno użytkownika w minutach na wskazany dzień. Mirror allocatedWindow()
   z src/features/day-budget/model/windows.ts. NULL = brak kształtu dnia albo
   brak wolnego okna sensownej długości.';

-- Granty ---------------------------------------------------------------------
--
-- Obie funkcje służą wyłącznie funkcjom brzegowym: klient liczy jedno i drugie
-- lokalnie, na danych, które i tak ma w pamięci. Mniejszy grant to mniejsza
-- powierzchnia.

revoke all on function public.logical_today(uuid) from public;
grant execute on function public.logical_today(uuid) to service_role;

revoke all on function public.allocated_window_minutes(uuid, date) from public;
grant execute on function public.allocated_window_minutes(uuid, date) to service_role;
