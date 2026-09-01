-- Ścieżka „Wyjście z chaosu" — pierwsza pozycja katalogu.
--
-- Czternaście dni, bez lektur i bez filozofii. Brak lektur jest decyzją, a nie
-- oszczędnością: człowiek, któremu właśnie się posypało, nie ma miejsca na
-- czytanie. Dlatego ta ścieżka, a nie „Droga wojownika", stoi w katalogu
-- pierwsza (sort_order 0).
--
-- JĘZYK: treść zostaje w bazie, po jednym wierszu na język.
--
-- Brief dopuszczał dwie drogi — wiersze albo klucze i18n w kolumnach — i kazał
-- wybrać jedną. Klucze odpadają, bo praktyka ścieżki materializuje się jako
-- zwykły wiersz w public.habits: w kolumnie habits.title wylądowałby wtedy
-- 'path.outOfChaos.p1.title', a ekran „Dziś" renderuje tytuły nawyków wprost,
-- bez rozróżniania, które pochodzą ze ścieżki. Do tego typowane klucze i18n
-- przestałyby być sprawdzalne, bo string z bazy nie przejdzie przez typecheck,
-- a kilka tysięcy słów treści na ścieżkę weszłoby do bundla aplikacji zamiast
-- zostać w katalogu.
--
-- Ceną jest rozszerzenie klucza unikalności o język: paths.language istniało
-- od P5, ale UNIQUE (slug, version) dopuszczało tylko jeden wiersz na wersję.
-- Ten sam wzorzec mają już quotes i habit_templates — treść w bazie, kolumna
-- language, filtr po stronie zapytania.

alter table public.paths
  drop constraint paths_slug_version_key,
  add constraint paths_slug_version_language_key unique (slug, version, language);

comment on column public.paths.language is
  'Język treści ścieżki. Wersja obcojęzyczna to osobny wiersz o tym samym slugu
   i tej samej wersji — zapytania katalogu filtrują po tej kolumnie. Zapis
   użytkownika (user_paths.path_id) przypina go do konkretnego wiersza, więc
   ścieżka zaczęta po polsku zostaje po polsku do końca.';

alter table public.paths
  add column completion_note text;

comment on column public.paths.completion_note is
  'Jedno zdanie pokazywane przy zamknięciu ścieżki. Mówi, co zostaje na liście
   i że ścieżka nie jest już potrzebna — nie gratuluje i nie proponuje kolejnej.';

-- Definicja ------------------------------------------------------------------

insert into public.paths (
  slug, version, title, hook, honesty, completion_note,
  duration_days, language, is_published, sort_order
)
values
  (
    'out-of-chaos',
    1,
    'Wyjście z chaosu',
    'Czternaście dni, trzy rzeczy dziennie, żadnej filozofii. Dla kogoś, komu właśnie się posypało.',
    -- honesty zostaje puste: ta ścieżka nie ma źródeł historycznych i nie udaje,
    -- że ma. Akapit o uczciwości wobec źródeł należy się tylko tam, gdzie są
    -- źródła.
    null,
    'Czternaście dni za Tobą. Te cztery rzeczy zostają na Twojej liście — możesz je zostawić, zmienić albo zdjąć. Ścieżka nie jest już potrzebna.',
    14,
    'pl',
    true,
    0
  ),
  (
    'out-of-chaos',
    1,
    'Out of chaos',
    'Fourteen days, three things a day, no philosophy. For someone whose life has just come apart.',
    null,
    'Fourteen days behind you. These four things stay on your list — keep them, change them or take them off. The path is no longer needed.',
    14,
    'en',
    true,
    0
  );

-- Etapy ----------------------------------------------------------------------
--
-- Dwa etapy, nie trzy: przy czternastu dniach trzeci byłby podziałem na papierze.
-- Próg 0,4 w obu — od kogoś, kto właśnie stracił rytm, nie wymagamy większości
-- dni. Sufit (max_days) i tak przepuszcza dalej.

insert into public.path_stages (
  path_id, ordinal, name, description,
  daily_minutes_p50, min_days, max_days, completion_threshold
)
select
  p.id, s.ordinal, s.name, s.description,
  s.minutes, s.min_days, s.max_days, 0.4
from public.paths p
join (
  values
    (
      'pl', 1::smallint, 'Grunt',
      'Trzy rzeczy, każda poniżej pięciu minut. Chodzi o to, żeby w dobie istniał jakikolwiek stały punkt.',
      10::smallint, 5::smallint, 10::smallint
    ),
    (
      'pl', 2::smallint, 'Ciąg dalszy',
      'Te same trzy rzeczy, plus jedna. Nic więcej nie dochodzi.',
      15::smallint, 5::smallint, 12::smallint
    ),
    (
      'en', 1::smallint, 'Ground',
      'Three things, each under five minutes. The point is that the day has any fixed point at all.',
      10::smallint, 5::smallint, 10::smallint
    ),
    (
      'en', 2::smallint, 'What follows',
      'The same three things, plus one. Nothing else comes in.',
      15::smallint, 5::smallint, 12::smallint
    )
) as s (language, ordinal, name, description, minutes, min_days, max_days)
  on s.language = p.language
where p.slug = 'out-of-chaos'
  and p.version = 1;

-- Praktyki -------------------------------------------------------------------
--
-- Etap drugi dokłada jedną praktykę i nie zabiera żadnej — stąd brak
-- retires_practice_id. Trzy pozycje z pierwszego etapu po prostu idą dalej;
-- wiersz etapu opisuje to, co dochodzi, a nie całą listę.
--
-- Kategorii nie ustawiamy. Żadna z pięciu nie opisuje tych praktyk uczciwie,
-- a przy „Dziesięciu minutach na zewnątrz" najbliższa z nich przestawiłaby
-- ramę z porządku doby na interwencję medyczną — czyli dokładnie tam, gdzie
-- ta ścieżka nie idzie. Rama jest wyłącznie strukturalna: chodzi o przerwanie
-- dnia, który zlał się w jedną bryłę.

insert into public.path_practices (
  stage_id, title, why, how, when_hard,
  unit, start_value, time_of_day, sort_order
)
select
  st.id, x.title, x.why, x.how, x.when_hard,
  x.unit, x.start_value, x.time_of_day, x.sort_order
from public.path_stages st
join public.paths p on p.id = st.path_id
join (
  values
    (
      'pl', 1::smallint, 'Jedna godzina wstawania',
      'Kiedy wszystko inne jest ruchome, jedna stała godzina wystarcza, żeby dzień miał początek.',
      'Ustaw jedną godzinę i trzymaj ją także w weekend. Zakres pół godziny jest ok.',
      'Za trudno? Przesuń godzinę na późniejszą, zamiast rezygnować.',
      'none', 1::numeric, 'morning', 0
    ),
    (
      'pl', 1::smallint, 'Jedno miejsce',
      'Jedna uprzątnięta powierzchnia to jedyny dowód, że dało się coś dziś domknąć.',
      'Wybierz jedno miejsce — biurko, blat, jeden stolik. Do zera. Trzy minuty.',
      'Nie masz trzech minut? Uprzątnij pięć rzeczy i zostaw resztę.',
      'minutes', 3::numeric, 'evening', 1
    ),
    (
      'pl', 1::smallint, 'Jedno zdanie',
      'Zapisane zdanie zamyka dzień. Niezapisany dzień ciągnie się w noc.',
      'Jedna linia o tym, co było. Bez oceniania, bez planów na jutro.',
      'Nie wiesz co napisać? Napisz »nie wiem, co napisać«. To się liczy.',
      'count', 1::numeric, 'evening', 2
    ),
    (
      'pl', 2::smallint, 'Dziesięć minut na zewnątrz',
      'Wyjście z pomieszczenia przerywa dzień, który zlał się w jedną bryłę.',
      'Dziesięć minut poza budynkiem. Bez celu, bez zakupów po drodze.',
      'Pogoda nie pozwala? Otwórz okno i stój przy nim dziesięć minut.',
      'minutes', 10::numeric, 'afternoon', 0
    ),
    (
      'en', 1::smallint, 'One wake-up hour',
      'When everything else is moving, one fixed hour is enough to give the day a beginning.',
      'Pick one hour and hold it on weekends too. Half an hour either way is fine.',
      'Too hard? Move the hour later instead of giving it up.',
      'none', 1::numeric, 'morning', 0
    ),
    (
      'en', 1::smallint, 'One place',
      'One cleared surface is the only proof that something got finished today.',
      'Pick one place — a desk, a counter, one side table. Down to zero. Three minutes.',
      'No three minutes? Put five things away and leave the rest.',
      'minutes', 3::numeric, 'evening', 1
    ),
    (
      'en', 1::smallint, 'One sentence',
      'A written sentence closes the day. An unwritten day drags on into the night.',
      'One line about what happened. No judging, no plans for tomorrow.',
      'Don’t know what to write? Write »I don’t know what to write«. That counts.',
      'count', 1::numeric, 'evening', 2
    ),
    (
      'en', 2::smallint, 'Ten minutes outside',
      'Leaving the room breaks up a day that has run together into one block.',
      'Ten minutes outside the building. No destination, no errands on the way.',
      'Weather in the way? Open a window and stand by it for ten minutes.',
      'minutes', 10::numeric, 'afternoon', 0
    )
) as x (
  language, stage_ordinal, title, why, how, when_hard,
  unit, start_value, time_of_day, sort_order
)
  on x.language = p.language
 and x.stage_ordinal = st.ordinal
where p.slug = 'out-of-chaos'
  and p.version = 1;
