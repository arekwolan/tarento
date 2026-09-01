-- List do siebie za rok.
--
-- Jednorazowy wpis pisany przy zamknięciu ścieżki i pokazywany 365 dni
-- później. To jedyna rzecz w całej aplikacji, która wraca po roku — i dlatego
-- działa. Doręczenie sprawdzamy przy wejściu na ekran „Dziś", nie
-- powiadomieniem push: list ma zastać użytkownika, a nie go wywołać.

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  written_on date not null,
  deliver_on date not null,
  delivered_at timestamptz,
  constraint letters_deliver_after_writing check (deliver_on > written_on)
);

comment on table public.letters is
  'List użytkownika do samego siebie, z datą doręczenia. Nie kasujemy —
   skasowany list cofa autorowi kawałek jego przeszłości (CLAUDE.md, reguła 4).';
comment on column public.letters.deliver_on is
  'Doba logiczna, od której list ma się pokazać. Liczona na kliencie przez
   getLogicalToday(), nie zegarem serwera.';
comment on column public.letters.delivered_at is
  'Znacznik pokazania. Pusty oznacza list, który jeszcze czeka — i to on
   decyduje, czy karta pojawi się na ekranie „Dziś".';

create index letters_user_id_due_idx
  on public.letters (user_id, deliver_on)
  where delivered_at is null;

-- RLS -----------------------------------------------------------------------

alter table public.letters enable row level security;

create policy "letters_select_own"
  on public.letters for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "letters_insert_own"
  on public.letters for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE jest potrzebne wyłącznie do postawienia delivered_at.
create policy "letters_update_own"
  on public.letters for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: listu się nie kasuje.

-- Granty ---------------------------------------------------------------------

revoke all on public.letters from anon, authenticated;
grant all on public.letters to service_role;
grant select, insert, update on public.letters to authenticated;
