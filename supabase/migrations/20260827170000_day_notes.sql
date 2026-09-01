-- Dziennik jednej linii.
--
-- Produktem tej funkcji nie jest pisanie, tylko przypomnienie: wpis wraca po
-- trzydziestu, dziewięćdziesięciu i trzystu sześćdziesięciu pięciu dniach
-- i wtedy dopiero coś znaczy. Dlatego jedna linia, bez podpowiedzi, bez skali
-- nastroju i bez tagów — i dlatego nie wolno tego rozbudować do dziennika.

create table public.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_date date not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  unique (user_id, note_date)
);

comment on table public.day_notes is
  'Jedna opcjonalna linia o dniu. Jeden wpis na dobę logiczną użytkownika.';
comment on column public.day_notes.body is
  'Limit 280 znaków jest funkcją, nie ograniczeniem technicznym: dłuższe pole
   zamienia jedną linię w dziennik, a dziennik bez przypomnień jest martwy.';

create index day_notes_user_id_note_date_idx
  on public.day_notes (user_id, note_date desc);

-- RLS -----------------------------------------------------------------------

alter table public.day_notes enable row level security;

create policy "day_notes_select_own"
  on public.day_notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "day_notes_insert_own"
  on public.day_notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "day_notes_update_own"
  on public.day_notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE jest tu dozwolone — świadome odstępstwo od CLAUDE.md, reguła 4.
-- To jest własny tekst użytkownika, a nie dane historyczne systemu: seria,
-- statystyki i mapa dni nie czytają z tej tabeli niczego. Kto napisał zdanie,
-- którego nie chce zobaczyć za rok, musi móc je skasować.
create policy "day_notes_delete_own"
  on public.day_notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Granty ---------------------------------------------------------------------

revoke all on public.day_notes from anon, authenticated;
grant all on public.day_notes to service_role;
grant select, insert, update, delete on public.day_notes to authenticated;
