-- B2: Laboratorium książki na istniejącym silniku paths/user_paths.
--
-- Prywatny protokół nadal jest zwykłą, wersjonowaną ścieżką. Notatki służą
-- wyłącznie do przygotowania draftu; po zatwierdzeniu praktyki przechodzą przez
-- ten sam enroll_in_path, lifecycle, budżet i materializację habits co B1.

-- Prywatna wersja ścieżki ---------------------------------------------------

alter table public.paths
  add column owner_id uuid references public.profiles (id) on delete cascade,
  add column origin_kind text not null default 'curated'
    check (origin_kind in ('curated', 'private')),
  add column version_parent_id uuid references public.paths (id),
  add column archived_at timestamptz,
  add constraint paths_origin_owner_check check (
    (origin_kind = 'curated' and owner_id is null)
    or (origin_kind = 'private' and owner_id is not null and not is_published)
  );

alter table public.paths
  drop constraint paths_book_protocol_provenance_check,
  add constraint paths_book_protocol_provenance_check check (
    (
      path_kind = 'tarento'
      and origin_kind = 'curated'
      and source_type is null
      and source_title is null
      and source_author is null
      and source_edition is null
      and source_identifier is null
      and curated_by is null
      and review_status = 'not_applicable'
      and disclaimer is null
    )
    or
    (
      path_kind = 'book_protocol'
      and source_type = 'book'
      and nullif(btrim(source_title), '') is not null
      and nullif(btrim(source_author), '') is not null
      and nullif(btrim(disclaimer), '') is not null
      and (
        (
          origin_kind = 'curated'
          and curated_by = 'Tarento'
          and review_status <> 'not_applicable'
        )
        or
        (
          origin_kind = 'private'
          and curated_by = 'Własne notatki w Tarento'
          and review_status = 'draft'
        )
      )
    )
  );

comment on column public.paths.owner_id is
  'Właściciel prywatnej ścieżki. NULL oznacza treść redakcyjną katalogu.';
comment on column public.paths.origin_kind is
  'curated = treść redakcyjna; private = protokół właściciela z Laboratorium.';
comment on column public.paths.version_parent_id is
  'Poprzednia prywatna wersja. Edycja tworzy nowy wiersz i nie zmienia wersji,
   do której jest przypięty istniejący user_path.';
comment on column public.paths.archived_at is
  'Soft delete prywatnego protokołu. Aktywnej ani wstrzymanej wersji nie można
   zarchiwizować.';

create index paths_owner_created_at_idx
  on public.paths (owner_id, created_at desc)
  where owner_id is not null;

create index paths_version_parent_id_idx
  on public.paths (version_parent_id)
  where version_parent_id is not null;

-- Elementy draftu korzystają z istniejących etapów i praktyk. Te kolumny
-- przechowują wyłącznie autorskie, krótkie instrukcje i provenance do numerów
-- prywatnych notatek, nigdy treść książki.
alter table public.path_stages
  add column environment_setup text,
  add column environment_setup_note_ordinals smallint[],
  add column transition_criterion text,
  add column transition_note_ordinals smallint[],
  add constraint path_stages_book_lab_text_length_check check (
    (environment_setup is null or char_length(environment_setup) between 1 and 240)
    and (transition_criterion is null or char_length(transition_criterion) between 1 and 240)
  ),
  add constraint path_stages_book_lab_note_refs_check check (
    (environment_setup is null) = (environment_setup_note_ordinals is null)
    and (environment_setup_note_ordinals is null
      or cardinality(environment_setup_note_ordinals) between 1 and 7)
    and (transition_criterion is null) = (transition_note_ordinals is null)
    and (transition_note_ordinals is null
      or cardinality(transition_note_ordinals) between 1 and 7)
  );

alter table public.path_practices
  add column source_note_ordinals smallint[],
  add constraint path_practices_source_note_refs_check check (
    source_note_ordinals is null or cardinality(source_note_ordinals) between 1 and 7
  );

comment on column public.path_stages.environment_setup is
  'Opcjonalne jednorazowe przygotowanie środowiska; nie materializuje nawyku.';
comment on column public.path_stages.transition_criterion is
  'Czytelny warunek przejścia. Liczbowe min/max/threshold nadal sterują lifecycle.';
comment on column public.path_practices.source_note_ordinals is
  'Numery prywatnych notatek, z których wynika praktyka. Bez tekstu źródła.';

-- Prywatne wejście i draft AI ----------------------------------------------

create table public.book_lab_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  request_key uuid not null,
  base_path_id uuid references public.paths (id),
  source_title text not null check (char_length(btrim(source_title)) between 1 and 160),
  source_author text not null check (char_length(btrim(source_author)) between 1 and 120),
  desired_change text not null
    check (char_length(btrim(desired_change)) between 1 and 240),
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  status text not null default 'generating'
    check (status in ('generating', 'generated', 'failed', 'saved', 'archived')),
  generated_draft jsonb,
  path_id uuid unique references public.paths (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, request_key),
  unique (id, owner_id),
  constraint book_lab_project_path_state_check check (
    (status = 'saved' and path_id is not null)
    or (status in ('generating', 'generated', 'failed') and path_id is null)
    or status = 'archived'
  )
);

comment on table public.book_lab_projects is
  'Prywatne wejście i walidowany draft Laboratorium. request_key daje
   idempotencję generowania, path_id idempotencję zatwierdzenia.';
comment on column public.book_lab_projects.generated_draft is
  'Oryginalna odpowiedź po walidacji. Edytowana wersja trafia do paths dopiero
   przez save_book_lab_protocol; ai_generations nie przechowuje prywatnego tekstu.';

create index book_lab_projects_owner_created_at_idx
  on public.book_lab_projects (owner_id, created_at desc);

create index book_lab_projects_owner_active_idx
  on public.book_lab_projects (owner_id, status)
  where archived_at is null;

create trigger book_lab_projects_set_updated_at
  before update on public.book_lab_projects
  for each row execute function public.set_updated_at();

create table public.book_lab_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  ordinal smallint not null check (ordinal between 1 and 7),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  source_locator text check (source_locator is null or char_length(source_locator) <= 80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, ordinal),
  constraint book_lab_notes_project_owner_fkey
    foreign key (project_id, owner_id)
    references public.book_lab_projects (id, owner_id)
    on delete cascade
);

comment on table public.book_lab_notes is
  '3–7 prywatnych idei użytkownika. Pointer jest metadanym wskazaniem; uploadu
   ani treści książki Laboratorium nie przyjmuje.';

create index book_lab_notes_project_ordinal_idx
  on public.book_lab_notes (project_id, ordinal)
  where archived_at is null;

-- RLS dziedziczone po właścicielu rodzica ----------------------------------

alter table public.paths enable row level security;
alter table public.path_stages enable row level security;
alter table public.path_practices enable row level security;
alter table public.path_readings enable row level security;
alter table public.book_lab_projects enable row level security;
alter table public.book_lab_notes enable row level security;

drop policy if exists "paths_select_published" on public.paths;
create policy "paths_select_visible"
  on public.paths for select
  to anon, authenticated
  using (
    (
      owner_id is null
      and is_published
      and archived_at is null
    )
    or (
      (select auth.uid()) is not null
      and owner_id = (select auth.uid())
    )
  );

drop policy if exists "path_stages_select_published" on public.path_stages;
create policy "path_stages_select_visible_parent"
  on public.path_stages for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.paths p
      where p.id = path_stages.path_id
        and (
          (p.owner_id is null and p.is_published and p.archived_at is null)
          or (p.owner_id = (select auth.uid()))
        )
    )
  );

drop policy if exists "path_practices_select_published" on public.path_practices;
create policy "path_practices_select_visible_parent"
  on public.path_practices for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.path_stages s
      join public.paths p on p.id = s.path_id
      where s.id = path_practices.stage_id
        and (
          (p.owner_id is null and p.is_published and p.archived_at is null)
          or (p.owner_id = (select auth.uid()))
        )
    )
  );

drop policy if exists "path_readings_select_published" on public.path_readings;
create policy "path_readings_select_visible_parent"
  on public.path_readings for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.path_stages s
      join public.paths p on p.id = s.path_id
      where s.id = path_readings.stage_id
        and (
          (p.owner_id is null and p.is_published and p.archived_at is null)
          or (p.owner_id = (select auth.uid()))
        )
    )
  );

create policy "book_lab_projects_select_own"
  on public.book_lab_projects for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "book_lab_notes_select_via_parent"
  on public.book_lab_notes for select
  to authenticated
  using (
    exists (
      select 1 from public.book_lab_projects project
      where project.id = book_lab_notes.project_id
        and project.owner_id = (select auth.uid())
        and book_lab_notes.owner_id = project.owner_id
    )
  );

-- Brak polityk zapisu dla prywatnego tekstu. Edge zapisuje wejście service_role,
-- a zatwierdzenie/archiwizacja przechodzą przez ograniczone RPC.
revoke all on public.book_lab_projects from anon, authenticated;
grant all on public.book_lab_projects to service_role;
grant select on public.book_lab_projects to authenticated;

revoke all on public.book_lab_notes from anon, authenticated;
grant all on public.book_lab_notes to service_role;
grant select on public.book_lab_notes to authenticated;

-- ai_generations liczy koszt, ale nie jest magazynem prywatnej treści.
alter table public.ai_generations
  drop constraint ai_generations_kind_check;

alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in (
    'daily_plan', 'habit_suggestion', 'downshift', 'path_fit', 'book_lab'
  ));

-- Twardy budżet ------------------------------------------------------------

create or replace function public.book_lab_safe_budget_ratio()
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select 0.6::numeric;
$$;

comment on function public.book_lab_safe_budget_ratio() is
  'Jedna domenowa stała B2: prywatny protokół może zająć najwyżej 60%
   aktualnie wolnego budżetu.';

create or replace function public.book_lab_item_minutes(
  p_unit text,
  p_start_value numeric
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_unit = 'minutes' then greatest(0, p_start_value)
    when p_unit = 'seconds' then greatest(0, p_start_value) / 60
    else 3
  end;
$$;

create or replace function public.book_lab_free_minutes(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_allocated integer;
  v_used numeric;
begin
  select public.logical_today(p_user_id) into v_today;
  select public.allocated_window_minutes(p_user_id, v_today) into v_allocated;

  select coalesce(sum(public.book_lab_item_minutes(h.unit, h.start_value)), 0)
  into v_used
  from public.habits h
  where h.user_id = p_user_id
    and h.archived_at is null
    and h.retired_at is null;

  return greatest(0, coalesce(v_allocated, 30) - ceil(v_used)::integer);
end;
$$;

comment on function public.book_lab_free_minutes(uuid) is
  'Wolna część okna po odjęciu aktywnych nawyków. Tytuły i notatki nie są
   potrzebne do obliczenia i nigdy nie opuszczają tabel właściciela.';

-- Walidacja wejścia user_paths pozostaje wspólna dla katalogu i prywatnych
-- wersji. Trigger nie pozwala aktywować archiwum ani cudzej prywatnej ścieżki.
create or replace function public.validate_user_path_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path public.paths%rowtype;
  v_free integer;
  v_first_stage_minutes integer;
begin
  if (select auth.uid()) is not null
     and new.user_id <> (select auth.uid()) then
    raise exception 'user_path_parent: użytkownik nie jest właścicielem wpisu'
      using errcode = '42501';
  end if;

  select * into v_path from public.paths where id = new.path_id;

  if not found
     or v_path.archived_at is not null
     or (v_path.owner_id is null and not v_path.is_published)
     or (v_path.owner_id is not null and v_path.owner_id <> new.user_id) then
    raise exception 'user_path_parent: ścieżka nie jest dostępna'
      using errcode = '42501';
  end if;

  if v_path.origin_kind = 'private' then
    v_free := public.book_lab_free_minutes(new.user_id);
    select stage.daily_minutes_p50
    into v_first_stage_minutes
    from public.path_stages stage
    where stage.path_id = v_path.id
    order by stage.ordinal
    limit 1;

    if v_first_stage_minutes is null
       or v_first_stage_minutes > floor(
         v_free * public.book_lab_safe_budget_ratio()
       ) then
      raise exception 'user_path_parent: prywatny protokół nie mieści się w aktualnym budżecie'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger user_paths_validate_parent
  before insert or update of path_id, user_id on public.user_paths
  for each row execute function public.validate_user_path_parent();

-- Idempotentne zatwierdzenie draftu ----------------------------------------

create or replace function public.save_book_lab_protocol(
  p_project_id uuid,
  p_draft jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.book_lab_projects%rowtype;
  v_base public.paths%rowtype;
  v_path_id uuid;
  v_slug text;
  v_version integer;
  v_stage jsonb;
  v_practice jsonb;
  v_transition jsonb;
  v_setup jsonb;
  v_stage_id uuid;
  v_previous_practice_id uuid;
  v_practice_id uuid;
  v_stage_count integer;
  v_ordinal integer := 0;
  v_free integer;
  v_ceiling integer;
  v_refs smallint[];
  v_ref smallint;
  v_locator text;
  v_title text;
  v_hook text;
begin
  if v_user_id is null then
    raise exception 'save_book_lab_protocol: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  select * into v_project
  from public.book_lab_projects
  where id = p_project_id
    and owner_id = v_user_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'save_book_lab_protocol: brak draftu'
      using errcode = 'P0002';
  end if;

  -- Retry po utracie odpowiedzi zwraca ten sam path_id i niczego nie duplikuje.
  if v_project.path_id is not null then
    return v_project.path_id;
  end if;

  if v_project.status <> 'generated'
     or jsonb_typeof(p_draft) <> 'object'
     or jsonb_typeof(p_draft -> 'stages') <> 'array' then
    raise exception 'save_book_lab_protocol: niepoprawny draft'
      using errcode = '22023';
  end if;

  v_stage_count := jsonb_array_length(p_draft -> 'stages');
  if v_stage_count not between 1 and 3 then
    raise exception 'save_book_lab_protocol: protokół wymaga 1–3 etapów'
      using errcode = '23514';
  end if;

  v_title := nullif(btrim(p_draft ->> 'title'), '');
  v_hook := nullif(btrim(p_draft ->> 'summary'), '');
  if v_title is null or char_length(v_title) > 120
     or v_hook is null or char_length(v_hook) > 240 then
    raise exception 'save_book_lab_protocol: niepoprawny tytuł lub opis'
      using errcode = '23514';
  end if;

  v_free := public.book_lab_free_minutes(v_user_id);
  v_ceiling := floor(v_free * public.book_lab_safe_budget_ratio());

  -- Najpierw walidujemy cały dokument. Nic nie powstaje, jeśli choć jeden etap
  -- przekracza 60% aktualnie wolnej części budżetu.
  for v_stage in select value from jsonb_array_elements(p_draft -> 'stages') loop
    v_ordinal := v_ordinal + 1;
    v_practice := v_stage -> 'practice';
    v_transition := v_stage -> 'transition';
    v_setup := v_stage -> 'environmentSetup';

    if jsonb_typeof(v_stage) <> 'object'
       or jsonb_typeof(v_practice) <> 'object'
       or jsonb_typeof(v_transition) <> 'object'
       or (v_stage ->> 'ordinal')::integer <> v_ordinal
       or (v_stage ->> 'dailyMinutes')::integer not between 1 and 45
       or (v_stage ->> 'dailyMinutes')::integer > v_ceiling
       or char_length(btrim(v_stage ->> 'name')) not between 1 and 80
       or char_length(btrim(v_stage ->> 'description')) not between 1 and 240
       or char_length(btrim(v_practice ->> 'title')) not between 1 and 80
       or char_length(btrim(v_practice ->> 'why')) not between 1 and 240
       or char_length(btrim(v_practice ->> 'how')) not between 1 and 240
       or char_length(btrim(v_practice ->> 'whenHard')) not between 1 and 180
       or (v_practice ->> 'timeOfDay') not in ('morning', 'afternoon', 'evening')
       or (v_practice ->> 'category') not in
          ('mindfulness', 'health', 'focus', 'learning', 'relationships')
       or (v_practice ->> 'scheduleType') not in ('daily', 'weekdays', 'custom')
       or jsonb_typeof(v_practice -> 'scheduleDays') <> 'array'
       or (
         (v_practice ->> 'scheduleType') = 'custom'
         and jsonb_array_length(v_practice -> 'scheduleDays') not between 1 and 7
       )
       or (
         (v_practice ->> 'scheduleType') <> 'custom'
         and jsonb_array_length(v_practice -> 'scheduleDays') <> 0
       )
       or (v_transition ->> 'minDays')::integer not between 1 and 30
       or (v_transition ->> 'maxDays')::integer not between
          (v_transition ->> 'minDays')::integer and 60
       or (v_transition ->> 'completionThreshold')::numeric not between 0 and 1
       or char_length(btrim(v_transition ->> 'criterion')) not between 1 and 240
       or jsonb_typeof(v_practice -> 'noteOrdinals') <> 'array'
       or jsonb_array_length(v_practice -> 'noteOrdinals') not between 1 and 7
       or jsonb_typeof(v_transition -> 'noteOrdinals') <> 'array'
       or jsonb_array_length(v_transition -> 'noteOrdinals') not between 1 and 7
       or (
         v_setup is not null
         and v_setup <> 'null'::jsonb
         and (
           jsonb_typeof(v_setup) <> 'object'
           or char_length(btrim(v_setup ->> 'text')) not between 1 and 240
           or jsonb_typeof(v_setup -> 'noteOrdinals') <> 'array'
           or jsonb_array_length(v_setup -> 'noteOrdinals') not between 1 and 7
         )
       ) then
      raise exception 'save_book_lab_protocol: draft narusza schemat lub budżet'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(v_practice -> 'scheduleDays') day(value)
      where value::integer not between 0 and 6
    ) then
      raise exception 'save_book_lab_protocol: harmonogram ma niepoprawny dzień'
        using errcode = '23514';
    end if;

    for v_ref in
      select value::smallint
      from jsonb_array_elements_text(
        (v_practice -> 'noteOrdinals')
        || (v_transition -> 'noteOrdinals')
        || coalesce(v_setup -> 'noteOrdinals', '[]'::jsonb)
      )
    loop
      if not exists (
        select 1 from public.book_lab_notes note
        where note.project_id = v_project.id
          and note.owner_id = v_user_id
          and note.ordinal = v_ref
          and note.archived_at is null
      ) then
        raise exception 'save_book_lab_protocol: element wskazuje obcą notatkę'
          using errcode = '23514';
      end if;
    end loop;
  end loop;

  if v_project.base_path_id is not null then
    select * into v_base
    from public.paths
    where id = v_project.base_path_id
      and owner_id = v_user_id
      and origin_kind = 'private';

    if not found then
      raise exception 'save_book_lab_protocol: poprzednia wersja nie należy do właściciela'
        using errcode = '42501';
    end if;

    v_slug := v_base.slug;
    select coalesce(max(p.version), 0) + 1 into v_version
    from public.paths p
    where p.slug = v_slug;
  else
    v_slug := 'private-book-' || replace(v_project.id::text, '-', '');
    v_version := 1;
  end if;

  insert into public.paths (
    slug, version, title, hook, honesty, completion_note,
    duration_days, language, is_published, sort_order,
    path_kind, source_type, source_title, source_author,
    curated_by, review_status, disclaimer,
    owner_id, origin_kind, version_parent_id
  ) values (
    v_slug, v_version, v_title, v_hook,
    case when v_project.locale = 'en'
      then 'Built only from your private notes; the book was not supplied to AI.'
      else 'Opracowano wyłącznie z Twoich prywatnych notatek; AI nie dostało książki.'
    end,
    case when v_project.locale = 'en'
      then 'Keep only the practice that still serves you.'
      else 'Zostaw tylko praktykę, która nadal Ci służy.'
    end,
    v_stage_count * 14, v_project.locale, false, 0,
    'book_protocol', 'book', v_project.source_title, v_project.source_author,
    'Własne notatki w Tarento', 'draft',
    case when v_project.locale = 'en'
      then 'A private draft based on your notes. It is not a summary of the book or professional advice.'
      else 'Prywatny draft na podstawie Twoich notatek. Nie jest streszczeniem książki ani poradą specjalistyczną.'
    end,
    v_user_id, 'private', v_project.base_path_id
  ) returning id into v_path_id;

  v_ordinal := 0;
  v_previous_practice_id := null;

  for v_stage in select value from jsonb_array_elements(p_draft -> 'stages') loop
    v_ordinal := v_ordinal + 1;
    v_practice := v_stage -> 'practice';
    v_transition := v_stage -> 'transition';
    v_setup := v_stage -> 'environmentSetup';

    select array_agg(value::smallint order by value::smallint)
    into v_refs
    from jsonb_array_elements_text(v_transition -> 'noteOrdinals');

    insert into public.path_stages (
      path_id, ordinal, name, description, daily_minutes_p50,
      min_days, max_days, completion_threshold,
      environment_setup, environment_setup_note_ordinals,
      transition_criterion, transition_note_ordinals
    ) values (
      v_path_id, v_ordinal, btrim(v_stage ->> 'name'),
      btrim(v_stage ->> 'description'), (v_stage ->> 'dailyMinutes')::smallint,
      (v_transition ->> 'minDays')::smallint,
      (v_transition ->> 'maxDays')::smallint,
      (v_transition ->> 'completionThreshold')::numeric,
      case when v_setup is null or v_setup = 'null'::jsonb
        then null else btrim(v_setup ->> 'text') end,
      case when v_setup is null or v_setup = 'null'::jsonb then null else array(
        select value::smallint from jsonb_array_elements_text(v_setup -> 'noteOrdinals')
      ) end,
      btrim(v_transition ->> 'criterion'), v_refs
    ) returning id into v_stage_id;

    select array_agg(value::smallint order by value::smallint)
    into v_refs
    from jsonb_array_elements_text(v_practice -> 'noteOrdinals');

    insert into public.path_practices (
      stage_id, title, why, how, when_hard, unit,
      start_value, increment_value, progression_mode,
      schedule_type, schedule_days, time_of_day, category,
      is_optional, retires_practice_id, sort_order, source_note_ordinals
    ) values (
      v_stage_id, btrim(v_practice ->> 'title'), btrim(v_practice ->> 'why'),
      btrim(v_practice ->> 'how'), btrim(v_practice ->> 'whenHard'), 'minutes',
      (v_stage ->> 'dailyMinutes')::numeric, 0, 'completion',
      v_practice ->> 'scheduleType',
      case when (v_practice ->> 'scheduleType') = 'custom' then array(
        select value::smallint
        from jsonb_array_elements_text(v_practice -> 'scheduleDays')
        order by value::smallint
      ) else null end,
      v_practice ->> 'timeOfDay', v_practice ->> 'category',
      false, v_previous_practice_id, v_ordinal, v_refs
    ) returning id into v_practice_id;

    -- Wskazania do rozdziału/strony pozostają pointerami bez body i bez cytatu.
    for v_ref, v_locator in
      select distinct note.ordinal, note.source_locator
      from public.book_lab_notes note
      where note.project_id = v_project.id
        and note.archived_at is null
        and note.source_locator is not null
        and note.ordinal = any(
          array(
            select value::smallint
            from jsonb_array_elements_text(
              (v_practice -> 'noteOrdinals')
              || (v_transition -> 'noteOrdinals')
              || coalesce(v_setup -> 'noteOrdinals', '[]'::jsonb)
            )
          )
        )
    loop
      insert into public.path_readings (
        stage_id, week, title, author, source_kind, attribution,
        source_locator, body, framing, quote_text, quote_source
      ) values (
        v_stage_id, v_ordinal,
        case when v_project.locale = 'en'
          then 'Your note ' || v_ref
          else 'Twoja notatka ' || v_ref
        end,
        null, 'pointer',
        case when v_project.locale = 'en'
          then 'Private pointer supplied by you'
          else 'Prywatne wskazanie podane przez Ciebie'
        end,
        v_locator, null, btrim(v_stage ->> 'description'), null, null
      );
    end loop;

    v_previous_practice_id := v_practice_id;
  end loop;

  update public.book_lab_projects
  set generated_draft = p_draft,
      path_id = v_path_id,
      status = 'saved'
  where id = v_project.id;

  return v_path_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'save_book_lab_protocol: draft narusza schemat'
      using errcode = '22023';
end;
$$;

create or replace function public.archive_book_lab_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_path_id uuid;
begin
  if v_user_id is null then
    raise exception 'archive_book_lab_project: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  select path_id into v_path_id
  from public.book_lab_projects
  where id = p_project_id
    and owner_id = v_user_id
    and archived_at is null
  for update;

  if not found then return; end if;

  if v_path_id is not null and exists (
    select 1 from public.user_paths up
    where up.path_id = v_path_id and up.state in ('active', 'paused')
  ) then
    raise exception 'archive_book_lab_project: najpierw zakończ ścieżkę'
      using errcode = '23514';
  end if;

  update public.book_lab_notes
  set archived_at = now()
  where project_id = p_project_id and archived_at is null;

  update public.paths
  set archived_at = now()
  where id = v_path_id and archived_at is null;

  update public.book_lab_projects
  set archived_at = now(), status = 'archived'
  where id = p_project_id;
end;
$$;

-- Wewnętrzne funkcje oraz RPC dla klienta ----------------------------------

revoke all on function public.book_lab_safe_budget_ratio() from public;
grant execute on function public.book_lab_safe_budget_ratio() to service_role;

revoke all on function public.book_lab_item_minutes(text, numeric) from public;
grant execute on function public.book_lab_item_minutes(text, numeric) to service_role;

revoke all on function public.book_lab_free_minutes(uuid) from public;
grant execute on function public.book_lab_free_minutes(uuid) to service_role;

revoke all on function public.validate_user_path_parent() from public;

revoke all on function public.save_book_lab_protocol(uuid, jsonb) from public;
grant execute on function public.save_book_lab_protocol(uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.archive_book_lab_project(uuid) from public;
grant execute on function public.archive_book_lab_project(uuid)
  to authenticated, service_role;
