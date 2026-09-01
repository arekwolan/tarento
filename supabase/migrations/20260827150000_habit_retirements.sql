-- Emerytura nawyku: nawyk, który stał się nawykiem, przestaje być śledzony.
--
-- Najbardziej kontrintuicyjna rzecz w tym produkcie i jedyna, która dowodzi
-- jego tezy: celem jest przestać potrzebować aplikacji do tej konkretnej
-- rzeczy. Alternatywą jest lista, która rośnie w nieskończoność — a to jest
-- dokładnie ta mechanika, przez którą ludzie odinstalowują takie aplikacje
-- w trzecim tygodniu.
--
-- Kolumna habits.retired_at istnieje od migracji paths i znaczy dokładnie to
-- samo co tutaj: „zdjęte z listy, historia zostaje". Ścieżka używa jej, gdy
-- etap wycofuje praktykę; użytkownik — gdy nawyk już go nie potrzebuje.

create table public.habit_retirements (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz
);

comment on table public.habit_retirements is
  'Ślad po propozycji zdjęcia nawyku z listy. offered_at pilnuje, żeby pytanie
   nie wracało częściej niż raz na dziewięćdziesiąt dni.';
comment on column public.habit_retirements.declined_at is
  'Użytkownik wybrał „Zostaw". Nawyk zostaje na liście, a pytanie milknie na
   kolejne dziewięćdziesiąt dni.';

create index habit_retirements_habit_id_offered_at_idx
  on public.habit_retirements (habit_id, offered_at desc);

-- RLS -----------------------------------------------------------------------

alter table public.habit_retirements enable row level security;

create policy "habit_retirements_select_own"
  on public.habit_retirements for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "habit_retirements_insert_own"
  on public.habit_retirements for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "habit_retirements_update_own"
  on public.habit_retirements for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo (CLAUDE.md, reguła krytyczna 4).

revoke all on public.habit_retirements from anon, authenticated;
grant all on public.habit_retirements to service_role;
grant select, insert, update on public.habit_retirements to authenticated;

-- Seria zamrożona, nie zerwana ------------------------------------------------
--
-- Nawyk zdjęty z listy przestaje mieć dni z harmonogramu: nikt o niego nie
-- prosi, więc brak wpisu nie jest niewykonaniem. Bez tego tydzień po emeryturze
-- seria spadłaby do zera — czyli aplikacja ukarałaby użytkownika dokładnie za
-- to, do czego sama go zaprosiła.
--
-- Jedyna zmiana względem 20260826224656: pętla kończy się w dniu zdjęcia
-- z listy, a nie dzisiaj.

create or replace function public.get_habit_streak(p_habit_id uuid)
returns table (current_streak integer, longest_streak integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_habit public.habits%rowtype;
  v_rest_dows smallint[];
  v_rest_dates date[];
  v_last_day date;
  v_day date;
  v_status text;
  v_running integer := 0;
  v_longest integer := 0;
begin
  select * into v_habit
  from public.habits
  where id = p_habit_id;

  if not found then
    current_streak := 0;
    longest_streak := 0;
    return next;
    return;
  end if;

  -- Jedno zapytanie na nawyk zamiast sprawdzania każdej doby osobno.
  select
    coalesce(array_agg(r.weekday) filter (where r.weekday is not null), '{}'::smallint[]),
    coalesce(array_agg(r.rest_date) filter (where r.rest_date is not null), '{}'::date[])
  into v_rest_dows, v_rest_dates
  from public.rest_days r
  where r.user_id = v_habit.user_id;

  -- Dzień zdjęcia z listy wchodzi jeszcze do rachunku: tego dnia nawyk był
  -- na liście i użytkownik mógł go odhaczyć.
  v_last_day := least(
    current_date,
    coalesce((v_habit.retired_at at time zone 'UTC')::date, current_date)
  );

  for v_day in
    select generate_series(v_habit.started_on, v_last_day, interval '1 day')::date
  loop
    if v_day = any(v_rest_dates)
      or extract(dow from v_day)::smallint = any(v_rest_dows) then
      continue;
    end if;

    if not public.habit_is_scheduled_on(
      v_habit.schedule_type, v_habit.schedule_days, v_day
    ) then
      continue;
    end if;

    select l.status into v_status
    from public.habit_logs l
    where l.habit_id = p_habit_id
      and l.log_date = v_day;

    if v_status in ('done', 'partial') then
      v_running := v_running + 1;
      if v_running > v_longest then
        v_longest := v_running;
      end if;
    elsif v_status = 'skipped' then
      null;
    elsif v_day = current_date then
      null;
    else
      v_running := 0;
    end if;
  end loop;

  current_streak := v_running;
  longest_streak := v_longest;
  return next;
end;
$$;

comment on function public.get_habit_streak(uuid) is
  'Zwraca (current_streak, longest_streak) dla nawyku, z uwzględnieniem
   harmonogramu. Dzień spoza harmonogramu i dzień pusty nie przerywają serii.
   Nawyk zdjęty z listy ma serię zamrożoną w dniu zdjęcia.';

-- Statystyki: emerytura nie liczy się jako niewykonanie ----------------------
--
-- Zmiana względem 20260825164555: dni po zdjęciu nawyku z listy nie są
-- zaplanowane, więc nie psują ani mapy dni, ani skuteczności. Historia sprzed
-- tego dnia zostaje nietknięta — to ona jest dowodem, że nawyk się wydarzył.

create or replace function public.get_daily_summary(p_from date, p_to date)
returns table (day date, scheduled integer, completed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  scheduled as (
    select d.day, h.id as habit_id
    from days d
    join public.habits h
      on h.archived_at is null
     and h.started_on <= d.day
     and (
       h.retired_at is null
       or d.day <= (h.retired_at at time zone 'UTC')::date
     )
     and public.habit_is_scheduled_on(h.schedule_type, h.schedule_days, d.day)
  )
  select
    d.day,
    count(s.habit_id)::integer,
    count(l.id) filter (where l.status in ('done', 'partial'))::integer
  from days d
  left join scheduled s on s.day = d.day
  left join public.habit_logs l
    on l.habit_id = s.habit_id
   and l.log_date = d.day
  group by d.day
  order by d.day;
$$;

comment on function public.get_daily_summary(date, date) is
  'Liczba zaplanowanych i wykonanych pozycji w każdym dniu przedziału.
   Nawyk zdjęty z listy przestaje być zaplanowany od dnia zdjęcia.';

create or replace function public.get_habit_stats(p_today date)
returns table (
  habit_id uuid,
  scheduled_7 integer,
  completed_7 integer,
  scheduled_30 integer,
  completed_30 integer,
  current_streak integer,
  longest_streak integer,
  recent_days boolean[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with expanded as (
    select
      h.id as habit_id,
      d.day::date as day,
      coalesce(l.status in ('done', 'partial'), false) as completed
    from public.habits h
    cross join lateral generate_series(
      greatest(h.started_on, p_today - 29),
      p_today,
      interval '1 day'
    ) as d(day)
    left join public.habit_logs l
      on l.habit_id = h.id
     and l.log_date = d.day::date
    where h.archived_at is null
      and public.habit_is_scheduled_on(h.schedule_type, h.schedule_days, d.day::date)
  )
  select
    h.id,
    count(e.day) filter (where e.day > p_today - 7)::integer,
    count(e.day) filter (where e.day > p_today - 7 and e.completed)::integer,
    count(e.day)::integer,
    count(e.day) filter (where e.completed)::integer,
    s.current_streak,
    s.longest_streak,
    coalesce(
      array_agg(e.completed order by e.day) filter (where e.day > p_today - 14),
      array[]::boolean[]
    )
  from public.habits h
  left join expanded e on e.habit_id = h.id
  cross join lateral public.get_habit_streak(h.id) s
  -- Nawyk zdjęty z listy wypada z zestawienia „ile odhaczasz". Liczy się
  -- w „ile nawyków zbudowałeś" — a to jest inna liczba i inne pytanie.
  where h.archived_at is null
    and h.retired_at is null
  group by h.id, h.sort_order, h.created_at, s.current_streak, s.longest_streak
  order by h.sort_order, h.created_at;
$$;

comment on function public.get_habit_stats(date) is
  'Skuteczność 7/30 dni, serie i ostatnie 14 dni dla każdego nawyku na liście.
   Nawyki zdjęte z listy nie wchodzą do zestawienia.';
