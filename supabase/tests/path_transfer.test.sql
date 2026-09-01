begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b3400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'b3-one@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b3400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'b3-two@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b3400000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'b3-reentry@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3400000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001', false, current_date - 45,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    )
  $$,
  'protokół startuje we wspólnym lifecycle'
);

select throws_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'b3500000-0000-4000-8000-000000000001',
      'yes', 'advance', null, current_date - 44
    )
  $$,
  '23514',
  'submit_path_transfer: etap nie jest gotowy',
  'sprawdzian nie omija kryterium gotowości etapu'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'b3500000-0000-4000-8000-000000000002',
      'yes', 'advance', 'Użyłem praktyki przed trudną rozmową.', current_date - 38
    )
  $$,
  'odpowiedź tak świadomie przesuwa pierwszy etap'
);

select is(
  (select ordinal from public.path_stages where id = (
    select current_stage_id from public.user_paths where state = 'active'
  )),
  2::smallint,
  'odpowiedź tak korzysta z istniejącego advance_path_stage'
);

select is(
  (select evidence from public.path_transfer_responses),
  'Użyłem praktyki przed trudną rozmową.',
  'krótkie prywatne zdanie jest oddzielone od enum odpowiedzi'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'b3500000-0000-4000-8000-000000000002',
      'yes', 'advance', 'Użyłem praktyki przed trudną rozmową.', current_date - 38
    )
  $$,
  'powtórzony request offline zwraca zapisany wynik'
);

select is(
  (select count(*)::integer from public.path_transfer_responses),
  1,
  'idempotentny retry nie duplikuje odpowiedzi ani przejścia'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000002',
      'b3500000-0000-4000-8000-000000000003',
      'not_yet', 'stay', null, current_date - 31
    )
  $$,
  'jeszcze nie pozwala zostać bez kary'
);

select is(
  (select ordinal from public.path_stages where id = (
    select current_stage_id from public.user_paths where state = 'active'
  )),
  2::smallint,
  'zostań nie przesuwa etapu'
);

select is(
  (
    select defer_until from public.path_transfer_responses
    where client_request_id = 'b3500000-0000-4000-8000-000000000003'
  ),
  current_date - 24,
  'neutralne odłożenie trwa siedem dni i nie dotyka serii'
);

select throws_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000002',
      'b3500000-0000-4000-8000-000000000004',
      'not_yet', 'advance', null, current_date - 30
    )
  $$,
  '23514',
  'submit_path_transfer: sprawdzian jest odłożony',
  'nowy request nie omija zadeklarowanego przedłużenia'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000002',
      'b3500000-0000-4000-8000-000000000005',
      'not_yet', 'advance', null, current_date - 23
    )
  $$,
  'jeszcze nie pozwala przejść dalej świadomie'
);

select is(
  (select ordinal from public.path_stages where id = (
    select current_stage_id from public.user_paths where state = 'active'
  )),
  3::smallint,
  'świadome przejście mimo jeszcze nie materializuje kolejny etap'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000003',
      'b3500000-0000-4000-8000-000000000006',
      'no_opportunity', 'stay', null, current_date - 16
    )
  $$,
  'brak okazji przedłuża etap bez niepowodzenia'
);

select ok(
  exists (
    select 1 from public.path_transfer_responses
    where response = 'no_opportunity' and decision = 'stay'
  ),
  'brak okazji pozostaje osobnym enumem, nie odpowiedzią negatywną'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000003',
      'b3500000-0000-4000-8000-000000000007',
      'not_yet', 'downshift', null, current_date - 8
    )
  $$,
  'jeszcze nie może skierować do istniejącego downshiftu bez przejścia'
);

select ok(
  exists (
    select 1 from public.path_transfer_responses
    where decision = 'downshift' and advanced_to_stage_id is null
  ),
  'decyzja downshift zostawia lifecycle na bieżącym etapie'
);

select lives_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000003',
      'b3500000-0000-4000-8000-000000000008',
      'no_opportunity', 'advance', null, current_date
    )
  $$,
  'na ostatnim etapie transfer prowadzi do istniejącego zakończenia'
);

select is(
  (
    select advanced_to_stage_id from public.path_transfer_responses
    where client_request_id = 'b3500000-0000-4000-8000-000000000008'
  ),
  null,
  'ostatni etap nie tworzy nieistniejącego kolejnego etapu'
);

select lives_ok(
  $$
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'completed', true
    )
  $$,
  'zakończenie tworzy prywatne potwierdzenie wdrożenia'
);

select ok(
  (
    select protocol_type = 'book_protocol'
      and source_title = 'Małe kroki, spokojny dzień'
      and jsonb_array_length(completed_stages) = 3
      and jsonb_array_length(practice_outcomes) = 3
      and user_sentence = 'Użyłem praktyki przed trudną rozmową.'
    from public.path_implementation_confirmations
  ),
  'potwierdzenie zachowuje źródło, etapy, praktyki i jedno prywatne zdanie'
);

select ok(
  (
    select (practice_outcomes -> 0) ? 'scheduled'
      and (practice_outcomes -> 0) ? 'completed'
      and exists (
        select 1 from public.path_transfer_responses response
        where response.user_path_id = confirmation.user_path_id
      )
    from public.path_implementation_confirmations confirmation
  ),
  'wykonanie i zgłoszony transfer są zapisane jako odrębne fakty'
);

select lives_ok(
  $$
    select public.archive_path_transfer_data(
      (select user_path_id from public.path_implementation_confirmations)
    )
  $$,
  'użytkownik może miękko usunąć swoje odpowiedzi'
);

reset role;

select ok(
  (
    select count(*) filter (where archived_at is not null) = count(*)
      and count(*) filter (where evidence is not null) = 0
    from public.path_transfer_responses
  ),
  'usunięcie archiwizuje odpowiedzi i nie zachowuje prywatnego tekstu'
);

select ok(
  (
    select answers_archived_at is not null and user_sentence is null
    from public.path_implementation_confirmations
  ),
  'potwierdzenie przestaje eksponować usunięte odpowiedzi'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3400000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.path_transfer_responses)
    + (select count(*)::integer from public.path_implementation_confirmations),
  0,
  'RLS izoluje odpowiedzi i potwierdzenia między użytkownikami'
);

select throws_ok(
  $$
    select public.archive_path_transfer_data(
      (select id from public.user_paths where user_id = 'b3400000-0000-4000-8000-000000000001')
    )
  $$,
  'P0002',
  'archive_path_transfer_data: brak zapisu',
  'drugi użytkownik nie może usunąć cudzych odpowiedzi'
);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000002', false, current_date,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    );
    select public.end_path(
      (select id from public.user_paths where state = 'active'),
      'abandoned', false
    )
  $$,
  'porzucenie nadal używa wspólnego zakończenia ścieżki'
);

select is(
  (select count(*)::integer from public.path_implementation_confirmations),
  0,
  'porzucenie nie tworzy potwierdzenia ukończenia'
);

select set_config('request.jwt.claim.sub', 'b3400000-0000-4000-8000-000000000003', true);

select lives_ok(
  $$
    select public.enroll_in_path(
      'b1000000-0000-4000-8000-000000000001', false, current_date - 10,
      '{}'::uuid[], '{"lite":false,"skip":[],"adjust":[],"note":""}'::jsonb
    );
    select public.pause_path((select id from public.user_paths where state = 'active'));
    select public.resume_path(
      (select id from public.user_paths where state = 'paused'), current_date - 1, true
    )
  $$,
  'ponowne wejście zachowuje istniejący lifecycle'
);

select throws_ok(
  $$
    select public.submit_path_transfer(
      (select id from public.user_paths where state = 'active'),
      'b1100000-0000-4000-8000-000000000001',
      'b3500000-0000-4000-8000-000000000009',
      'yes', 'advance', null, current_date
    )
  $$,
  '23514',
  'submit_path_transfer: trwa spokojne ponowne wejście',
  'sprawdzian nie przerywa tygodnia ponownego wejścia'
);

select * from finish();
rollback;
