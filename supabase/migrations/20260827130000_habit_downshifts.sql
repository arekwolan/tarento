-- Zmniejszenie nawyku po słabym tygodniu.
--
-- Funkcja o najwyższej wartości w produkcie, bo trafia dokładnie w moment,
-- w którym ludzie rezygnują — a właściwą interwencją jest wtedy mniejsza
-- prośba, nie większa zachęta. Tabela istnieje po to, żeby propozycja padła
-- raz, a nie przy każdym wejściu w szczegóły nawyku.

alter table public.ai_generations
  drop constraint ai_generations_kind_check;

alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in ('daily_plan', 'habit_suggestion', 'downshift'));

create table public.habit_downshifts (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  from_params jsonb not null,
  to_params jsonb
);

comment on table public.habit_downshifts is
  'Ślad po propozycji zmniejszenia nawyku. offered_at pilnuje, żeby ta sama
   propozycja nie wracała częściej niż raz na trzydzieści dni.';
comment on column public.habit_downshifts.from_params is
  'Parametry sprzed zmiany, zapisane w chwili pokazania propozycji. To z nich
   odtwarza się nawyk przy „Cofnij" — dlatego wiersz jest zapisem, a nie samą
   telemetrią.';
comment on column public.habit_downshifts.to_params is
  'Parametry po zmianie. NULL, dopóki propozycja nie została zastosowana:
   wiersz powstaje w chwili, gdy pytanie pada, a nie gdy pada odpowiedź.';
comment on column public.habit_downshifts.accepted_at is
  'Kiedy użytkownik zastosował propozycję. Cofnięcie czyści tę kolumnę:
   propozycję pokazano, ale przyjęta nie została.';

create index habit_downshifts_habit_id_offered_at_idx
  on public.habit_downshifts (habit_id, offered_at desc);

-- RLS -----------------------------------------------------------------------

alter table public.habit_downshifts enable row level security;

create policy "habit_downshifts_select_own"
  on public.habit_downshifts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "habit_downshifts_insert_own"
  on public.habit_downshifts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE jest potrzebne: zastosowanie propozycji i jej cofnięcie ustawiają
-- accepted_at na tym samym wierszu.
create policy "habit_downshifts_update_own"
  on public.habit_downshifts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo (CLAUDE.md, reguła krytyczna 4): historia
-- propozycji jest tym, co powstrzymuje aplikację przed powtarzaniem pytania.

-- Granty ---------------------------------------------------------------------

revoke all on public.habit_downshifts from anon, authenticated;
grant all on public.habit_downshifts to service_role;
grant select, insert, update on public.habit_downshifts to authenticated;

-- Wykonanie po dniach tygodnia -----------------------------------------------
--
-- Wejście dla funkcji brzegowej: która doba tygodnia wchodzi, a która nie.
-- W SQL, a nie w Deno, bo harmonogram i dni puste są już policzone po tej
-- stronie (`habit_is_scheduled_on`, `rest_days`) i drugi rachunek w innym
-- języku rozjechałby się przy pierwszej zmianie.

create or replace function public.habit_weekday_completion(
  p_habit_id uuid,
  p_days integer
)
returns table (dow smallint, scheduled integer, completed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with habit as (
    select h.*, public.logical_today(h.user_id) as today
    from public.habits h
    where h.id = p_habit_id
  ),
  days as (
    -- Bez dzisiaj: doba jeszcze trwa, a policzenie jej jako niewykonanej
    -- byłoby karą za otwarcie ekranu przed wieczorem.
    select g.day::date as day
    from habit h
    cross join generate_series(h.today - p_days, h.today - 1, interval '1 day') as g(day)
    where g.day::date >= h.started_on
  )
  select
    extract(dow from d.day)::smallint,
    count(*)::integer,
    count(*) filter (where l.status in ('done', 'partial'))::integer
  from days d
  cross join habit h
  left join public.habit_logs l
    on l.habit_id = h.id and l.log_date = d.day
  where public.habit_is_scheduled_on(h.schedule_type, h.schedule_days, d.day)
    and not exists (
      select 1
      from public.rest_days r
      where r.user_id = h.user_id
        and (r.rest_date = d.day or r.weekday = extract(dow from d.day)::smallint)
    )
  group by 1
  order by 1;
$$;

comment on function public.habit_weekday_completion(uuid, integer) is
  'Ile dni z harmonogramu wypadło i ile z nich odhaczono, w rozbiciu na dni
   tygodnia. Dni puste i dni sprzed startu nawyku nie wchodzą do rachunku.';

revoke all on function public.habit_weekday_completion(uuid, integer) from public;
grant execute on function public.habit_weekday_completion(uuid, integer) to service_role;
