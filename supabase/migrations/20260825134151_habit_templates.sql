-- Katalog startowy nawyków. Odczyt publiczny, zapis tylko przez seed/migracje.

create table public.habit_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  unit text not null default 'none'
    check (unit in ('minutes', 'seconds', 'reps', 'pages', 'count', 'none')),
  start_value numeric not null default 1,
  increment_value numeric not null default 0,
  target_value numeric,
  progression_mode text not null default 'completion'
    check (progression_mode in ('completion', 'calendar')),
  source_book text,
  source_author text,
  category text
    check (category in ('mindfulness', 'health', 'focus', 'learning', 'relationships')),
  language text not null default 'pl',
  sort_order integer
);

comment on table public.habit_templates is
  'Gotowe nawyki do wyboru przy onboardingu. Odczyt publiczny.';

create index habit_templates_language_sort_order_idx
  on public.habit_templates (language, sort_order);

-- RLS -----------------------------------------------------------------------

alter table public.habit_templates enable row level security;

create policy "habit_templates_select_all"
  on public.habit_templates for select
  to anon, authenticated
  using (true);

-- Brak polityk INSERT/UPDATE/DELETE: katalog jest tylko do odczytu z klienta.

-- Granty ---------------------------------------------------------------------

revoke all on public.habit_templates from anon, authenticated;
grant all on public.habit_templates to service_role;
grant select on public.habit_templates to anon, authenticated;
