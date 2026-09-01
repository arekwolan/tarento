begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b2400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'b2-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'b2-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2400000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'b2-delete@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.book_lab_projects (
  id, owner_id, request_key, source_title, source_author, desired_change,
  locale, prompt_version, status, generated_draft
) values (
  'b2500000-0000-4000-8000-000000000001',
  'b2400000-0000-4000-8000-000000000001',
  'b2510000-0000-4000-8000-000000000001',
  'Prywatna książka', 'Prywatny autor', 'Zaczynać od małego kroku',
  'pl', 'book-lab-v1', 'generated', '{}'::jsonb
);

insert into public.book_lab_notes (
  id, project_id, owner_id, ordinal, content, source_locator
) values
  (
    'b2600000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000001',
    'b2400000-0000-4000-8000-000000000001',
    1, 'Zaczynam od jednego widocznego kroku.', 'Rozdział testowy, s. 7'
  ),
  (
    'b2600000-0000-4000-8000-000000000002',
    'b2500000-0000-4000-8000-000000000001',
    'b2400000-0000-4000-8000-000000000001',
    2, 'Potrzebny przedmiot zostawiam na biurku.', null
  ),
  (
    'b2600000-0000-4000-8000-000000000003',
    'b2500000-0000-4000-8000-000000000001',
    'b2400000-0000-4000-8000-000000000001',
    3, 'Na trudny dzień wystarczy jedna minuta.', null
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.book_lab_projects),
  1,
  'właściciel widzi swój prywatny projekt'
);

select is(
  (select count(*)::integer from public.book_lab_notes),
  3,
  'właściciel widzi własne notatki'
);

select lives_ok(
  $$
    select public.save_book_lab_protocol(
      'b2500000-0000-4000-8000-000000000001',
      '{
        "title":"Mój mały protokół",
        "summary":"Jedna praktyka zastępuje poprzednią.",
        "stages":[
          {
            "ordinal":1,
            "name":"Widoczny start",
            "description":"Zacznij od jednego widocznego kroku.",
            "dailyMinutes":5,
            "practice":{
              "title":"Pierwsza minuta",
              "why":"Zmniejsza próg wejścia.",
              "how":"Wykonaj przygotowany mały krok.",
              "whenHard":"Wykonaj jedną minutę.",
              "scheduleType":"daily",
              "scheduleDays":[],
              "timeOfDay":"morning",
              "category":"focus",
              "noteOrdinals":[1,3]
            },
            "environmentSetup":{
              "text":"Połóż potrzebny przedmiot na biurku.",
              "noteOrdinals":[2]
            },
            "transition":{
              "criterion":"Przejdź dalej po tygodniu prób.",
              "minDays":7,
              "maxDays":14,
              "completionThreshold":0.6,
              "noteOrdinals":[1]
            }
          },
          {
            "ordinal":2,
            "name":"Spokojne powtórzenie",
            "description":"Powtarzaj krok bez dokładania obowiązków.",
            "dailyMinutes":7,
            "practice":{
              "title":"Jedno powtórzenie",
              "why":"Utrwala prosty rytm.",
              "how":"Powtórz mały krok raz.",
              "whenHard":"Wykonaj jedną minutę.",
              "scheduleType":"weekdays",
              "scheduleDays":[],
              "timeOfDay":"morning",
              "category":"focus",
              "noteOrdinals":[1,3]
            },
            "environmentSetup":null,
            "transition":{
              "criterion":"Zakończ po dwóch tygodniach prób.",
              "minDays":7,
              "maxDays":14,
              "completionThreshold":0.6,
              "noteOrdinals":[3]
            }
          }
        ]
      }'::jsonb
    )
  $$,
  'zatwierdzenie tworzy prywatny protokół w istniejącym silniku paths'
);

select is(
  public.save_book_lab_protocol(
    'b2500000-0000-4000-8000-000000000001',
    '{"ignored":"przy powtórzeniu"}'::jsonb
  ),
  (select path_id from public.book_lab_projects where id = 'b2500000-0000-4000-8000-000000000001'),
  'powtórzone zatwierdzenie jest idempotentne'
);

select ok(
  (
    select owner_id = (select auth.uid())
      and origin_kind = 'private'
      and not is_published
      and path_kind = 'book_protocol'
      and source_title = 'Prywatna książka'
      and source_author = 'Prywatny autor'
      and review_status = 'draft'
    from public.paths
    where id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
  ),
  'prywatna ścieżka zachowuje provenance i nie trafia do katalogu'
);

select is(
  (
    select count(*)::integer
    from public.path_stages
    where path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
  ),
  2,
  'draft materializuje maksymalnie trzy istniejące etapy'
);

select is(
  (
    select count(*)::integer
    from public.path_practices practice
    join public.path_stages stage on stage.id = practice.stage_id
    where stage.path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
  ),
  2,
  'każdy etap tworzy dokładnie jedną praktykę powtarzalną'
);

select is(
  (
    select count(*)::integer
    from public.path_practices practice
    join public.path_stages stage on stage.id = practice.stage_id
    where stage.path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
      and practice.retires_practice_id is not null
  ),
  1,
  'drugi etap zastępuje poprzednią praktykę'
);

select ok(
  (
    select environment_setup_note_ordinals = array[2]::smallint[]
      and transition_note_ordinals = array[1]::smallint[]
    from public.path_stages
    where path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
    order by ordinal
    limit 1
  ),
  'przygotowanie i kryterium zachowują odnośniki do notatek'
);

select ok(
  (
    select source_note_ordinals = array[1,3]::smallint[]
    from public.path_practices practice
    join public.path_stages stage on stage.id = practice.stage_id
    where stage.path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
    order by stage.ordinal
    limit 1
  ),
  'praktyka zachowuje provenance do prywatnych notatek'
);

select is(
  (
    select count(*)::integer
    from public.path_readings reading
    join public.path_stages stage on stage.id = reading.stage_id
    where stage.path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
      and reading.source_kind = 'pointer'
      and reading.source_locator is not null
      and reading.body is null
      and reading.quote_text is null
  ),
  2,
  'pointery zachowują wskazanie bez tekstu książki i cytatu'
);

reset role;

insert into public.book_lab_projects (
  id, owner_id, request_key, source_title, source_author, desired_change,
  locale, prompt_version, status, generated_draft
) values (
  'b2500000-0000-4000-8000-000000000002',
  'b2400000-0000-4000-8000-000000000001',
  'b2510000-0000-4000-8000-000000000002',
  'Prywatna książka', 'Prywatny autor', 'Zaczynać od małego kroku',
  'pl', 'book-lab-v1', 'generated', '{}'::jsonb
);

insert into public.book_lab_notes (project_id, owner_id, ordinal, content)
select
  'b2500000-0000-4000-8000-000000000002',
  'b2400000-0000-4000-8000-000000000001',
  ordinal,
  'Własna idea ' || ordinal
from generate_series(1, 3) ordinal;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $$
    select public.save_book_lab_protocol(
      'b2500000-0000-4000-8000-000000000002',
      '{
        "title":"Za ciężki protokół",
        "summary":"Nie powinien zostać zapisany.",
        "stages":[{
          "ordinal":1,"name":"Za dużo","description":"Przekracza limit.",
          "dailyMinutes":19,
          "practice":{
            "title":"Za długa praktyka","why":"Test budżetu.","how":"Test.",
            "whenHard":"Test.","scheduleType":"daily","scheduleDays":[],
            "timeOfDay":"evening","category":"focus","noteOrdinals":[1]
          },
          "environmentSetup":null,
          "transition":{
            "criterion":"Po tygodniu.","minDays":7,"maxDays":14,
            "completionThreshold":0.6,"noteOrdinals":[2]
          }
        }]
      }'::jsonb
    )
  $$,
  '23514',
  'save_book_lab_protocol: draft narusza schemat lub budżet',
  'baza odrzuca protokół ponad 60% wolnego budżetu'
);

-- W5 wymaga gotowego review przed aktywacją prywatnego protokołu. Fixture nie
-- ma konfliktów, więc review jest ready bez wierszy protocol_conflicts.
reset role;

insert into public.protocol_conflict_reviews (
  id, owner_id, path_id, request_key, input_fingerprint, state_fingerprint,
  status, semantic_status, algorithm_version
) values (
  'b2700000-0000-4000-8000-000000000001',
  'b2400000-0000-4000-8000-000000000001',
  (select path_id from public.book_lab_projects
   where id = 'b2500000-0000-4000-8000-000000000001'),
  'b2710000-0000-4000-8000-000000000001',
  md5('book-lab-clear-review-1'),
  public.protocol_conflict_state_fingerprint(
    'b2400000-0000-4000-8000-000000000001',
    (select path_id from public.book_lab_projects
     where id = 'b2500000-0000-4000-8000-000000000001')
  ),
  'ready', 'not_needed', 'structural-v1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    select public.enroll_in_path_reviewed(
      'b2800000-0000-4000-8000-000000000001',
      (select path_id from public.book_lab_projects where id = 'b2500000-0000-4000-8000-000000000001'),
      'b2700000-0000-4000-8000-000000000001',
      false,
      current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'prywatny protokół używa wspólnego lifecycle aktywacji'
);

select ok(
  (
    select source_book = 'Prywatna książka'
      and source_author = 'Prywatny autor'
      and source_path_id is not null
    from public.habits
    where user_id = (select auth.uid()) and source_path_id is not null
    order by created_at desc
    limit 1
  ),
  'nawyk zachowuje książkę, autora i origin path'
);

select throws_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001',
      false,
      current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "user_paths_one_active_idx"',
  'prywatny protokół nie omija reguły jednej aktywnej ścieżki'
);

reset role;

insert into public.book_lab_projects (
  id, owner_id, request_key, base_path_id, source_title, source_author,
  desired_change, locale, prompt_version, status, generated_draft
) values (
  'b2500000-0000-4000-8000-000000000003',
  'b2400000-0000-4000-8000-000000000001',
  'b2510000-0000-4000-8000-000000000003',
  (select path_id from public.book_lab_projects where id = 'b2500000-0000-4000-8000-000000000001'),
  'Prywatna książka', 'Prywatny autor', 'Zaczynać od małego kroku',
  'pl', 'book-lab-v1', 'generated', '{}'::jsonb
);

insert into public.book_lab_notes (project_id, owner_id, ordinal, content)
select
  'b2500000-0000-4000-8000-000000000003',
  'b2400000-0000-4000-8000-000000000001',
  ordinal,
  'Własna idea wersji ' || ordinal
from generate_series(1, 3) ordinal;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    select public.save_book_lab_protocol(
      'b2500000-0000-4000-8000-000000000003',
      '{
        "title":"Mój mały protokół — wersja 2",
        "summary":"Nowa wersja bez zmiany historii.",
        "stages":[{
          "ordinal":1,"name":"Nowy start","description":"Nowy mały krok.",
          "dailyMinutes":5,
          "practice":{
            "title":"Nowa minuta","why":"Nowa notatka.","how":"Wykonaj krok.",
            "whenHard":"Jedna minuta.","scheduleType":"custom","scheduleDays":[1,3,5],
            "timeOfDay":"evening","category":"focus","noteOrdinals":[1]
          },
          "environmentSetup":null,
          "transition":{
            "criterion":"Po tygodniu.","minDays":7,"maxDays":14,
            "completionThreshold":0.6,"noteOrdinals":[2]
          }
        }]
      }'::jsonb
    )
  $$,
  'edycja zapisuje nową wersję prywatnej ścieżki'
);

select ok(
  (
    select next.version = previous.version + 1
      and next.version_parent_id = previous.id
    from public.paths next
    join public.paths previous on previous.id = next.version_parent_id
    where next.id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000003'
    )
  ),
  'nowa wersja wskazuje stabilną wersję poprzednią'
);

select is(
  (
    select up.path_id
    from public.user_paths up
    where up.user_id = (select auth.uid()) and up.state = 'active'
  ),
  (
    select path_id from public.book_lab_projects
    where id = 'b2500000-0000-4000-8000-000000000001'
  ),
  'aktywny user_path pozostaje przypięty do użytej wersji'
);

select lives_ok(
  $$ select public.archive_book_lab_project('b2500000-0000-4000-8000-000000000003') $$,
  'nieaktywną wersję można usunąć miękko'
);

select ok(
  (
    select project.archived_at is not null
      and project.status = 'archived'
      and path.archived_at is not null
      and not exists (
        select 1 from public.book_lab_notes note
        where note.project_id = project.id and note.archived_at is null
      )
    from public.book_lab_projects project
    join public.paths path on path.id = project.path_id
    where project.id = 'b2500000-0000-4000-8000-000000000003'
  ),
  'soft delete obejmuje projekt, notatki i prywatną ścieżkę'
);

select throws_ok(
  $$ select public.archive_book_lab_project('b2500000-0000-4000-8000-000000000001') $$,
  '23514',
  'archive_book_lab_project: najpierw zakończ ścieżkę',
  'aktywnego protokołu nie można usunąć spod historii'
);

select lives_ok(
  $$
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'abandoned',
      false
    )
  $$,
  'protokół można zakończyć wspólnym lifecycle przed ponownym sprawdzeniem fit'
);

insert into public.habits (
  user_id, title, unit, start_value, progression_mode, schedule_type
) values (
  (select auth.uid()), 'Wypełnienie budżetu', 'minutes', 27, 'completion', 'daily'
);

reset role;

insert into public.protocol_conflict_reviews (
  id, owner_id, path_id, request_key, input_fingerprint, state_fingerprint,
  status, semantic_status, algorithm_version
) values (
  'b2700000-0000-4000-8000-000000000002',
  'b2400000-0000-4000-8000-000000000001',
  (select path_id from public.book_lab_projects
   where id = 'b2500000-0000-4000-8000-000000000001'),
  'b2710000-0000-4000-8000-000000000002',
  md5('book-lab-clear-review-2'),
  public.protocol_conflict_state_fingerprint(
    'b2400000-0000-4000-8000-000000000001',
    (select path_id from public.book_lab_projects
     where id = 'b2500000-0000-4000-8000-000000000001')
  ),
  'ready', 'not_needed', 'structural-v1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $$
    select public.enroll_in_path_reviewed(
      'b2800000-0000-4000-8000-000000000002',
      (select path_id from public.book_lab_projects where id = 'b2500000-0000-4000-8000-000000000001'),
      'b2700000-0000-4000-8000-000000000002',
      false,
      current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  '23514',
  'user_path_parent: prywatny protokół nie mieści się w aktualnym budżecie',
  'aktywacja ponownie sprawdza path-fit po zmianie budżetu'
);

select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer from public.book_lab_projects
  ) + (
    select count(*)::integer from public.book_lab_notes
  ) + (
    select count(*)::integer from public.paths
    where owner_id = 'b2400000-0000-4000-8000-000000000001'
  ) + (
    select count(*)::integer from public.path_stages
    where path_id = (
      select path_id from public.book_lab_projects
      where id = 'b2500000-0000-4000-8000-000000000001'
    )
  ),
  0,
  'RLS izoluje projekt, notatki, prywatną ścieżkę i child tables'
);

select throws_ok(
  $$
    select public.save_book_lab_protocol(
      'b2500000-0000-4000-8000-000000000002',
      '{}'::jsonb
    )
  $$,
  'P0002',
  'save_book_lab_protocol: brak draftu',
  'drugi użytkownik nie może zatwierdzić cudzego projektu'
);

reset role;

insert into public.book_lab_projects (
  id, owner_id, request_key, source_title, source_author, desired_change,
  locale, prompt_version, status, generated_draft
) values (
  'b2500000-0000-4000-8000-000000000004',
  'b2400000-0000-4000-8000-000000000003',
  'b2510000-0000-4000-8000-000000000004',
  'Tytuł do usunięcia', 'Autor do usunięcia', 'Mała zmiana',
  'pl', 'book-lab-v1', 'generated', '{}'::jsonb
);

insert into public.book_lab_notes (project_id, owner_id, ordinal, content)
select
  'b2500000-0000-4000-8000-000000000004',
  'b2400000-0000-4000-8000-000000000003',
  ordinal,
  'Notatka do usunięcia ' || ordinal
from generate_series(1, 3) ordinal;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b2400000-0000-4000-8000-000000000003',
  true
);

select lives_ok(
  $$
    select public.save_book_lab_protocol(
      'b2500000-0000-4000-8000-000000000004',
      '{
        "title":"Protokół do usunięcia",
        "summary":"Fixture usunięcia konta.",
        "stages":[{
          "ordinal":1,"name":"Start","description":"Jeden krok.",
          "dailyMinutes":3,
          "practice":{
            "title":"Krok","why":"Test.","how":"Wykonaj krok.",
            "whenHard":"Jedna minuta.","scheduleType":"daily","scheduleDays":[],
            "timeOfDay":"evening","category":"focus","noteOrdinals":[1]
          },
          "environmentSetup":null,
          "transition":{
            "criterion":"Po tygodniu.","minDays":7,"maxDays":14,
            "completionThreshold":0.6,"noteOrdinals":[2]
          }
        }]
      }'::jsonb
    )
  $$,
  'konto przeznaczone do usunięcia ma zapisany prywatny protokół'
);

select lives_ok(
  $$ select public.delete_user_account() $$,
  'usunięcie konta obejmuje dane Laboratorium'
);

reset role;

select is(
  (
    select count(*)::integer from public.book_lab_projects
    where owner_id = 'b2400000-0000-4000-8000-000000000003'
  ) + (
    select count(*)::integer from public.book_lab_notes
    where owner_id = 'b2400000-0000-4000-8000-000000000003'
  ) + (
    select count(*)::integer from public.paths
    where owner_id = 'b2400000-0000-4000-8000-000000000003'
  ),
  0,
  'cascade fizycznie usuwa prywatny projekt, notatki i ścieżkę wraz z kontem'
);

select is(
  (
    select count(*)::integer
    from public.paths
    where owner_id is not null and is_published
  ),
  0,
  'żaden prywatny protokół nie spełnia filtra publicznego katalogu'
);

select * from finish();
rollback;
