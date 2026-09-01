-- Ścieżki: katalog treści i zapis użytkownika.
--
-- Zasada nadrzędna całego modułu: ścieżka NIE dostaje własnego silnika
-- śledzenia. Praktyka ścieżki materializuje się jako zwykły wiersz
-- w public.habits z ustawionym source_path_id i source_stage_id, a tabela
-- user_path_practices jest mostem między definicją a tym wierszem. Dzięki temu
-- serie, ekran „Dziś", powiadomienia, statystyki i tryb offline obsługują
-- ścieżki od pierwszego dnia, bez drugiej implementacji czegokolwiek.
--
-- Podział na dwie połowy: paths / path_stages / path_practices / path_readings
-- to treść — wersjonowana, wspólna, wypełniana migracjami, tylko do odczytu
-- z klienta. user_paths i user_path_practices to dane użytkownika, chronione
-- zwykłym auth.uid() = user_id.

-- Treść ----------------------------------------------------------------------

create table public.paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null default 1,
  title text not null,
  hook text not null,
  honesty text,
  duration_days smallint not null check (duration_days > 0),
  language text not null default 'pl',
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

comment on table public.paths is
  'Definicja ścieżki. Treść jest niemutowalna: poprawka etapu to nowy wiersz
   z podbitą wersją, bo zapisani użytkownicy są przypięci do wersji, którą
   zaczęli (user_paths.path_id). Bez tego zmiana treści przepisywałaby ścieżkę
   komuś, kto jest na 47. dniu.';
comment on column public.paths.hook is
  'Jedno zdanie na karcie katalogu.';
comment on column public.paths.honesty is
  'Akapit o uczciwości wobec źródeł — renderowany pod hookiem, nie drobnym
   drukiem. NULL dla ścieżek, które nie mają źródeł historycznych i nie udają,
   że mają.';
comment on column public.paths.language is
  'Język treści. UNIQUE obejmuje wyłącznie (slug, version), więc jedna wersja
   ścieżki ma jeden język — wariant obcojęzyczny wymaga osobnego numeru wersji
   albo przeniesienia tekstów do i18n. Ta decyzja zapada przy pierwszej ścieżce
   z treścią, nie tutaj.';

create index paths_language_sort_order_idx
  on public.paths (language, sort_order)
  where is_published;

create table public.path_stages (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  ordinal smallint not null,
  name text not null,
  description text not null,
  daily_minutes_p50 smallint not null check (daily_minutes_p50 >= 0),
  min_days smallint not null check (min_days >= 0),
  max_days smallint not null,
  completion_threshold numeric not null
    check (completion_threshold between 0 and 1),
  unique (path_id, ordinal),
  constraint path_stages_days check (min_days <= max_days)
);

comment on table public.path_stages is
  'Etap ścieżki. Kryterium przejścia jest koniunkcją z sufitem: dni w etapie
   >= min_days AND wykonanie z 14 dni >= completion_threshold, a po max_days
   etap przechodzi bez względu na próg.';
comment on column public.path_stages.max_days is
  'Sufit etapu. Kolumna jest obowiązkowa, bo ścieżka nie może uwięzić
   użytkownika w pierwszym etapie: po max_days przechodzimy mimo niespełnionego
   progu, z łagodniejszym komunikatem. Kryterium czysto kalendarzowe karałoby
   osobę, która zaczęła i zgubiła tydzień — stąd próg; sam próg potrafiłby
   zatrzymać ją na zawsze — stąd sufit.';
comment on column public.path_stages.daily_minutes_p50 is
  'Deklarowane zapotrzebowanie etapu na dobę. Wejście do bramki budżetowej —
   ścieżka deklaruje, budżet użytkownika rozstrzyga.';

create table public.path_practices (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.path_stages (id) on delete cascade,
  title text not null,
  why text not null,
  how text not null,
  when_hard text,
  unit text not null
    check (unit in ('minutes', 'seconds', 'reps', 'pages', 'count', 'none')),
  start_value numeric not null default 1,
  increment_value numeric not null default 0,
  target_value numeric,
  progression_mode text not null default 'completion'
    check (progression_mode in ('completion', 'calendar')),
  schedule_type text not null default 'daily'
    check (schedule_type in ('daily', 'weekdays', 'custom')),
  schedule_days smallint[],
  time_of_day text
    check (time_of_day in ('morning', 'afternoon', 'evening')),
  category text
    check (category in ('mindfulness', 'health', 'focus', 'learning', 'relationships')),
  is_optional boolean not null default false,
  retires_practice_id uuid references public.path_practices (id),
  sort_order integer not null default 0,
  constraint path_practices_custom_schedule_days_present check (
    schedule_type <> 'custom'
    or (
      schedule_days is not null
      and array_length(schedule_days, 1) between 1 and 7
      and schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  )
);

comment on table public.path_practices is
  'Praktyka etapu: pełne odbicie parametrów public.habits, bo przy zapisie
   przepisuje się jeden do jednego na wiersz nawyku.';
comment on column public.path_practices.why is
  'Jedno zdanie: po co. Pokazywane na liście „dochodzi" przy przejściu etapu.';
comment on column public.path_practices.how is
  'Jedno zdanie: jak. Trafia do description materializowanego nawyku.';
comment on column public.path_practices.when_hard is
  'Jedno zdanie: co zrobić, gdy nie idzie. Nigdy „odpuść" — zawsze mniejsza
   wersja tej samej praktyki.';
comment on column public.path_practices.is_optional is
  'Praktyka wyłączalna przy zapisie. Obowiązkowej nie da się pominąć — to
   granica między dopasowaniem ścieżki a rozmontowaniem jej.';
comment on column public.path_practices.retires_practice_id is
  'Praktyka, która schodzi z listy, gdy ta wchodzi. Ścieżka kończąca się
   dwunastoma nawykami jest nieudana, choćby użytkownik ją domknął — dlatego
   każdy etap coś oddaje.';
comment on constraint path_practices_custom_schedule_days_present on public.path_practices is
  'Odbicie constraintu habits_custom_schedule_days_present. Praktyka bez dni
   tygodnia wywróciłaby się dopiero przy zapisie na ścieżkę, czyli u
   użytkownika, a nie u autora treści.';

create index path_practices_stage_id_sort_order_idx
  on public.path_practices (stage_id, sort_order);

create table public.path_readings (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.path_stages (id) on delete cascade,
  week smallint not null check (week > 0),
  title text not null,
  author text,
  source_kind text not null
    check (source_kind in
      ('public_domain', 'own_translation', 'citation', 'pointer', 'original')),
  attribution text,
  body text,
  framing text not null,
  constraint path_readings_pointer_has_no_body check
    (source_kind <> 'pointer' or body is null)
);

comment on table public.path_readings is
  'Lektura przypisana do tygodnia etapu. Cztery reżimy prawne siedzą
   w source_kind: domena publiczna, przekład własny, cytat w ramach prawa
   cytatu i wskazanie do cudzej książki.';
comment on column public.path_readings.framing is
  'Własna rama, około stu słów: dlaczego ten fragment, na co zwrócić uwagę, co
   z tego wchodzi do praktyki jutro. Wymagana zawsze — przy wskazaniu jest
   jedyną treścią, jaką aplikacja renderuje.';
comment on column public.path_readings.attribution is
  '„Przekład własny z …" albo dane wydania. Domena publiczna oryginału nie
   oznacza domeny publicznej przekładu, więc atrybucja jest częścią treści,
   nie ozdobą.';
comment on constraint path_readings_pointer_has_no_body on public.path_readings is
  'Zabezpieczenie prawne wpisane w schemat, nie w dyscyplinę: wskazanie do
   współczesnej książki nie może renderować treści źródła. Przy source_kind
   „pointer" aplikacja pokazuje wyłącznie własną ramę, więc body musi być
   NULL-em i nie da się tam przypadkiem wkleić rozdziału.';

create index path_readings_stage_id_week_idx
  on public.path_readings (stage_id, week);

-- Zapis użytkownika ----------------------------------------------------------

create table public.user_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  path_id uuid not null references public.paths (id),
  state text not null default 'active'
    check (state in ('active', 'paused', 'ended')),
  current_stage_id uuid references public.path_stages (id),
  stage_entered_on date not null,
  started_on date not null,
  paused_at timestamptz,
  ended_at timestamptz,
  ended_reason text
    check (ended_reason in ('completed', 'abandoned', 'replaced')),
  reentry_until date,
  fit jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_paths is
  'Zapis użytkownika na ścieżkę. Trzy stany, nie dwa: pauza jest jawna, darmowa
   i bez limitu, więc porzucenie nie musi być końcem.';
comment on column public.user_paths.path_id is
  'Przypięcie do konkretnej WERSJI ścieżki. Bez ON DELETE: treść, na której
   ktoś jest w trakcie, nie może zniknąć spod niego.';
comment on column public.user_paths.reentry_until is
  'Koniec tygodnia wejściowego po powrocie z pauzy. Do tej daty praktyki idą
   na obniżonych parametrach.';
comment on column public.user_paths.fit is
  'Wynik dopasowania ścieżki do kontekstu użytkownika: { lite, skip, adjust,
   note }. To dokument JSON, a nie kolumny, więc klucze zostają w camelCase.
   NULL oznacza ścieżkę wziętą bez dopasowania i jest poprawnym stanem.';

-- Jedna aktywna ścieżka naraz. To decyzja produktowa, nie ograniczenie
-- techniczne: dwie równoległe ścieżki gwarantują przekroczenie budżetu doby,
-- a wtedy budżet przestaje cokolwiek rozstrzygać.
create unique index user_paths_one_active_idx
  on public.user_paths (user_id)
  where state = 'active';

create index user_paths_user_id_started_on_idx
  on public.user_paths (user_id, started_on desc);

create trigger user_paths_set_updated_at
  before update on public.user_paths
  for each row execute function public.set_updated_at();

create table public.user_path_practices (
  id uuid primary key default gen_random_uuid(),
  user_path_id uuid not null references public.user_paths (id) on delete cascade,
  practice_id uuid not null references public.path_practices (id),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  activated_on date not null,
  retired_on date,
  unique (user_path_id, practice_id)
);

comment on table public.user_path_practices is
  'Most między definicją praktyki a wierszem w public.habits. Jedyne miejsce,
   które wie, że dany nawyk pochodzi ze ścieżki — sam nawyk jest zwykłym
   nawykiem.';
comment on column public.user_path_practices.retired_on is
  'Dzień, w którym ścieżka zdjęła praktykę z listy. Wiersz zostaje: historia
   napędza serie i statystyki.';

create index user_path_practices_user_path_id_idx
  on public.user_path_practices (user_path_id);

create index user_path_practices_habit_id_idx
  on public.user_path_practices (habit_id);

-- Pochodzenie nawyku ---------------------------------------------------------

alter table public.habits
  add column source_path_id uuid references public.paths (id),
  add column source_stage_id uuid references public.path_stages (id),
  add column retired_at timestamptz;

comment on column public.habits.source_path_id is
  'Ścieżka, która wygenerowała ten nawyk. NULL dla nawyków dodanych ręcznie —
   poza tym są to te same wiersze i ekran „Dziś" ich nie rozróżnia.';
comment on column public.habits.retired_at is
  'Ścieżka zdjęła nawyk z listy. Co innego niż archived_at, które oznacza
   „użytkownik usunął": odczyty ekranu „Dziś" filtrują oba, ale statystyki
   i mapa dni nie filtrują żadnego — wycofana praktyka zostaje w historii.';

create index habits_source_path_id_idx
  on public.habits (source_path_id)
  where source_path_id is not null;

-- RLS -----------------------------------------------------------------------
--
-- Katalog treści jest publiczny do odczytu i zamknięty do zapisu: wypełniają go
-- migracje, nie klient. Widoczność etapu, praktyki i lektury wynika z ich
-- ścieżki, dlatego polityki idą po joinie do paths zamiast powielać flagę
-- is_published w trzech tabelach.

alter table public.paths enable row level security;

create policy "paths_select_published"
  on public.paths for select
  to anon, authenticated
  using (is_published);

-- Brak polityk INSERT/UPDATE/DELETE: katalog jest tylko do odczytu z klienta.

alter table public.path_stages enable row level security;

create policy "path_stages_select_published"
  on public.path_stages for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.paths p
      where p.id = path_stages.path_id
        and p.is_published
    )
  );

alter table public.path_practices enable row level security;

create policy "path_practices_select_published"
  on public.path_practices for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.path_stages s
      join public.paths p on p.id = s.path_id
      where s.id = path_practices.stage_id
        and p.is_published
    )
  );

alter table public.path_readings enable row level security;

create policy "path_readings_select_published"
  on public.path_readings for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.path_stages s
      join public.paths p on p.id = s.path_id
      where s.id = path_readings.stage_id
        and p.is_published
    )
  );

alter table public.user_paths enable row level security;

create policy "user_paths_select_own"
  on public.user_paths for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_paths_insert_own"
  on public.user_paths for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_paths_update_own"
  on public.user_paths for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: ścieżkę się kończy (state 'ended'), nie kasuje.
-- Patrz CLAUDE.md, reguła krytyczna 4.

alter table public.user_path_practices enable row level security;

create policy "user_path_practices_select_own"
  on public.user_path_practices for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_path_practices_insert_own"
  on public.user_path_practices for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_path_practices_update_own"
  on public.user_path_practices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Brak polityki DELETE celowo: wycofanie praktyki to retired_on, nie kasowanie
-- wiersza — most do nawyku jest jedynym zapisem tego, skąd on się wziął.

-- Granty ---------------------------------------------------------------------

revoke all on public.paths from anon, authenticated;
grant all on public.paths to service_role;
grant select on public.paths to anon, authenticated;

revoke all on public.path_stages from anon, authenticated;
grant all on public.path_stages to service_role;
grant select on public.path_stages to anon, authenticated;

revoke all on public.path_practices from anon, authenticated;
grant all on public.path_practices to service_role;
grant select on public.path_practices to anon, authenticated;

revoke all on public.path_readings from anon, authenticated;
grant all on public.path_readings to service_role;
grant select on public.path_readings to anon, authenticated;

revoke all on public.user_paths from anon, authenticated;
grant all on public.user_paths to service_role;
grant select, insert, update on public.user_paths to authenticated;

revoke all on public.user_path_practices from anon, authenticated;
grant all on public.user_path_practices to service_role;
grant select, insert, update on public.user_path_practices to authenticated;
