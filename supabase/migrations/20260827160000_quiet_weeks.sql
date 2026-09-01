-- Cichy tydzień: aplikacja robi się cichsza, kiedy użytkownikowi jest ciężko.
--
-- Dokładna odwrotność każdego podręcznika retencji i celowa decyzja
-- produktowa. Po siedmiu słabych dniach przypomnienia gasną na tydzień
-- i aplikacja nic o tym nie mówi — żadnego „wróć", żadnego „tęsknimy".
-- Jedyny ślad jest w ustawieniach, dla kogoś, kto sam tam zajrzy.

create table public.quiet_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_on date not null,
  ends_on date not null,
  ended_early_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quiet_weeks_order check (ends_on > started_on)
);

comment on table public.quiet_weeks is
  'Okres wyciszenia przypomnień po siedmiu słabych dniach. Wchodzi sam,
   kończy się sam, i w obie strony milczy.';
comment on column public.quiet_weeks.ended_early_at is
  'Użytkownik włączył przypomnienia z powrotem przed czasem. Wiersz zostaje,
   bo od niego liczy się odstęp do kolejnego wyciszenia.';

create index quiet_weeks_user_id_started_on_idx
  on public.quiet_weeks (user_id, started_on desc);

-- RLS -----------------------------------------------------------------------

alter table public.quiet_weeks enable row level security;

create policy "quiet_weeks_select_own"
  on public.quiet_weeks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "quiet_weeks_insert_own"
  on public.quiet_weeks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE jest potrzebne: „Włącz teraz" ustawia ended_early_at na wierszu,
-- który już istnieje.
create policy "quiet_weeks_update_own"
  on public.quiet_weeks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo (CLAUDE.md, reguła krytyczna 4): historia
-- wyciszeń jest tym, co powstrzymuje aplikację przed wyciszaniem w kółko.

-- Granty ---------------------------------------------------------------------

revoke all on public.quiet_weeks from anon, authenticated;
grant all on public.quiet_weeks to service_role;
grant select, insert, update on public.quiet_weeks to authenticated;
