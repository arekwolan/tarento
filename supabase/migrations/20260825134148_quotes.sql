-- Cytaty: treść współdzielona, przypisanie dnia i ulubione per użytkownik.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  author text not null,
  source_book text,
  language text not null default 'pl',
  tags text[],
  is_public_domain boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.quotes is
  'Katalog cytatów. Odczyt publiczny, zapis tylko przez service_role/seed.';

create index quotes_language_active_idx
  on public.quotes (language)
  where is_active;

create table public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete restrict,
  shown_on date not null,
  unique (user_id, shown_on)
);

comment on table public.daily_quotes is
  'Który cytat user zobaczył danego dnia. on delete restrict, żeby usunięcie
   cytatu nie wymazało historii — cytaty wycofuje się przez is_active.';

create table public.quote_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, quote_id)
);

-- RLS -----------------------------------------------------------------------

alter table public.quotes enable row level security;

-- Odczyt publiczny: cytat dnia ma działać także przed zalogowaniem.
create policy "quotes_select_active"
  on public.quotes for select
  to anon, authenticated
  using (is_active);

-- Brak polityk INSERT/UPDATE/DELETE: katalog zasilamy seedem i migracjami,
-- klient nie dopisuje cytatów.

alter table public.daily_quotes enable row level security;

create policy "daily_quotes_select_own"
  on public.daily_quotes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "daily_quotes_insert_own"
  on public.daily_quotes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Brak UPDATE/DELETE: raz pokazany cytat dnia zostaje w historii.

alter table public.quote_favorites enable row level security;

create policy "quote_favorites_select_own"
  on public.quote_favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "quote_favorites_insert_own"
  on public.quote_favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- DELETE jest tu potrzebne: to zdjęcie serduszka, nie kasowanie historii.
create policy "quote_favorites_delete_own"
  on public.quote_favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Granty ---------------------------------------------------------------------

revoke all on public.quotes from anon, authenticated;
grant all on public.quotes to service_role;
grant select on public.quotes to anon, authenticated;

revoke all on public.daily_quotes from anon, authenticated;
grant all on public.daily_quotes to service_role;
grant select, insert on public.daily_quotes to authenticated;

revoke all on public.quote_favorites from anon, authenticated;
grant all on public.quote_favorites to service_role;
grant select, insert, delete on public.quote_favorites to authenticated;
