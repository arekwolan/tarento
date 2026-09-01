begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

-- Nieopublikowany rodzic do sprawdzenia dziedziczonego RLS child tables.
insert into public.paths (
  id, slug, version, title, hook, duration_days, language, is_published
) values (
  'b9000000-0000-4000-8000-000000000001',
  'b1-unpublished-fixture', 1, 'Draft', 'Draft', 7, 'pl', false
);

insert into public.path_stages (
  id, path_id, ordinal, name, description,
  daily_minutes_p50, min_days, max_days, completion_threshold
) values (
  'b9100000-0000-4000-8000-000000000001',
  'b9000000-0000-4000-8000-000000000001',
  1, 'Draft', 'Draft', 1, 1, 2, 0.5
);

insert into public.path_practices (
  id, stage_id, title, why, how, unit
) values (
  'b9200000-0000-4000-8000-000000000001',
  'b9100000-0000-4000-8000-000000000001',
  'Draft', 'Draft', 'Draft', 'minutes'
);

insert into public.path_readings (
  id, stage_id, week, title, source_kind, framing, source_locator
) values (
  'b9300000-0000-4000-8000-000000000001',
  'b9100000-0000-4000-8000-000000000001',
  1, 'Draft', 'pointer', 'Draft', 'Rozdział testowy'
);

select is(
  (
    select path_kind from public.paths
    where slug = 'out-of-chaos' and language = 'pl'
  ),
  'tarento',
  'istniejące seedy dostają kompatybilny rodzaj tarento'
);

select is(
  (
    select count(*)::integer from public.paths
    where slug = 'one-idea-in-action'
      and language = 'pl'
      and path_kind = 'book_protocol'
      and is_published
  ),
  1,
  'katalog zawiera jeden ręcznie przygotowany protokół PL'
);

select ok(
  (
    select source_type = 'book'
      and source_title is not null
      and source_author is not null
      and curated_by = 'Tarento'
      and review_status = 'editorial_reviewed'
      and disclaimer is not null
    from public.paths
    where id = 'b1000000-0000-4000-8000-000000000001'
  ),
  'protokół ma komplet jawnego provenance'
);

select is(
  (
    select count(*)::integer from public.path_stages
    where path_id = 'b1000000-0000-4000-8000-000000000001'
  ),
  3,
  'protokół ma najwyżej trzy etapy'
);

select is(
  (
    select max(practice_count)::integer
    from (
      select count(pp.id) as practice_count
      from public.path_stages s
      left join public.path_practices pp on pp.stage_id = s.id
      where s.path_id = 'b1000000-0000-4000-8000-000000000001'
      group by s.id
    ) counts
  ),
  1,
  'każdy etap wprowadza najwyżej jedną praktykę'
);

select is(
  (
    select count(*)::integer
    from public.path_practices current_practice
    join public.path_stages current_stage on current_stage.id = current_practice.stage_id
    join public.path_practices previous
      on previous.id = current_practice.retires_practice_id
    join public.path_stages previous_stage on previous_stage.id = previous.stage_id
    where current_stage.path_id = 'b1000000-0000-4000-8000-000000000001'
      and previous_stage.ordinal = current_stage.ordinal - 1
  ),
  2,
  'etapy 2 i 3 zastępują praktykę bezpośrednio poprzedniego etapu'
);

select is(
  (
    select count(*)::integer
    from public.path_readings pr
    join public.path_stages s on s.id = pr.stage_id
    where s.path_id = 'b1000000-0000-4000-8000-000000000001'
      and pr.source_kind = 'pointer'
      and pr.source_locator is not null
  ),
  3,
  'każdy etap ma bezpieczne wskazanie bibliograficzne'
);

select is(
  (
    select count(*)::integer
    from public.path_readings pr
    join public.path_stages s on s.id = pr.stage_id
    where s.path_id = 'b1000000-0000-4000-8000-000000000001'
      and (pr.body is not null or pr.quote_text is not null)
  ),
  0,
  'fixture nie przechowuje tekstu książki ani cytatów'
);

select throws_ok(
  $$
    insert into public.path_stages (
      path_id, ordinal, name, description,
      daily_minutes_p50, min_days, max_days, completion_threshold
    ) values (
      'b1000000-0000-4000-8000-000000000001',
      4, 'Za dużo', 'Za dużo', 1, 1, 2, 0.5
    )
  $$,
  '23514',
  'book_protocol_stage_limit: protokół ma najwyżej 3 etapy',
  'baza odrzuca czwarty etap protokołu'
);

select throws_ok(
  $$
    insert into public.path_practices (
      stage_id, title, why, how, unit
    ) values (
      'b1100000-0000-4000-8000-000000000001',
      'Druga praktyka', 'Za dużo', 'Za dużo', 'minutes'
    )
  $$,
  '23514',
  'book_protocol_practice_limit: etap wprowadza najwyżej jedną praktykę',
  'baza odrzuca drugą praktykę powtarzalną etapu'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b1400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'b1-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-8000-000000000000',
    'b1400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'b1-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b1400000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    select count(*)::integer
    from public.path_stages
    where path_id = 'b9000000-0000-4000-8000-000000000001'
  ) + (
    select count(*)::integer
    from public.path_practices
    where stage_id = 'b9100000-0000-4000-8000-000000000001'
  ) + (
    select count(*)::integer
    from public.path_readings
    where stage_id = 'b9100000-0000-4000-8000-000000000001'
  ),
  0,
  'RLS child tables ukrywa dane nieopublikowanego rodzica'
);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001',
      false,
      current_date,
      '{}'::uuid[],
      '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'protokół używa istniejącego zapisu user_paths'
);

select is(
  (
    select concat_ws('|', source_book, source_author, (source_path_id is not null)::text)
    from public.habits
    where user_id = (select auth.uid())
      and source_path_id = 'b1000000-0000-4000-8000-000000000001'
  ),
  'Małe kroki, spokojny dzień|Redakcja Tarento|true',
  'materializowany nawyk zachowuje książkę, autora i origin path'
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
  'jedna aktywna ścieżka pozostaje twardą regułą'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'b1410000-0000-4000-8000-000000000001',
      'yes',
      'advance',
      null,
      current_date + 7
    )
  $$,
  'świadomy transfer używa istniejącego lifecycle przejścia etapu'
);

select is(
  (
    select s.ordinal
    from public.user_paths up
    join public.path_stages s on s.id = up.current_stage_id
    where up.state = 'active'
  ),
  2::smallint,
  'lifecycle przesuwa zapis na drugi etap'
);

select is(
  (
    select count(*)::integer
    from public.user_path_practices
    where retired_on is not null
  ),
  1,
  'przejście wycofuje dokładnie poprzednią praktykę'
);

select is(
  (
    select count(*)::integer
    from public.user_path_practices
    where retired_on is null
  ),
  1,
  'po przejściu aktywna pozostaje jedna praktyka protokołu'
);

select lives_ok(
  $$
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'completed',
      true
    )
  $$,
  'zakończenie może zachować ostatnią praktykę'
);

select ok(
  (
    select source_path_id is not null
      and source_stage_id is not null
      and source_book = 'Małe kroki, spokojny dzień'
      and source_author = 'Redakcja Tarento'
    from public.habits
    where user_id = (select auth.uid())
      and retired_at is null
      and archived_at is null
  ),
  'zachowana praktyka nadal ma pełne pochodzenie protokołu'
);

select set_config(
  'request.jwt.claim.sub',
  'b1400000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer from public.user_paths
  ) + (
    select count(*)::integer from public.user_path_practices
  ),
  0,
  'RLS izoluje zapis i child table między użytkownikami'
);

select is(
  (
    select count(*)::integer
    from public.path_stages
    where path_id = 'b1000000-0000-4000-8000-000000000001'
  ),
  3,
  'opublikowane child tables protokołu są czytelne w katalogu'
);

select is(
  (
    select count(*)::integer
    from public.path_readings
    where stage_id = 'b9100000-0000-4000-8000-000000000001'
  ),
  0,
  'drugi użytkownik również nie widzi child table draftu'
);

select * from finish();
rollback;
