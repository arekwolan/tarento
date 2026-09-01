-- Wspólne funkcje pomocnicze używane przez kolejne migracje.
--
-- Każda funkcja ma `set search_path = ''` i w pełni kwalifikowane nazwy —
-- bez tego funkcja SECURITY DEFINER daje się przechwycić przez podstawienie
-- schematu w search_path wywołującego.

-- Ustawia updated_at przy każdym UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: odświeża kolumnę updated_at.';

-- Czy nawyk o danym harmonogramie „wypada" w podanym dniu.
--
-- schedule_days używa numeracji Postgresowego extract(dow): 0 = niedziela,
-- 6 = sobota. Ta sama numeracja co Date.getDay() w JS, więc klient i baza
-- liczą tak samo.
create or replace function public.habit_is_scheduled_on(
  p_schedule_type text,
  p_schedule_days smallint[],
  p_day date
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_schedule_type
    when 'daily' then true
    when 'weekdays' then extract(isodow from p_day) between 1 and 5
    when 'custom' then coalesce(
      p_schedule_days @> array[extract(dow from p_day)::smallint],
      false
    )
    else true
  end;
$$;

comment on function public.habit_is_scheduled_on(text, smallint[], date) is
  'Czy nawyk o danym harmonogramie wypada w podanym dniu. dow: 0 = niedziela.';

-- Granty ---------------------------------------------------------------------
--
-- Domyślne uprawnienia w tym projekcie dają anon/authenticated/service_role
-- tylko Dxtm (DELETE, TRUNCATE, REFERENCES, TRIGGER) — bez SELECT/INSERT/UPDATE
-- i bez EXECUTE na funkcjach. Sama polityka RLS nic nie da, jeśli rola nie ma
-- grantu na tabelę: klient dostanie „permission denied", nie pusty wynik.
-- Dlatego każda migracja poniżej nadaje uprawnienia jawnie.

grant execute on function public.habit_is_scheduled_on(text, smallint[], date)
  to authenticated, service_role;
