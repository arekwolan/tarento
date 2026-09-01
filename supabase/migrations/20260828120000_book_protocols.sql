-- B1: kuratorowane Protokoły książkowe na istniejącym silniku ścieżek.
--
-- Protokół nie dostaje osobnego trackera. Nadal jest wierszem w paths,
-- przechodzi przez user_paths i materializuje zwykłe habits. Ta migracja
-- dodaje wyłącznie provenance, bezpieczny model wskazań bibliograficznych
-- i ograniczenia redakcyjne właściwe dla protokołów książkowych.

-- Provenance ścieżki ---------------------------------------------------------

alter table public.paths
  add column path_kind text not null default 'tarento'
    check (path_kind in ('tarento', 'book_protocol')),
  add column source_type text
    check (source_type in ('book')),
  add column source_title text,
  add column source_author text,
  add column source_edition text,
  add column source_identifier text,
  add column curated_by text,
  add column review_status text not null default 'not_applicable'
    check (review_status in (
      'not_applicable', 'draft', 'editorial_reviewed', 'legal_reviewed'
    )),
  add column disclaimer text,
  add constraint paths_book_protocol_provenance_check check (
    (
      path_kind = 'tarento'
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
      and curated_by = 'Tarento'
      and review_status <> 'not_applicable'
      and nullif(btrim(disclaimer), '') is not null
    )
  ),
  add constraint paths_book_protocol_publish_review_check check (
    path_kind <> 'book_protocol'
    or not is_published
    or review_status in ('editorial_reviewed', 'legal_reviewed')
  ),
  add constraint paths_source_fields_length_check check (
    (source_title is null or char_length(source_title) <= 240)
    and (source_author is null or char_length(source_author) <= 160)
    and (source_edition is null or char_length(source_edition) <= 160)
    and (source_identifier is null or char_length(source_identifier) <= 160)
    and (disclaimer is null or char_length(disclaimer) <= 1200)
  );

comment on column public.paths.path_kind is
  'tarento = autorska ścieżka Tarento; book_protocol = ręcznie opracowany,
   kuratorowany protokół oparty na wskazanej książce. Oba używają tego samego
   user_paths i tej samej reguły jednej aktywnej ścieżki.';
comment on column public.paths.source_type is
  'Jawny typ źródła protokołu. B1 dopuszcza wyłącznie book.';
comment on column public.paths.source_title is
  'Tytuł źródła, nie tytuł protokołu.';
comment on column public.paths.source_author is
  'Autor źródła. Kopiowany do habits.source_author przy materializacji.';
comment on column public.paths.source_edition is
  'Opcjonalne wydanie źródła; informacja bibliograficzna, nie treść.';
comment on column public.paths.source_identifier is
  'Opcjonalny ISBN lub wewnętrzny identyfikator wydania.';
comment on column public.paths.curated_by is
  'Jawna informacja o opracowaniu. W B1 protokół może być opracowany tylko
   przez Tarento.';
comment on column public.paths.review_status is
  'Status kontroli redakcyjnej/prawnej. Draft nie może zostać opublikowany.';
comment on column public.paths.disclaimer is
  'Widoczna informacja o zakresie opracowania i relacji do źródła.';

create index paths_published_kind_language_sort_idx
  on public.paths (path_kind, language, sort_order)
  where is_published;

create index paths_source_identifier_idx
  on public.paths (source_type, source_identifier)
  where source_identifier is not null;

-- Bezpieczne wskazania i cytaty ---------------------------------------------

alter table public.path_readings
  add column source_locator text,
  add column quote_text text,
  add column quote_source text,
  add constraint path_readings_pointer_has_locator check (
    source_kind <> 'pointer'
    or nullif(btrim(source_locator), '') is not null
  ),
  add constraint path_readings_locator_length_check check (
    source_locator is null or char_length(source_locator) <= 300
  ),
  add constraint path_readings_short_original_framing_check check (
    nullif(btrim(framing), '') is not null
    and char_length(framing) <= 1200
  ),
  add constraint path_readings_quote_pair_check check (
    (quote_text is null and quote_source is null)
    or (
      nullif(btrim(quote_text), '') is not null
      and char_length(quote_text) <= 240
      and nullif(btrim(quote_source), '') is not null
      and char_length(quote_source) <= 300
    )
  );

comment on column public.path_readings.source_locator is
  'Rozdział, sekcja albo strony. Wskazuje miejsce w źródle, ale nie przechowuje
   jego tekstu; dla source_kind=pointer jest obowiązkowe.';
comment on column public.path_readings.quote_text is
  'Opcjonalny, jawnie oddzielony cytat. Konserwatywny limit 240 znaków jest
   egzekwowany w bazie; protokół demonstracyjny nie używa cytatów.';
comment on column public.path_readings.quote_source is
  'Dokładne źródło opcjonalnego cytatu. Występuje zawsze razem z quote_text.';

create index path_readings_pointer_stage_week_idx
  on public.path_readings (stage_id, week)
  where source_kind = 'pointer';

-- Ograniczenia struktury protokołu ------------------------------------------

create or replace function public.enforce_book_protocol_stage_shape()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path_kind text;
  v_other_stages integer;
begin
  select p.path_kind into v_path_kind
  from public.paths p
  where p.id = new.path_id;

  if v_path_kind <> 'book_protocol' then
    return new;
  end if;

  if new.ordinal not between 1 and 3 then
    raise exception 'book_protocol_stage_limit: protokół ma najwyżej 3 etapy'
      using errcode = '23514';
  end if;

  select count(*) into v_other_stages
  from public.path_stages s
  where s.path_id = new.path_id
    and s.id <> new.id;

  if v_other_stages >= 3 then
    raise exception 'book_protocol_stage_limit: protokół ma najwyżej 3 etapy'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger path_stages_enforce_book_protocol_shape
  before insert or update on public.path_stages
  for each row execute function public.enforce_book_protocol_stage_shape();

create or replace function public.enforce_book_protocol_practice_shape()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path_id uuid;
  v_path_kind text;
  v_stage_ordinal smallint;
  v_other_practices integer;
  v_replaced_previous boolean;
begin
  select s.path_id, p.path_kind, s.ordinal
  into v_path_id, v_path_kind, v_stage_ordinal
  from public.path_stages s
  join public.paths p on p.id = s.path_id
  where s.id = new.stage_id;

  if v_path_kind <> 'book_protocol' then
    return new;
  end if;

  select count(*) into v_other_practices
  from public.path_practices pp
  where pp.stage_id = new.stage_id
    and pp.id <> new.id;

  if v_other_practices >= 1 then
    raise exception 'book_protocol_practice_limit: etap wprowadza najwyżej jedną praktykę'
      using errcode = '23514';
  end if;

  if v_stage_ordinal = 1 and new.retires_practice_id is not null then
    raise exception 'book_protocol_replacement: pierwszy etap niczego nie zastępuje'
      using errcode = '23514';
  end if;

  if v_stage_ordinal > 1 then
    if new.retires_practice_id is null then
      raise exception 'book_protocol_replacement: kolejny etap zastępuje poprzednią praktykę'
        using errcode = '23514';
    end if;

    select exists (
      select 1
      from public.path_practices previous
      join public.path_stages previous_stage on previous_stage.id = previous.stage_id
      where previous.id = new.retires_practice_id
        and previous_stage.path_id = v_path_id
        and previous_stage.ordinal = v_stage_ordinal - 1
    ) into v_replaced_previous;

    if not v_replaced_previous then
      raise exception 'book_protocol_replacement: praktyka musi zastąpić praktykę poprzedniego etapu'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger path_practices_enforce_book_protocol_shape
  before insert or update on public.path_practices
  for each row execute function public.enforce_book_protocol_practice_shape();

create or replace function public.enforce_book_protocol_reading_shape()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path_kind text;
begin
  select p.path_kind into v_path_kind
  from public.path_stages s
  join public.paths p on p.id = s.path_id
  where s.id = new.stage_id;

  if v_path_kind = 'book_protocol'
     and (
       new.source_kind <> 'pointer'
       or new.body is not null
       or nullif(btrim(new.source_locator), '') is null
     ) then
    raise exception 'book_protocol_reading: lektura protokołu jest wyłącznie wskazaniem bez tekstu książki'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger path_readings_enforce_book_protocol_shape
  before insert or update on public.path_readings
  for each row execute function public.enforce_book_protocol_reading_shape();

create or replace function public.validate_book_protocol_before_publish()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stage_count integer;
  v_min_ordinal integer;
  v_max_ordinal integer;
begin
  if new.path_kind <> 'book_protocol' or not new.is_published then
    return new;
  end if;

  select count(*), min(s.ordinal), max(s.ordinal)
  into v_stage_count, v_min_ordinal, v_max_ordinal
  from public.path_stages s
  where s.path_id = new.id;

  if v_stage_count not between 1 and 3
     or v_min_ordinal <> 1
     or v_max_ordinal <> v_stage_count then
    raise exception 'book_protocol_publish: etapy muszą tworzyć ciąg 1..3'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.path_stages s
    join public.path_practices pp on pp.stage_id = s.id
    where s.path_id = new.id
    group by s.id
    having count(*) > 1
  ) then
    raise exception 'book_protocol_publish: etap ma więcej niż jedną praktykę'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.path_readings pr
    join public.path_stages s on s.id = pr.stage_id
    where s.path_id = new.id
      and (
        pr.source_kind <> 'pointer'
        or pr.body is not null
        or nullif(btrim(pr.source_locator), '') is null
      )
  ) then
    raise exception 'book_protocol_publish: lektury muszą być bezpiecznymi wskazaniami'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger paths_validate_book_protocol_before_publish
  before insert or update on public.paths
  for each row execute function public.validate_book_protocol_before_publish();

-- RLS: katalog i most użytkownika -------------------------------------------
--
-- Tabele katalogowe nadal są tylko do odczytu, a child tables dziedziczą
-- widoczność wyłącznie przez opublikowanego rodzica. Polityki zapisujemy
-- ponownie jawnie w migracji rozszerzającej model, żeby nowe pola nie stały
-- się pretekstem do odczytu draftów.

alter table public.path_stages enable row level security;
alter table public.path_practices enable row level security;
alter table public.path_readings enable row level security;
alter table public.user_path_practices enable row level security;

drop policy if exists "path_stages_select_published" on public.path_stages;
create policy "path_stages_select_published"
  on public.path_stages for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.paths p
      where p.id = path_stages.path_id
        and p.is_published
    )
  );

drop policy if exists "path_practices_select_published" on public.path_practices;
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

drop policy if exists "path_readings_select_published" on public.path_readings;
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

-- Most nie ufa samemu user_id przesłanemu przez klienta. Wskazany zapis,
-- nawyk i definicja praktyki muszą tworzyć jeden łańcuch należący do wołającego.
drop policy if exists "user_path_practices_insert_own" on public.user_path_practices;
create policy "user_path_practices_insert_own"
  on public.user_path_practices for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_paths up
      join public.path_practices pp
        on pp.id = user_path_practices.practice_id
      join public.path_stages ps on ps.id = pp.stage_id
      join public.habits h on h.id = user_path_practices.habit_id
      where up.id = user_path_practices.user_path_id
        and up.user_id = (select auth.uid())
        and ps.path_id = up.path_id
        and h.user_id = (select auth.uid())
        and h.source_path_id = up.path_id
    )
  );

drop policy if exists "user_path_practices_update_own" on public.user_path_practices;
create policy "user_path_practices_update_own"
  on public.user_path_practices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_paths up
      join public.path_practices pp
        on pp.id = user_path_practices.practice_id
      join public.path_stages ps on ps.id = pp.stage_id
      join public.habits h on h.id = user_path_practices.habit_id
      where up.id = user_path_practices.user_path_id
        and up.user_id = (select auth.uid())
        and ps.path_id = up.path_id
        and h.user_id = (select auth.uid())
        and h.source_path_id = up.path_id
    )
  );

-- Materializacja zachowuje provenance książki -------------------------------

create or replace function public.materialize_path_practice(
  p_user_path_id uuid,
  p_practice_id uuid,
  p_lite boolean,
  p_today date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_practice public.path_practices%rowtype;
  v_path public.paths%rowtype;
  v_reentry boolean;
  v_params record;
  v_adjust jsonb;
  v_start numeric;
  v_time_of_day text;
  v_habit_id uuid;
begin
  select * into v_practice
  from public.path_practices
  where id = p_practice_id;

  if not found then
    raise exception 'materialize_path_practice: brak praktyki %', p_practice_id
      using errcode = 'P0002';
  end if;

  select p.* into v_path
  from public.path_stages s
  join public.paths p on p.id = s.path_id
  where s.id = v_practice.stage_id;

  select coalesce(up.reentry_until >= p_today, false)
  into v_reentry
  from public.user_paths up
  where up.id = p_user_path_id;

  select * into v_params
  from public.path_practice_params(p_practice_id, p_lite, coalesce(v_reentry, false));

  select elem into v_adjust
  from public.user_paths up
  cross join lateral jsonb_array_elements(
    coalesce(up.fit -> 'adjust', '[]'::jsonb)
  ) as elem
  where up.id = p_user_path_id
    and elem ->> 'practiceId' = p_practice_id::text
  limit 1;

  v_start := v_params.start_value;

  if v_adjust is not null and (v_adjust ->> 'startValue') is not null then
    v_start := least(v_start, greatest((v_adjust ->> 'startValue')::numeric, 1));
  end if;

  v_time_of_day := v_practice.time_of_day;

  if v_adjust is not null
     and (v_adjust ->> 'timeOfDay') in ('morning', 'afternoon', 'evening') then
    v_time_of_day := v_adjust ->> 'timeOfDay';
  end if;

  insert into public.habits (
    user_id,
    title,
    description,
    unit,
    category,
    start_value,
    increment_value,
    target_value,
    progression_mode,
    schedule_type,
    schedule_days,
    time_of_day,
    source_book,
    source_author,
    sort_order,
    started_on,
    source_path_id,
    source_stage_id
  ) values (
    v_user_id,
    v_practice.title,
    v_practice.how,
    v_practice.unit,
    v_practice.category,
    v_start,
    v_params.increment_value,
    v_practice.target_value,
    v_practice.progression_mode,
    v_practice.schedule_type,
    v_practice.schedule_days,
    v_time_of_day,
    case when v_path.path_kind = 'book_protocol' then v_path.source_title end,
    case when v_path.path_kind = 'book_protocol' then v_path.source_author end,
    v_practice.sort_order,
    p_today,
    v_path.id,
    v_practice.stage_id
  )
  returning id into v_habit_id;

  insert into public.user_path_practices (
    user_path_id, practice_id, habit_id, user_id, activated_on
  )
  values (p_user_path_id, p_practice_id, v_habit_id, v_user_id, p_today);

  return v_habit_id;
end;
$$;

comment on function public.materialize_path_practice(uuid, uuid, boolean, date) is
  'Praktyka ścieżki → zwykły habit i most. Dla protokołu książkowego kopiuje
   source_title/source_author oraz zachowuje source_path_id jako origin.';

-- Po zakończeniu protokołu zachowana praktyka nadal pamięta źródło i origin.
-- Zwykłe ścieżki zachowują dotychczasowe zachowanie: praktyka staje się
-- ręcznym nawykiem bez widocznego pochodzenia ścieżkowego.
create or replace function public.end_path(
  p_user_path_id uuid,
  p_reason text,
  p_keep_practices boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.user_paths
  set state = 'ended',
      ended_at = now(),
      ended_reason = p_reason,
      paused_at = null,
      reentry_until = null
  where id = p_user_path_id
    and state <> 'ended';

  if not found then
    return;
  end if;

  if p_keep_practices then
    update public.habits h
    set source_path_id = case
          when p.path_kind = 'book_protocol' then h.source_path_id
          else null
        end,
        source_stage_id = case
          when p.path_kind = 'book_protocol' then h.source_stage_id
          else null
        end,
        retired_at = null
    from public.user_path_practices upp
    join public.user_paths up on up.id = upp.user_path_id
    join public.paths p on p.id = up.path_id
    where upp.habit_id = h.id
      and upp.user_path_id = p_user_path_id
      and upp.retired_on is null;
  else
    update public.habits h
    set archived_at = now()
    from public.user_path_practices upp
    where upp.habit_id = h.id
      and upp.user_path_id = p_user_path_id
      and upp.retired_on is null
      and h.archived_at is null;
  end if;
end;
$$;

-- Neutralny, w pełni autorski protokół demonstracyjny -----------------------
--
-- Źródło i treść są stworzone dla Tarento. Nie ma cytatów ani fragmentów
-- chronionej książki; lektury są wyłącznie pointerami do fikcyjnego wydania
-- testowego. Wiersze powstają jako draft i są publikowane dopiero po dodaniu
-- kompletnej struktury, aby bramka publikacji mogła ją sprawdzić.

insert into public.paths (
  id, slug, version, title, hook, honesty, completion_note,
  duration_days, language, is_published, sort_order,
  path_kind, source_type, source_title, source_author, source_edition,
  source_identifier, curated_by, review_status, disclaimer
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'one-idea-in-action', 1,
    'Jedna idea w działaniu',
    'Autorski protokół testowy: trzy etapy, w każdym jedna mała praktyka.',
    'Materiał źródłowy i opracowanie powstały w Tarento na potrzeby bezpiecznego pilotażu. Protokół nie odtwarza żadnej komercyjnej książki.',
    'Zostaje jedna krótka praktyka, którą możesz dalej prowadzić albo spokojnie zdjąć z listy.',
    21, 'pl', false, 2,
    'book_protocol', 'book', 'Małe kroki, spokojny dzień',
    'Redakcja Tarento', 'Wydanie testowe 1', 'TARENTO-B1-DEMO-001',
    'Tarento', 'editorial_reviewed',
    'Autorski materiał demonstracyjny Tarento. Wskazania nie zastępują lektury źródła ani profesjonalnej porady.'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'one-idea-in-action', 1,
    'One idea in action',
    'An original test protocol: three stages, one small practice in each.',
    'The source material and this adaptation were created by Tarento for a safe pilot. The protocol does not reproduce any commercial book.',
    'One short practice remains. You can keep it going or calmly take it off your list.',
    21, 'en', false, 2,
    'book_protocol', 'book', 'Small Steps, Calm Day',
    'Tarento Editorial', 'Test edition 1', 'TARENTO-B1-DEMO-001',
    'Tarento', 'editorial_reviewed',
    'Original demonstration material by Tarento. References do not replace the source or professional advice.'
  );

insert into public.path_stages (
  id, path_id, ordinal, name, description,
  daily_minutes_p50, min_days, max_days, completion_threshold
)
values
  (
    'b1100000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    1, 'Zauważ',
    'Przez chwilę zauważasz, gdzie jedna idea może spotkać się z prawdziwym dniem.',
    2, 5, 7, 0.5
  ),
  (
    'b1100000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    2, 'Wybierz',
    'Obserwację zastępuje jeden najmniejszy krok możliwy do wykonania od razu.',
    3, 5, 7, 0.5
  ),
  (
    'b1100000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    3, 'Sprawdź',
    'Wybór zastępuje krótka próba w warunkach zwykłego dnia.',
    5, 5, 7, 0.5
  ),
  (
    'b1100000-0000-4000-8000-000000000101',
    'b1000000-0000-4000-8000-000000000002',
    1, 'Notice',
    'For a moment, notice where one idea could meet an ordinary day.',
    2, 5, 7, 0.5
  ),
  (
    'b1100000-0000-4000-8000-000000000102',
    'b1000000-0000-4000-8000-000000000002',
    2, 'Choose',
    'The observation is replaced by one smallest step you can take at once.',
    3, 5, 7, 0.5
  ),
  (
    'b1100000-0000-4000-8000-000000000103',
    'b1000000-0000-4000-8000-000000000002',
    3, 'Test',
    'The choice is replaced by a short trial in an ordinary day.',
    5, 5, 7, 0.5
  );

insert into public.path_practices (
  id, stage_id, title, why, how, when_hard,
  unit, start_value, increment_value, target_value, progression_mode,
  schedule_type, schedule_days, time_of_day, category, is_optional,
  retires_practice_id, sort_order
)
values
  (
    'b1200000-0000-4000-8000-000000000001',
    'b1100000-0000-4000-8000-000000000001',
    'Jedno zdanie obserwacji',
    'Jedno zdanie wystarcza, żeby połączyć ideę z konkretnym momentem dnia.',
    'Wieczorem zapisz jedno zdanie: gdzie dziś ta idea mogła się przydać?',
    'Nie masz odpowiedzi? Zapisz tylko nazwę sytuacji.',
    'minutes', 2, 0, null, 'completion', 'daily', null, 'evening',
    'learning', false, null, 0
  ),
  (
    'b1200000-0000-4000-8000-000000000002',
    'b1100000-0000-4000-8000-000000000002',
    'Jeden najmniejszy krok',
    'Mały wybór jest łatwiejszy do sprawdzenia niż kolejna lista wskazówek.',
    'Wybierz jeden krok zajmujący do trzech minut i wykonaj go przed końcem dnia.',
    'Zrób pierwsze trzydzieści sekund tego samego kroku.',
    'minutes', 3, 0, null, 'completion', 'weekdays', null, 'afternoon',
    'learning', false, 'b1200000-0000-4000-8000-000000000001', 0
  ),
  (
    'b1200000-0000-4000-8000-000000000003',
    'b1100000-0000-4000-8000-000000000003',
    'Pięć minut próby',
    'Krótka próba pokazuje, czy pomysł pasuje do zwykłych warunków.',
    'Przez pięć minut zastosuj wybrany krok w jednej realnej sytuacji.',
    'Skróć próbę do jednej minuty, ale zachowaj tę samą sytuację.',
    'minutes', 5, 0, null, 'completion', 'daily', null, 'afternoon',
    'learning', false, 'b1200000-0000-4000-8000-000000000002', 0
  ),
  (
    'b1200000-0000-4000-8000-000000000101',
    'b1100000-0000-4000-8000-000000000101',
    'One sentence of observation',
    'One sentence is enough to connect an idea with a specific moment.',
    'In the evening, write one sentence: where could this idea have helped today?',
    'No answer? Write only the name of the situation.',
    'minutes', 2, 0, null, 'completion', 'daily', null, 'evening',
    'learning', false, null, 0
  ),
  (
    'b1200000-0000-4000-8000-000000000102',
    'b1100000-0000-4000-8000-000000000102',
    'One smallest step',
    'A small choice is easier to test than another list of advice.',
    'Choose one step that takes up to three minutes and do it before the day ends.',
    'Do the first thirty seconds of the same step.',
    'minutes', 3, 0, null, 'completion', 'weekdays', null, 'afternoon',
    'learning', false, 'b1200000-0000-4000-8000-000000000101', 0
  ),
  (
    'b1200000-0000-4000-8000-000000000103',
    'b1100000-0000-4000-8000-000000000103',
    'Five-minute trial',
    'A short trial shows whether the idea fits ordinary conditions.',
    'For five minutes, apply the chosen step in one real situation.',
    'Shorten the trial to one minute, keeping the same situation.',
    'minutes', 5, 0, null, 'completion', 'daily', null, 'afternoon',
    'learning', false, 'b1200000-0000-4000-8000-000000000102', 0
  );

insert into public.path_readings (
  id, stage_id, week, title, author, source_kind, attribution, body, framing,
  source_locator, quote_text, quote_source
)
values
  (
    'b1300000-0000-4000-8000-000000000001',
    'b1100000-0000-4000-8000-000000000001',
    1, 'Małe kroki, spokojny dzień', 'Redakcja Tarento', 'pointer',
    'Wydanie testowe 1 · TARENTO-B1-DEMO-001', null,
    'Zwróć uwagę na jedną sytuację, nie na liczbę przeczytanych stron. Materiał ma pomóc nazwać moment, w którym mała zmiana może wejść do dnia.',
    'Rozdział 1 · sekcja „Moment działania”', null, null
  ),
  (
    'b1300000-0000-4000-8000-000000000002',
    'b1100000-0000-4000-8000-000000000002',
    2, 'Małe kroki, spokojny dzień', 'Redakcja Tarento', 'pointer',
    'Wydanie testowe 1 · TARENTO-B1-DEMO-001', null,
    'Szukaj kroku, który da się wykonać bez przygotowywania nowego systemu. Jedna mała decyzja ma zastąpić wcześniejszą obserwację.',
    'Rozdział 2 · sekcja „Najmniejszy krok”', null, null
  ),
  (
    'b1300000-0000-4000-8000-000000000003',
    'b1100000-0000-4000-8000-000000000003',
    3, 'Małe kroki, spokojny dzień', 'Redakcja Tarento', 'pointer',
    'Wydanie testowe 1 · TARENTO-B1-DEMO-001', null,
    'Nie oceniaj całej idei. Sprawdź wyłącznie, czy pięć minut praktyki pasuje do jednej zwykłej sytuacji i zostawia po sobie użyteczny ślad.',
    'Rozdział 3 · sekcja „Próba w życiu”', null, null
  ),
  (
    'b1300000-0000-4000-8000-000000000101',
    'b1100000-0000-4000-8000-000000000101',
    1, 'Small Steps, Calm Day', 'Tarento Editorial', 'pointer',
    'Test edition 1 · TARENTO-B1-DEMO-001', null,
    'Notice one situation, not the number of pages read. The material should help name the moment where a small change can enter the day.',
    'Chapter 1 · “The moment of action” section', null, null
  ),
  (
    'b1300000-0000-4000-8000-000000000102',
    'b1100000-0000-4000-8000-000000000102',
    2, 'Small Steps, Calm Day', 'Tarento Editorial', 'pointer',
    'Test edition 1 · TARENTO-B1-DEMO-001', null,
    'Look for a step that needs no new system. One small decision should replace the earlier observation.',
    'Chapter 2 · “The smallest step” section', null, null
  ),
  (
    'b1300000-0000-4000-8000-000000000103',
    'b1100000-0000-4000-8000-000000000103',
    3, 'Small Steps, Calm Day', 'Tarento Editorial', 'pointer',
    'Test edition 1 · TARENTO-B1-DEMO-001', null,
    'Do not judge the whole idea. Check only whether five minutes of practice fits one ordinary situation and leaves a useful trace.',
    'Chapter 3 · “A trial in life” section', null, null
  );

update public.paths
set is_published = true
where id in (
  'b1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002'
);

-- Funkcje są ponownie zdefiniowane z tą samą sygnaturą, ale utrzymujemy
-- jawne granty po zmianie implementacji.
revoke all on function public.materialize_path_practice(uuid, uuid, boolean, date)
  from public;
grant execute on function public.materialize_path_practice(uuid, uuid, boolean, date)
  to authenticated, service_role;

revoke all on function public.end_path(uuid, text, boolean) from public;
grant execute on function public.end_path(uuid, text, boolean)
  to authenticated, service_role;

revoke all on function public.enforce_book_protocol_stage_shape() from public;
revoke all on function public.enforce_book_protocol_practice_shape() from public;
revoke all on function public.enforce_book_protocol_reading_shape() from public;
revoke all on function public.validate_book_protocol_before_publish() from public;
