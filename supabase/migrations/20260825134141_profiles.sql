-- Profil użytkownika: 1:1 z auth.users, tworzony automatycznie triggerem.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/Warsaw',
  day_start_hour smallint not null default 4
    check (day_start_hour between 0 and 12),
  locale text not null default 'pl',
  subscription_tier text not null default 'free',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Ustawienia użytkownika. day_start_hour wyznacza granicę doby logicznej.';
comment on column public.profiles.day_start_hour is
  'Godzina, o której zaczyna się „dzisiaj". Odhaczenie o 1:30 domyka dzień poprzedni.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Brak polityki DELETE celowo: kasowanie konta idzie przez
-- public.delete_user_account(), nie przez bezpośredni DELETE z klienta.

-- Trigger zakładający profil ------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'pl')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Zakłada wiersz w public.profiles po rejestracji w auth.users.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Granty ---------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;
grant select, insert, update on public.profiles to authenticated;
