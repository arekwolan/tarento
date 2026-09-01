-- Budżet czasu: kształt doby (szablon), zajęte pasy w dobie (bloki) i rotacja,
-- która przypisuje szablony do kolejnych dni.
--
-- Model celowo nie zna pojęcia „tygodnia". Rotacja to uporządkowana lista
-- szablonów plus data zakotwiczenia; dzień wskazuje szablon resztą z dzielenia.
-- Ten jeden mechanizm obsługuje 12-godzinny system D-D-N-N-W-W-W, dwutygodniowy
-- plan zajęć studenta i „co drugi weekend u dziecka" bez kodu specjalnego.

create table public.day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null
    check (kind in ('workday', 'free', 'night_shift', 'care', 'custom')),
  wake_time time not null default '06:30',
  sleep_time time not null default '23:00',
  self_minutes smallint not null default 30
    check (self_minutes between 0 and 480),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.day_templates is
  'Kształt jednego typu doby. Nie kasujemy fizycznie — ustawiamy archived_at.';
comment on column public.day_templates.self_minutes is
  'Ile minut na dobę użytkownik daje sobie na siebie. Z tej liczby liczy się sufit propozycji.';
comment on column public.day_templates.sleep_time is
  'Godzina pójścia spać. Wcześniejsza niż wake_time oznacza czuwanie przez północ (dyżur nocny).';

create index day_templates_user_id_sort_order_idx
  on public.day_templates (user_id, sort_order)
  where archived_at is null;

create trigger day_templates_set_updated_at
  before update on public.day_templates
  for each row execute function public.set_updated_at();

create table public.day_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.day_templates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  kind text not null
    check (kind in ('work', 'commute', 'care', 'fixed', 'meal', 'sleep')),
  start_time time not null,
  end_time time not null,
  archived_at timestamptz,
  constraint day_blocks_order check (start_time < end_time)
);

comment on table public.day_blocks is
  'Zajęty pas wewnątrz szablonu doby. Nie kasujemy fizycznie — ustawiamy archived_at.';
comment on constraint day_blocks_order on public.day_blocks is
  'Bloki przechodzące przez północ (dyżur nocny) rozbijamy na dwa wiersze przy zapisie: do 24:00 i od 00:00. CHECK celowo tego nie dopuszcza, bo arytmetyka okna staje się wtedy jednoznaczna.';

create index day_blocks_template_id_start_time_idx
  on public.day_blocks (template_id, start_time)
  where archived_at is null;

create table public.day_rotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  anchor_date date not null,
  template_ids uuid[] not null
    check (array_length(template_ids, 1) between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.day_rotations is
  'Przypisanie szablonów do dni: indeks = (data - anchor_date) mod długość tablicy.';
comment on column public.day_rotations.template_ids is
  'Domyślna rotacja ma długość 7 i odpowiada dniom tygodnia — zwykły użytkownik nigdy nie widzi pojęcia rotacji. Dłuższe tablice obsługują zmianowość i plan studenta.';

create trigger day_rotations_set_updated_at
  before update on public.day_rotations
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------

alter table public.day_templates enable row level security;

create policy "day_templates_select_own"
  on public.day_templates for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "day_templates_insert_own"
  on public.day_templates for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "day_templates_update_own"
  on public.day_templates for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: szablon się archiwizuje (archived_at),
-- nie kasuje. Patrz CLAUDE.md, reguła krytyczna 4.

alter table public.day_blocks enable row level security;

create policy "day_blocks_select_own"
  on public.day_blocks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "day_blocks_insert_own"
  on public.day_blocks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "day_blocks_update_own"
  on public.day_blocks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: blok też się archiwizuje.

alter table public.day_rotations enable row level security;

create policy "day_rotations_select_own"
  on public.day_rotations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "day_rotations_insert_own"
  on public.day_rotations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "day_rotations_update_own"
  on public.day_rotations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE jest tu dozwolone: rotacja to bieżące ustawienie, a nie dane
-- historyczne — jej skasowanie niczego użytkownikowi nie zabiera.
create policy "day_rotations_delete_own"
  on public.day_rotations for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Granty ---------------------------------------------------------------------

revoke all on public.day_templates from anon, authenticated;
grant all on public.day_templates to service_role;
grant select, insert, update on public.day_templates to authenticated;

revoke all on public.day_blocks from anon, authenticated;
grant all on public.day_blocks to service_role;
grant select, insert, update on public.day_blocks to authenticated;

revoke all on public.day_rotations from anon, authenticated;
grant all on public.day_rotations to service_role;
grant select, insert, update, delete on public.day_rotations to authenticated;
