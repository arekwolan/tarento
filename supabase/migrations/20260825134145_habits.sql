-- Nawyki i dzienne wpisy.

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  icon text,
  color text,
  unit text not null default 'none'
    check (unit in ('minutes', 'seconds', 'reps', 'pages', 'count', 'none')),
  start_value numeric not null default 1,
  increment_value numeric not null default 0,
  target_value numeric,
  progression_mode text not null default 'completion'
    check (progression_mode in ('completion', 'calendar')),
  schedule_type text not null default 'daily'
    check (schedule_type in ('daily', 'weekdays', 'custom')),
  schedule_days smallint[],
  reminder_time time,
  time_of_day text
    check (time_of_day in ('morning', 'afternoon', 'evening')),
  source_book text,
  source_author text,
  sort_order integer not null default 0,
  started_on date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_custom_schedule_days_present check (
    schedule_type <> 'custom'
    or (
      schedule_days is not null
      and array_length(schedule_days, 1) between 1 and 7
      and schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  )
);

comment on table public.habits is
  'Nawyk użytkownika. Nie kasujemy fizycznie — ustawiamy archived_at.';
comment on column public.habits.target_value is
  'Sufit progresji. NULL = brak sufitu.';
comment on column public.habits.schedule_days is
  'Dni tygodnia dla schedule_type = custom. 0 = niedziela, 6 = sobota.';

create index habits_user_id_sort_order_idx
  on public.habits (user_id, sort_order)
  where archived_at is null;

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  status text not null check (status in ('done', 'partial', 'skipped')),
  target_value numeric not null,
  value_completed numeric,
  note text,
  completed_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

comment on table public.habit_logs is
  'Jeden wpis na nawyk na dzień. Odznaczenie kasuje wiersz.';
comment on column public.habit_logs.target_value is
  'Snapshot celu z dnia wpisu — późniejsza zmiana nawyku nie przepisuje historii.';

create index habit_logs_user_id_log_date_idx
  on public.habit_logs (user_id, log_date desc);

-- RLS -----------------------------------------------------------------------

alter table public.habits enable row level security;

create policy "habits_select_own"
  on public.habits for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "habits_insert_own"
  on public.habits for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "habits_update_own"
  on public.habits for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: nawyk się archiwizuje (archived_at),
-- nie kasuje. Patrz CLAUDE.md, reguła krytyczna 4.

alter table public.habit_logs enable row level security;

create policy "habit_logs_select_own"
  on public.habit_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "habit_logs_insert_own"
  on public.habit_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "habit_logs_update_own"
  on public.habit_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE jest tu potrzebne: to odznaczenie nawyku, nie kasowanie danych
-- historycznych. Bez tego nie da się cofnąć omyłkowego odhaczenia.
create policy "habit_logs_delete_own"
  on public.habit_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Granty ---------------------------------------------------------------------

revoke all on public.habits from anon, authenticated;
grant all on public.habits to service_role;
grant select, insert, update on public.habits to authenticated;

revoke all on public.habit_logs from anon, authenticated;
grant all on public.habit_logs to service_role;
grant select, insert, update, delete on public.habit_logs to authenticated;
