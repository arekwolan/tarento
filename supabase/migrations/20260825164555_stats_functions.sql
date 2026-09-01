-- Statystyki liczone po stronie bazy.
--
-- Klient dostaje gotowe agregaty, nie surowe logi: przy roku prowadzenia
-- pięciu nawyków to różnica między kilkudziesięcioma wierszami a półtora
-- tysiącem. Obie funkcje są security invoker, więc RLS ogranicza wynik do
-- danych wywołującego.

-- Dzień po dniu: ile było zaplanowane, ile odhaczone.
-- Zasila heatmapę i skuteczność za 7 i 30 dni (liczoną z tego samego zestawu).
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
  'Liczba zaplanowanych i wykonanych pozycji w każdym dniu przedziału.';

-- Statystyki pojedynczych nawyków: skuteczność 7/30 dni, serie i krótka
-- seria ostatnich dni pod mini-wykres.
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
  where h.archived_at is null
  group by h.id, h.sort_order, h.created_at, s.current_streak, s.longest_streak
  order by h.sort_order, h.created_at;
$$;

comment on function public.get_habit_stats(date) is
  'Skuteczność 7/30 dni, serie i ostatnie 14 dni dla każdego aktywnego nawyku.';

revoke all on function public.get_daily_summary(date, date) from public;
grant execute on function public.get_daily_summary(date, date) to authenticated, service_role;

revoke all on function public.get_habit_stats(date) from public;
grant execute on function public.get_habit_stats(date) to authenticated, service_role;
