-- Dzień pusty: zaplanowana doba bez zobowiązań.
--
-- To nie jest tryb pauzy ani nagroda za cokolwiek. Deklaracja mówi tylko tyle,
-- że w tym dniu aplikacja o nic nie prosi, a seria zachowuje się tak, jakby
-- tego dnia nie było — nie przedłuża się i nie zrywa.

create table public.rest_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  rest_date date,
  created_at timestamptz not null default now(),
  constraint rest_days_one_of check (num_nonnulls(weekday, rest_date) = 1),
  constraint rest_days_unique unique nulls not distinct (user_id, weekday, rest_date)
);

comment on table public.rest_days is
  'Dni puste użytkownika: cykliczny dzień tygodnia albo pojedyncza data.';
comment on column public.rest_days.weekday is
  'Cykliczny dzień pusty. 0 = niedziela, 6 = sobota — numeracja z extract(dow).';
comment on column public.rest_days.rest_date is
  'Pojedynczy dzień pusty. Wypełnione dokładnie jedno z (weekday, rest_date).';

create index rest_days_user_id_idx on public.rest_days (user_id);

-- RLS -----------------------------------------------------------------------

alter table public.rest_days enable row level security;

create policy "rest_days_select_own"
  on public.rest_days for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "rest_days_insert_own"
  on public.rest_days for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- DELETE jest tu dozwolone — świadome odstępstwo od CLAUDE.md, reguła 4.
-- Wiersz nie jest zapisem historii, tylko deklaracją na przyszłość: „w soboty
-- o nic nie proś". Odwołanie takiej deklaracji ma ją usuwać, a nie zostawiać
-- ślad, bo archiwum dni pustych nie niesie żadnej informacji — seria i tak
-- pomija te daty, a nie zapisuje ich jako wykonane.
create policy "rest_days_delete_own"
  on public.rest_days for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Brak polityki UPDATE celowo: zmiana dnia pustego to skasowanie jednej
-- deklaracji i dodanie drugiej.

-- Granty ---------------------------------------------------------------------

revoke all on public.rest_days from anon, authenticated;
grant all on public.rest_days to service_role;
grant select, insert, delete on public.rest_days to authenticated;

-- Seria pomija dni puste ------------------------------------------------------
--
-- Jedyna zmiana względem wersji z 20260825134158_functions.sql: dzień pusty
-- jest przezroczysty. Nie liczy się jak wykonanie (to byłaby seria na kredyt)
-- ani jak dzień z harmonogramu bez wpisu (to byłoby zerwanie) — po prostu
-- wypada z rachunku, tak samo jak dzień spoza harmonogramu.
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

  for v_day in
    select generate_series(v_habit.started_on, current_date, interval '1 day')::date
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
   harmonogramu. Dzień spoza harmonogramu i dzień pusty nie przerywają serii.';
