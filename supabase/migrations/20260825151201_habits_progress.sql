-- Licznik wykonań na nawyk.
--
-- Potrzebny do progresji w trybie 'completion': cel na dany dzień to
-- start_value + increment_value * (liczba wcześniejszych wykonań). Bez tego
-- klient musiałby ściągać całą historię logów tylko po to, żeby ją policzyć.
--
-- p_before jest wyłączające: dla „dzisiaj" liczymy wykonania sprzed dzisiaj,
-- żeby odhaczenie nie podnosiło celu w trakcie tego samego dnia.
--
-- security invoker: RLS na habits i habit_logs ogranicza wynik do własnych
-- wierszy wywołującego.
create or replace function public.get_habits_progress(p_before date)
returns table (habit_id uuid, completed_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    h.id,
    count(l.id)::integer
  from public.habits h
  left join public.habit_logs l
    on l.habit_id = h.id
   and l.log_date < p_before
   and l.status in ('done', 'partial')
  where h.archived_at is null
  group by h.id;
$$;

comment on function public.get_habits_progress(date) is
  'Liczba wykonań każdego aktywnego nawyku sprzed podanej daty.';

revoke all on function public.get_habits_progress(date) from public;
grant execute on function public.get_habits_progress(date) to authenticated, service_role;
