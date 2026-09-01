-- Serie dla wszystkich aktywnych nawyków naraz.
--
-- Ekran „Dziś" pokazuje płomień przy każdej pozycji. Wołanie
-- get_habit_streak() osobno dla każdego nawyku oznaczałoby tyle round-tripów,
-- ile nawyków — przy ekranie otwieranym kilkanaście razy dziennie to
-- najdroższa rzecz w całej aplikacji.
--
-- security invoker: RLS na habits ogranicza wynik do własnych nawyków,
-- a get_habit_streak() jest też invokerem, więc nie da się przez to
-- podejrzeć cudzej historii.
create or replace function public.get_habits_streaks()
returns table (habit_id uuid, current_streak integer, longest_streak integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, s.current_streak, s.longest_streak
  from public.habits h
  cross join lateral public.get_habit_streak(h.id) s
  where h.archived_at is null;
$$;

comment on function public.get_habits_streaks() is
  'Serie wszystkich aktywnych nawyków wywołującego, w jednym zapytaniu.';

revoke all on function public.get_habits_streaks() from public;
grant execute on function public.get_habits_streaks() to authenticated, service_role;
