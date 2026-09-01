-- Ścieżka „Droga wojownika w czasach pokoju".
--
-- NAZWA. Nie „Droga samuraja". Te teksty napisali ludzie wyszkoleni do walki,
-- którym odebrano wojnę, i próbujący ustalić, jak żyć w dyscyplinie, kiedy nic
-- jej nie wymusza. To jest dosłownie ich temat — i dokładnie problem człowieka
-- z biurkiem. Ta rama jest prawdziwsza historycznie od miecza w tle i nic nie
-- kosztuje.
--
-- PRAWO AUTORSKIE — uwaga, na której najłatwiej się potknąć:
-- domena publiczna ORYGINAŁU nie oznacza domeny publicznej PRZEKŁADU.
-- Tłumacz ma własne prawa przez siedemdziesiąt lat od śmierci.
--   * Polskie przekłady „Rozmyślań" Marka Aureliusza (Marian Krokiewicz zmarł
--     w 1977 — ochrona do 2047; podobnie inne XX-wieczne przekłady) są
--     CHRONIONE i nie wolno ich tu cytować. Tydzień 12 zawiera przekład własny
--     z angielskiego tekstu w domenie publicznej.
--   * To samo dotyczy współczesnych angielskich przekładów Hagakure
--     i Gorin no shō (m.in. Wilson, Harris) — nie są tu użyte. Wszystkie
--     fragmenty japońskie renderujemy sami, z tekstu oryginalnego.
--   * Nitobe 1900 powstał po angielsku i jest w domenie publicznej, ale polska
--     wersja poniżej też jest przekładem własnym.
-- Stąd source_kind = 'own_translation' przy każdej lekturze. Ani jednego
-- 'pointer': ta ścieżka ma być czytelna w całości w aplikacji.
--
-- WERYFIKACJA. Każde attribution wskazuje konkretny fragment: numery linii
-- Dokkōdō, księgę Hagakure wraz z japońskim incipitem, nazwaną księgę
-- Gorin no shō, numer rozdziału Nitobego, numer księgi i sekcji Rozmyślań.
-- Incipit zamiast numeru sekcji przy Hagakure jest świadomy: numeracja sekcji
-- różni się między wydaniami, a pierwsze słowa fragmentu wskazują go
-- jednoznacznie w każdym z nich.

-- Definicja ------------------------------------------------------------------

insert into public.paths (
  slug, version, title, hook, honesty, completion_note,
  duration_days, language, is_published, sort_order
)
values
  (
    'warrior-in-peacetime',
    1,
    'Droga wojownika w czasach pokoju',
    'Teksty pisane przez wojowników, którym odebrano wojnę. Dokładnie ten sam problem, co Twój.',
    'Bushidō jako spójny kodeks to w dużej mierze wynalazek z 1900 roku — Nitobe napisał je po angielsku, dla Amerykanów. Samurajowie z epoki wojen domowych nie czytali Hagakure: powstało sto lat po nich, spisane przez urzędnika, który tęsknił za wojną, której nie widział. Ta ścieżka nie udaje, że jest inaczej. Bierzemy z tych tekstów to, co działa dla kogoś, kto ma biurko zamiast miecza.',
    'Dziewięćdziesiąt dni za Tobą. Sześć praktyk zostaje na liście — możesz je zostawić, zmienić albo zdjąć. List, który dziś napiszesz, wróci do Ciebie za rok.',
    90,
    'pl',
    true,
    1
  ),
  (
    'warrior-in-peacetime',
    1,
    'The warrior’s way in peacetime',
    'Texts written by warriors whose war had been taken away. Exactly the problem you have.',
    'Bushidō as a coherent code is largely an invention of 1900 — Nitobe wrote it in English, for Americans. Samurai of the civil war era did not read Hagakure: it appeared a century after them, written down by an official who missed a war he had never seen. This path does not pretend otherwise. We take from these texts what works for someone who has a desk instead of a sword.',
    'Ninety days behind you. Six practices stay on your list — keep them, change them or take them off. The letter you write today comes back to you in a year.',
    90,
    'en',
    true,
    1
  );

-- Etapy ----------------------------------------------------------------------
--
-- daily_minutes_p50 mówi, ile etap zabiera z OKNA użytkownika, a nie ile trwają
-- wszystkie praktyki razem. „Jedno zadanie do końca" nie dokłada godziny do
-- doby — porządkuje czas pracy, który i tak jest zajęty. „Jednakowe wstawanie"
-- nie zajmuje ani minuty. Liczą się: czytanie, cisza, wieczorne rozliczenie,
-- porządek w jednym miejscu i sekundy pod zimną wodą.

insert into public.path_stages (
  path_id, ordinal, name, description,
  daily_minutes_p50, min_days, max_days, completion_threshold
)
select
  p.id, s.ordinal, s.name, s.description,
  s.minutes, s.min_days, s.max_days, s.threshold
from public.paths p
join (
  values
    (
      'pl', 1::smallint, 'Porządek',
      'Trzydzieści dni na jedną rzecz: żeby doba miała ramy. Stała godzina wstawania, jedno miejsce doprowadzone do porządku, trzy oddechy przed pierwszą decyzją i dziesięć minut czytania. Nic z tego nie jest ćwiczeniem charakteru — to są ramy, w których charakter ma się gdzie odkładać.',
      22::smallint, 21::smallint, 40::smallint, 0.6::numeric
    ),
    (
      'pl', 2::smallint, 'Powściągliwość',
      'Etap o odmawianiu. Jedno „nie" dziennie, jedna rzecz nieprzyjemna z własnego wyboru i trzy zapisane linie na koniec dnia. Trzy oddechy schodzą z listy — wsiąkły w rutynę i nie ma już czego liczyć.',
      28::smallint, 21::smallint, 40::smallint, 0.55::numeric
    ),
    (
      'pl', 3::smallint, 'Ostrość',
      'Ostatnie trzydzieści dni. Jedno zadanie doprowadzone do końca bez przerywania i dwadzieścia minut ciszy — bez telefonu, bez muzyki, bez książki. Dwie praktyki odchodzą, żeby te dwie miały gdzie się zmieścić.',
      35::smallint, 21::smallint, 45::smallint, 0.5::numeric
    ),
    (
      'en', 1::smallint, 'Order',
      'Thirty days for one thing: giving the day a frame. One fixed waking hour, one place put in order, three breaths before the first decision and ten minutes of reading. None of it is character training — it is the frame in which character has somewhere to settle.',
      22::smallint, 21::smallint, 40::smallint, 0.6::numeric
    ),
    (
      'en', 2::smallint, 'Restraint',
      'The stage about refusing. One „no" a day, one unpleasant thing you choose yourself, and three written lines at the end of the day. Three breaths come off the list — they have soaked into the routine and there is nothing left to count.',
      28::smallint, 21::smallint, 40::smallint, 0.55::numeric
    ),
    (
      'en', 3::smallint, 'Sharpness',
      'The last thirty days. One task carried to the end without interruption, and twenty minutes of silence — no phone, no music, no book. Two practices leave so that these two have room.',
      35::smallint, 21::smallint, 45::smallint, 0.5::numeric
    )
) as s (language, ordinal, name, description, minutes, min_days, max_days, threshold)
  on s.language = p.language
where p.slug = 'warrior-in-peacetime'
  and p.version = 1;

-- Praktyki -------------------------------------------------------------------
--
-- Dziewięć praktyk w definicji, sześć na liście po ostatnim etapie: etap drugi
-- zdejmuje jedną, etap trzeci dwie. Ścieżka kończąca się dziewięcioma nawykami
-- jest nieudana, choćby użytkownik ją domknął.
--
-- „Zimna woda" jest jedyną praktyką oznaczoną jako wyłączalna. Rama jest
-- wyłącznie o tolerancji dyskomfortu z wyboru — ani jedno pole tej praktyki
-- nie mówi o ciele ani o tym, co się z nim dzieje, i tak ma zostać. To także
-- jedyna praktyka w katalogu, którą użytkownik może odznaczyć przy zapisie.

insert into public.path_practices (
  stage_id, title, why, how, when_hard,
  unit, start_value, increment_value, target_value, progression_mode,
  time_of_day, is_optional, sort_order
)
select
  st.id, x.title, x.why, x.how, x.when_hard,
  x.unit, x.start_value, x.increment_value, x.target_value, x.progression_mode,
  x.time_of_day, x.is_optional, x.sort_order
from public.path_stages st
join public.paths p on p.id = st.path_id
join (
  values
    -- Etap 1 — Porządek
    (
      'pl', 1::smallint, 'Jednakowe wstawanie',
      'Kiedy nic nie wymusza rytmu, jedna stała godzina jest jedyną rzeczą, która trzyma dobę w ryzach.',
      'Jedna godzina, siedem dni w tygodniu. Weekend też.',
      'Nie wstajesz? Przesuń godzinę na późniejszą i trzymaj tę.',
      'none', 1::numeric, 0::numeric, null::numeric, 'completion',
      'morning', false, 0
    ),
    (
      'pl', 1::smallint, 'Jedno miejsce',
      'Jedna uprzątnięta powierzchnia to dowód, że dzień dało się domknąć — mały, ale nie do podważenia.',
      'Jedno miejsce do zera: biurko, blat, jedna półka. Pięć minut.',
      'Nie masz pięciu minut? Odłóż pięć rzeczy na miejsce i zostaw resztę.',
      'minutes', 5::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 1
    ),
    (
      'pl', 1::smallint, 'Trzy oddechy',
      'U Tsunetomo „w przestrzeni siedmiu oddechów" było naganą za rozmyślanie, nie techniką uważności. Bierzemy stąd tempo, nie duchowość.',
      'Przed pierwszą decyzją dnia: trzy oddechy, potem decyzja. Nie odwrotnie.',
      'Zapomniałeś rano? Zrób to przed pierwszą decyzją, która jeszcze przed Tobą.',
      'count', 3::numeric, 0::numeric, null::numeric, 'completion',
      'morning', false, 2
    ),
    (
      'pl', 1::smallint, 'Czytanie',
      'Ta ścieżka stoi na tekstach. Dziesięć minut dziennie wystarczy na wszystkie dwanaście tygodni.',
      'Dziesięć minut lektury tygodnia. Jeden fragment, bez nadrabiania zaległości.',
      'Nie masz dziesięciu minut? Przeczytaj jeden akapit i zamknij.',
      'minutes', 10::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 3
    ),
    -- Etap 2 — Powściągliwość
    (
      'pl', 2::smallint, 'Jedno „nie" dziennie',
      'Powściągliwość zaczyna się od jednej odmowy, którą da się policzyć.',
      'Raz dziennie odmów czegoś, na co normalnie byś się zgodził. Zapisz w notatce, czego.',
      'Nie było czego odmówić? Odmów sobie — jednej rzeczy, na którą miałeś ochotę.',
      'count', 1::numeric, 0::numeric, null::numeric, 'completion',
      'afternoon', false, 0
    ),
    (
      'pl', 2::smallint, 'Zimna woda',
      'Chodzi wyłącznie o to, żeby zostać w czymś nieprzyjemnym, kiedy sam tak zdecydowałeś. Nic poza tym.',
      'Ostatnie trzydzieści sekund prysznica na zimno. Licz do końca, nie skracaj w trakcie.',
      'Za zimno? Skróć do dziesięciu sekund i zostań przy tej liczbie.',
      'seconds', 30::numeric, 10::numeric, 90::numeric, 'calendar',
      'morning', true, 1
    ),
    (
      'pl', 2::smallint, 'Wieczorne rozliczenie',
      'Dzień, którego nikt nie podsumował, wraca w nocy. Trzy minuty wystarczą, żeby go zamknąć.',
      'Jedna zapisana linia: co zrobiłeś, czego nie. Bez planów na jutro.',
      'Nie masz co napisać? Napisz jedno zdanie o tym, co dziś było najtrudniejsze.',
      'minutes', 3::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 2
    ),
    -- Etap 3 — Ostrość
    (
      'pl', 3::smallint, 'Jedno zadanie do końca',
      'Jedna rzecz doprowadzona do końca uczy więcej niż pięć zaczętych.',
      'Wybierz jedno zadanie i nie przerywaj go niczym innym. Telefon w drugim pokoju.',
      'Nie dajesz rady? Skróć blok, ale nie przerywaj go w środku.',
      'minutes', 25::numeric, 5::numeric, 45::numeric, 'calendar',
      'morning', false, 0
    ),
    (
      'pl', 3::smallint, 'Cisza',
      'Dwadzieścia minut bez wejścia z zewnątrz to jedyny moment doby, w którym słychać własne zdanie.',
      'Dwadzieścia minut: bez telefonu, bez muzyki, bez książki. Siedzenie albo chodzenie.',
      'Nie wytrzymujesz dwudziestu? Zostań przy dziesięciu i nie skracaj dalej.',
      'minutes', 20::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 1
    ),
    -- Stage 1 — Order
    (
      'en', 1::smallint, 'The same waking hour',
      'When nothing forces a rhythm, one fixed hour is the only thing holding the day together.',
      'One hour, seven days a week. Weekends included.',
      'Not getting up? Move the hour later and hold that one.',
      'none', 1::numeric, 0::numeric, null::numeric, 'completion',
      'morning', false, 0
    ),
    (
      'en', 1::smallint, 'One place',
      'One cleared surface is proof that the day could be closed — small, but not arguable.',
      'One place down to zero: a desk, a counter, one shelf. Five minutes.',
      'No five minutes? Put five things back where they belong and leave the rest.',
      'minutes', 5::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 1
    ),
    (
      'en', 1::smallint, 'Three breaths',
      'For Tsunetomo „within the space of seven breaths" was a reproach for dithering, not a mindfulness technique. We take the tempo from it, not the spirituality.',
      'Before the first decision of the day: three breaths, then the decision. Not the other way round.',
      'Forgot in the morning? Do it before the first decision still ahead of you.',
      'count', 3::numeric, 0::numeric, null::numeric, 'completion',
      'morning', false, 2
    ),
    (
      'en', 1::smallint, 'Reading',
      'This path stands on texts. Ten minutes a day is enough for all twelve weeks.',
      'Ten minutes of the week’s reading. One passage, no catching up.',
      'No ten minutes? Read one paragraph and close it.',
      'minutes', 10::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 3
    ),
    -- Stage 2 — Restraint
    (
      'en', 2::smallint, 'One „no" a day',
      'Restraint starts with a single refusal you can count.',
      'Once a day refuse something you would normally agree to. Note down what it was.',
      'Nothing to refuse? Refuse yourself — one thing you wanted.',
      'count', 1::numeric, 0::numeric, null::numeric, 'completion',
      'afternoon', false, 0
    ),
    (
      'en', 2::smallint, 'Cold water',
      'This is only about staying in something unpleasant once you have decided to. Nothing beyond that.',
      'The last thirty seconds of the shower cold. Count to the end, do not cut it short midway.',
      'Too cold? Cut it to ten seconds and stay at that number.',
      'seconds', 30::numeric, 10::numeric, 90::numeric, 'calendar',
      'morning', true, 1
    ),
    (
      'en', 2::smallint, 'Evening reckoning',
      'A day nobody closed comes back at night. Three minutes are enough to close it.',
      'One written line: what you did, what you did not. No plans for tomorrow.',
      'Nothing to write? Write one sentence about the hardest thing today.',
      'minutes', 3::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 2
    ),
    -- Stage 3 — Sharpness
    (
      'en', 3::smallint, 'One task to the end',
      'One thing carried to the end teaches more than five things started.',
      'Pick one task and let nothing else interrupt it. Phone in another room.',
      'Not managing? Shorten the block, but do not break it in the middle.',
      'minutes', 25::numeric, 5::numeric, 45::numeric, 'calendar',
      'morning', false, 0
    ),
    (
      'en', 3::smallint, 'Silence',
      'Twenty minutes with nothing coming in is the only part of the day where your own opinion is audible.',
      'Twenty minutes: no phone, no music, no book. Sitting or walking.',
      'Cannot take twenty? Stay at ten and go no lower.',
      'minutes', 20::numeric, 0::numeric, null::numeric, 'completion',
      'evening', false, 1
    )
) as x (
  language, stage_ordinal, title, why, how, when_hard,
  unit, start_value, increment_value, target_value, progression_mode,
  time_of_day, is_optional, sort_order
)
  on x.language = p.language
 and x.stage_ordinal = st.ordinal
where p.slug = 'warrior-in-peacetime'
  and p.version = 1;

-- Co odchodzi ----------------------------------------------------------------
--
-- Etap 2: „Wieczorne rozliczenie" zdejmuje „Trzy oddechy" — poranna pauza
-- wsiąka w wieczorny rachunek. Etap 3: „Jedno zadanie do końca" zdejmuje
-- „Jedno miejsce", a „Cisza" zdejmuje „Jedno »nie« dziennie": odmowa staje się
-- ciszą i nie ma już czego liczyć osobno.

update public.path_practices tp
set retires_practice_id = (
  select rp.id
  from public.path_practices rp
  join public.path_stages rs on rs.id = rp.stage_id
  where rs.path_id = ts.path_id
    and rp.title = m.retired
)
from public.path_stages ts
join public.paths p on p.id = ts.path_id
join (
  values
    ('pl', 'Wieczorne rozliczenie', 'Trzy oddechy'),
    ('pl', 'Jedno zadanie do końca', 'Jedno miejsce'),
    ('pl', 'Cisza', 'Jedno „nie" dziennie'),
    ('en', 'Evening reckoning', 'Three breaths'),
    ('en', 'One task to the end', 'One place'),
    ('en', 'Silence', 'One „no" a day')
) as m (language, retiring, retired)
  on m.language = p.language
where tp.stage_id = ts.id
  and tp.title = m.retiring
  and p.slug = 'warrior-in-peacetime'
  and p.version = 1;

-- Lektury --------------------------------------------------------------------
--
-- Dwanaście tygodni: Dokkōdō (1–4), Hagakure (5–8), Gorin no shō (9–10),
-- Nitobe jako dokument epoki (11), zestawienie z Markiem Aureliuszem (12).
-- Tygodnie 1–4 należą do etapu pierwszego, 5–8 do drugiego, 9–12 do trzeciego.

insert into public.path_readings (
  stage_id, week, title, author, source_kind, attribution, body, framing
)
select
  st.id, r.week, r.title, r.author, 'own_translation', r.attribution, r.body, r.framing
from public.path_stages st
join public.paths p on p.id = st.path_id
join (
  values
    (
      'pl', 1::smallint, 1::smallint,
      'Dokkōdō, linie 1–5', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, linie 1–5.',
      '1. Nie występuj przeciw drodze, którą szły pokolenia.
2. Nie zabiegaj o przyjemność dla siebie.
3. W żadnej sprawie nie kieruj się stronniczością.
4. O sobie myśl płytko, o świecie głęboko.
5. Przez całe życie nie oddawaj się pożądliwości.',
      'Musashi napisał te dwadzieścia jeden linii tydzień przed śmiercią, rozdając uczniowi swój dobytek. To nie jest kodeks dla organizacji ani program treningu — to lista rzeczy, których jeden człowiek postanowił nie robić. Pierwsze pięć zdań mówi o tym samym: nie stawiać siebie w środku. Przeczytaj je raz i wybierz jedno, które sprawdzisz dzisiaj w praktyce. Nie musisz się z nimi zgadzać. Musashi nie prosi o zgodę — mówi tylko, jak żył.'
    ),
    (
      'pl', 1::smallint, 2::smallint,
      'Dokkōdō, linie 6–10', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, linie 6–10.',
      '6. Nie żałuj tego, co zrobiłeś.
7. Nie zazdrość innym — ani w dobrym, ani w złym.
8. Na żadnej drodze nie rozpaczaj po rozstaniu.
9. Ani wobec siebie, ani wobec innych nie chowaj żalu i pretensji.
10. Nie zwracaj serca ku drodze zauroczenia.',
      'Pięć zdań o tym, co człowiek nosi po fakcie: żal, zazdrość, rozpamiętywanie rozstania, pretensję, zauroczenie. Musashi nie każe tych uczuć nie mieć — pisze, żeby się nimi nie kierować. Cała różnica jest tutaj. Do dziesięciu minut czytania dołóż dziś jedno pytanie: która z tych pięciu rzeczy zabrała Ci w tym tygodniu najwięcej uwagi? Odpowiedź możesz zostawić w notatce przy odhaczeniu.'
    ),
    (
      'pl', 1::smallint, 3::smallint,
      'Dokkōdō, linie 11–15', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, linie 11–15.',
      '11. W niczym nie miej upodobań.
12. Nie pragnij własnego domu.
13. Nie przepadaj za wykwintnym jedzeniem.
14. Nie trzymaj starych przedmiotów dla ich wartości.
15. Nie kieruj się przesądem co do siebie.',
      'Środkowe zdania są najmniej wygodne, bo dotyczą rzeczy, a nie uczuć: upodobań, mieszkania, jedzenia, przedmiotów, przesądów. Musashi rozdawał wtedy dobytek, więc pisał to dosłownie. Czytaj je jako pytanie o koszt: ile rzeczy w Twoim dniu jest tam dlatego, że je lubisz, a nie dlatego, że są potrzebne? To nie jest wezwanie do ascezy. To rachunek — i wolno Ci go zamknąć wynikiem, który Musashiemu by się nie spodobał.'
    ),
    (
      'pl', 1::smallint, 4::smallint,
      'Dokkōdō, linie 16–21', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, linie 16–21 wraz z datą i dedykacją (正保弐年五月十二日, 寺尾孫之丞殿).',
      '16. Poza orężem nie zbieraj innych narzędzi.
17. Na drodze nie wzbraniaj się przed śmiercią.
18. Na starość nie zabiegaj o majątek ani ziemię.
19. Czcij bogów i Buddów, ale nie licz na ich pomoc.
20. Ciało możesz oddać, imienia nie oddawaj.
21. Nigdy nie odchodź od drogi.',
      'Ostatnie sześć zdań, a pod nimi data: dwunasty dzień piątego miesiąca 1645 roku, tydzień przed śmiercią, dla ucznia Terao Magonojō. Zdanie dziewiętnaste — „czcij bogów, ale nie licz na ich pomoc" — jest najbardziej niejednoznaczne z całej listy i warto się przy nim zatrzymać. Dwudzieste pierwsze zamyka wszystko: nie odchodź od drogi. U Musashiego drogą była strategia. U Ciebie jest nią to, co robisz codziennie o tej samej godzinie.'
    ),
    (
      'pl', 2::smallint, 5::smallint,
      'Hagakure: siedem oddechów', 'Yamamoto Tsunetomo',
      'Przekład własny z tekstu japońskiego: „Hagakure" (葉隠), księga I (聞書第一), fragment zaczynający się od słów „古人の詞に、七息思案と云ふとあり".',
      'Dawni mówili: rozstrzygać w siedmiu oddechach. Pan Takanobu powiedział: „Namysł, kiedy się przeciąga, gnuśnieje".',
      'To zdanie stoi za praktyką „trzy oddechy", ale znaczy coś innego, niż się dziś zwykle powtarza. Siedem oddechów było u Tsunetomo naganą za rozwlekłe rozmyślanie, nie techniką uważności — Takanobu mówi wprost, że namysł, kiedy się przeciąga, gnuśnieje. To jest zdanie o tempie decyzji, nie o oddychaniu. Trzy oddechy na Twojej liście są jego skróconą wersją: zatrzymaj się na moment, potem zdecyduj — a nie odwrotnie.'
    ),
    (
      'pl', 2::smallint, 6::smallint,
      'Hagakure: dwie drogi', 'Yamamoto Tsunetomo',
      'Przekład własny z tekstu japońskiego: „Hagakure" (葉隠), księga I (聞書第一), sekcja 2 według wydania Iwanami Bunko; fragment „武士道といふは、死ぬ事と見附けたり".',
      'Drogę wojownika odnalazłem w umieraniu. Kiedy stoisz przed dwiema drogami, rozstrzygnij szybko na tę stronę, po której jest śmierć.',
      'Najbardziej znane zdanie tej książki i najczęściej używane w złej wierze. Yamamoto Tsunetomo był urzędnikiem, który nie widział wojny; podyktował to sto lat po epoce, którą rzekomo opisuje, żyjąc na emeryturze po śmierci swojego pana. To nie jest instrukcja umierania, tylko opis wyboru bez odwrotu: kiedy stoisz przed dwiema drogami, nie zostawaj w połowie. Tyle da się z tego wziąć przy biurku — i tyle wystarczy.'
    ),
    (
      'pl', 2::smallint, 7::smallint,
      'Hagakure: powiedzieć komuś o jego błędzie', 'Yamamoto Tsunetomo',
      'Przekład własny z tekstu japońskiego: „Hagakure" (葉隠), księga I (聞書第一), fragment zaczynający się od słów „人に意見をして疵を直すと云ふは大切の事".',
      'Powiedzieć komuś o jego skazie i pomóc mu ją naprawić — to rzecz wielkiej wagi.',
      'Fragment, który nie pasuje do mitu: nie o mieczu, tylko o tym, jak powiedzieć komuś, że coś robi źle. Tsunetomo uważał to za jedną z najważniejszych rzeczy, jakie człowiek robi dla drugiego, i za jedną z najtrudniejszych — bo wymaga najpierw wiedzieć, czy ten ktoś w ogóle posłucha. W tym tygodniu masz na liście jedno „nie" dziennie. Ten fragment jest jego drugą stroną: odmowa i uwaga to ta sama umiejętność, skierowana w różne strony.'
    ),
    (
      'pl', 2::smallint, 8::smallint,
      'Hagakure: myśl po myśli', 'Yamamoto Tsunetomo',
      'Przekład własny z tekstu japońskiego: „Hagakure" (葉隠), księga I (聞書第一), fragment zaczynający się od słów „當念を守りて氣をぬかさず".',
      'Trzymaj się bieżącej chwili, nie wypuszczaj z niej ducha i rób swoje — nic więcej nie jest potrzebne. Przechodzisz przez życie myśl po myśli.',
      'Krótkie zdanie o pilnowaniu bieżącej chwili — najbliższe temu, co dziś nazywa się skupieniem, i napisane bez ani jednego słowa o skupieniu. „Myśl po myśli" nie znaczy: bądź obecny. Znaczy: nie rób dwóch rzeczy naraz i nie wybiegaj do przodu. W etapie trzecim dostaniesz z tego praktykę — jedno zadanie doprowadzone do końca. Ten fragment jest jej źródłem, dwieście lat przed pierwszym poradnikiem produktywności.'
    ),
    (
      'pl', 3::smallint, 9::smallint,
      'Gorin no shō: dziewięć zasad', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Gorin no shō" (五輪書), 1645, księga ziemi (地之巻), lista dziewięciu zasad zamykająca księgę.',
      '1. Myśl bez fałszu.
2. Ćwicz drogę.
3. Zetknij się z wieloma sztukami.
4. Poznaj drogi rozmaitych rzemiosł.
5. Rozróżniaj w każdej rzeczy stratę i zysk.
6. Wyrób sobie ocenę rzeczy.
7. Poznawaj to, czego nie widać.
8. Zwracaj uwagę nawet na drobiazgi.
9. Nie rób rzeczy bezużytecznych.',
      'Musashi zamyka księgę ziemi listą dziewięciu rzeczy dla kogoś, kto chce się uczyć jego drogi. To nie jest credo, tylko program: dziewięć czynności, nie dziewięć cnót. Zwróć uwagę na dziewiątą — „nie rób rzeczy bezużytecznych" — bo to jedyna, która trafia wprost w człowieka z kalendarzem pełnym spotkań. Przeczytaj listę raz i policz, ile z tych dziewięciu robisz naprawdę, a ile tylko uznajesz za słuszne.'
    ),
    (
      'pl', 3::smallint, 10::smallint,
      'Gorin no shō: dwa spojrzenia', 'Miyamoto Musashi',
      'Przekład własny z tekstu japońskiego: Miyamoto Musashi, „Gorin no shō" (五輪書), 1645, księga wody (水之巻), rozdział „兵法の目付といふ事".',
      'Patrz szeroko. Są dwa spojrzenia: obejmowanie i dostrzeganie. Obejmowanie ma być mocne, dostrzeganie słabe. To, co daleko, widzieć jak bliskie; to, co blisko — jak dalekie. Nie poruszając oczami, widzieć obie strony.',
      'Fragment o patrzeniu, z którego wzięła się połowa nowoczesnych porad o uwadze. Musashi rozróżnia dwa spojrzenia: obejmowanie całości i dostrzeganie szczegółu — i mówi, że pierwsze ma być mocne, a drugie słabe. Napisał to o walce, w której szczegół zabija, jeśli zasłoni całość. Przy biurku działa tak samo: to, co pilne, jest szczegółem, a to, co ważne, jest całością. W tym etapie masz na to dwa narzędzia: ciszę i jedno zadanie do końca.'
    ),
    (
      'pl', 3::smallint, 11::smallint,
      'Nitobe: opanowanie', 'Inazō Nitobe',
      'Przekład własny z angielskiego tekstu w domenie publicznej: Inazō Nitobe, „Bushido: The Soul of Japan", 1900, rozdział XI „Self-Control" (Project Gutenberg, ebook 12096).',
      'Uchodziło za niemęskie, żeby samuraj zdradzał uczucia na twarzy. „Nie okazuje ani radości, ani gniewu" — tak opisywano silny charakter. Najbardziej naturalne odruchy trzymano na wodzy.
[…]
Ćwiczenie się w opanowaniu łatwo idzie za daleko. Potrafi zdusić naturalny nurt duszy. Potrafi wykrzywić uległe natury, zrodzić bigoterię, wyhodować obłudę albo przytępić uczucia.',
      'Tu zmieniamy rejestr. Nitobe napisał tę książkę po angielsku, w 1900 roku, dla czytelnika amerykańskiego, i skonstruował spójny kodeks tam, gdzie go nie było. Czytaj ten rozdział jako dokument epoki, nie jako źródło. Najciekawsze jest to, że sam Nitobe stawia granicę: pisze, że ćwiczenie się w opanowaniu łatwo idzie za daleko i potrafi zdusić naturalny nurt duszy. To zdanie jest uczciwsze niż cała reszta rozdziału — i warto je zapamiętać akurat teraz, przed końcem tej ścieżki.'
    ),
    (
      'pl', 3::smallint, 12::smallint,
      'Marek Aureliusz obok Musashiego', 'Marek Aureliusz, Miyamoto Musashi',
      'Przekład własny z angielskiego tekstu w domenie publicznej: Marek Aureliusz, „Rozmyślania", ks. IV, 3 i ks. V, 1 (Project Gutenberg, ebook 2680) oraz Miyamoto Musashi, „Dokkōdō", linia 21.',
      'Rozmyślania IV, 3: „Szukają sobie ustronnych miejsc: wsi, wybrzeży, gór — i ty sam często do takich miejsc tęsknisz. A wszystko to bierze się z prostoduszności. W każdej chwili, kiedy zechcesz, wolno Ci wycofać się w siebie. Człowiek nigdzie nie znajdzie lepszego ustronia niż własna dusza".
Rozmyślania V, 1: „Kiedy rano nie chce Ci się wstawać, pomyśl od razu: budzę się do ludzkiej roboty. Czy mam się ociągać z tym, do czego się urodziłem? Czy zostałem stworzony po to, żeby leżeć i wygrzewać się w cieple?".
Dokkōdō, linia 21: „Nigdy nie odchodź od drogi".',
      'Ostatni tydzień: dwa teksty z dwóch stron świata, zestawione świadomie i bez sugerowania między nimi jakiejkolwiek ciągłości. Marek Aureliusz pisał po grecku około 170 roku, jako cesarz w obozie wojskowym; Musashi po japońsku w 1645, jako szermierz pod koniec życia. Nie znali się i nie mieli wspólnej tradycji. Mają wspólny problem: co robić z dyscypliną, kiedy nikt jej nie wymusza. Przeczytaj oba fragmenty obok siebie i zauważ, gdzie się rozchodzą — to ciekawsze niż to, w czym się zgadzają.'
    ),
    (
      'en', 1::smallint, 1::smallint,
      'Dokkōdō, lines 1–5', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, lines 1–5.',
      '1. Do not turn against the way the generations went.
2. Do not scheme for your own pleasure.
3. In no matter be guided by partiality.
4. Think shallowly of yourself and deeply of the world.
5. All your life, do not give in to greed.',
      'Musashi wrote these twenty-one lines a week before his death, while giving his possessions away to a student. This is not a code for an organisation nor a training programme — it is a list of things one man decided not to do. The first five say the same thing: do not put yourself in the middle. Read them once and pick one to test today in practice. You do not have to agree. Musashi is not asking for agreement — he is saying how he lived.'
    ),
    (
      'en', 1::smallint, 2::smallint,
      'Dokkōdō, lines 6–10', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, lines 6–10.',
      '6. Do not regret what you have done.
7. Do not envy others — in good or in ill.
8. On no road grieve over a parting.
9. Hold no grudge and no complaint, against yourself or others.
10. Do not turn your heart toward infatuation.',
      'Five lines about what a person carries after the fact: regret, envy, dwelling on a parting, grievance, infatuation. Musashi does not say not to have these feelings — he says not to be guided by them. The whole difference is there. Add one question to your ten minutes of reading today: which of the five took the most of your attention this week? You can leave the answer in the note when you check the habit off.'
    ),
    (
      'en', 1::smallint, 3::smallint,
      'Dokkōdō, lines 11–15', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, lines 11–15.',
      '11. Have no preferences in anything.
12. Do not long for a house of your own.
13. Do not be fond of fine food.
14. Do not keep old things for their value.
15. Do not be led by superstition about yourself.',
      'The middle lines are the least comfortable, because they are about things rather than feelings: preferences, housing, food, objects, superstition. Musashi was giving his possessions away as he wrote, so he meant them literally. Read them as a question about cost: how much in your day is there because you like it rather than because it is needed? This is not a call to asceticism. It is an account — and you are allowed to close it with a figure Musashi would not have approved of.'
    ),
    (
      'en', 1::smallint, 4::smallint,
      'Dokkōdō, lines 16–21', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Dokkōdō" (獨行道), 1645, lines 16–21 with the date and dedication (正保弐年五月十二日, 寺尾孫之丞殿).',
      '16. Beyond weapons, do not collect other implements.
17. On the Way, do not shrink from death.
18. In old age, do not seek wealth or land.
19. Honour the gods and buddhas, but do not count on their help.
20. You may give up the body; do not give up the name.
21. Never depart from the Way.',
      'The last six lines, and beneath them a date: the twelfth day of the fifth month of 1645, a week before his death, for his student Terao Magonojō. Line nineteen — honour the gods but do not count on their help — is the most ambiguous of the list and worth stopping at. Line twenty-one closes everything: never depart from the Way. For Musashi the Way was strategy. For you it is whatever you do every day at the same hour.'
    ),
    (
      'en', 2::smallint, 5::smallint,
      'Hagakure: seven breaths', 'Yamamoto Tsunetomo',
      'Own rendering from the Japanese: „Hagakure" (葉隠), Book I (聞書第一), the passage beginning „古人の詞に、七息思案と云ふとあり".',
      'The ancients said: decide within seven breaths. Lord Takanobu said: „Deliberation, when it drags on, grows sluggish".',
      'This line stands behind the „three breaths" practice, but it means something other than what is usually repeated today. For Tsunetomo seven breaths was a reproach for drawn-out deliberation, not a mindfulness technique — Takanobu says plainly that thinking, when it drags, grows sluggish. It is a line about the tempo of a decision, not about breathing. The three breaths on your list are its short version: stop for a moment, then decide — not the other way round.'
    ),
    (
      'en', 2::smallint, 6::smallint,
      'Hagakure: two roads', 'Yamamoto Tsunetomo',
      'Own rendering from the Japanese: „Hagakure" (葉隠), Book I (聞書第一), section 2 in the Iwanami Bunko edition; the passage „武士道といふは、死ぬ事と見附けたり".',
      'I found the way of the warrior in dying. When you stand before two roads, settle quickly on the side where death is.',
      'The most famous line in the book and the one most often used in bad faith. Yamamoto Tsunetomo was an official who never saw war; he dictated this a century after the era he supposedly describes, living in retirement after his lord’s death. It is not an instruction in dying but a description of a choice with no way back: when you stand before two roads, do not stay in the middle. That is what can be taken from it at a desk — and it is enough.'
    ),
    (
      'en', 2::smallint, 7::smallint,
      'Hagakure: telling someone they are wrong', 'Yamamoto Tsunetomo',
      'Own rendering from the Japanese: „Hagakure" (葉隠), Book I (聞書第一), the passage beginning „人に意見をして疵を直すと云ふは大切の事".',
      'To tell someone of his flaw and help him correct it — that is a matter of great weight.',
      'A passage that does not fit the myth: not about the sword, but about how to tell someone they are doing something badly. Tsunetomo thought it one of the most important things a person does for another, and one of the hardest — because it requires first knowing whether that person will listen at all. This week you have one „no" a day on your list. This passage is its other side: refusal and attention are the same skill pointed in different directions.'
    ),
    (
      'en', 2::smallint, 8::smallint,
      'Hagakure: thought by thought', 'Yamamoto Tsunetomo',
      'Own rendering from the Japanese: „Hagakure" (葉隠), Book I (聞書第一), the passage beginning „當念を守りて氣をぬかさず".',
      'Hold to the present moment, do not let your spirit slip out of it, and do your work — nothing more is needed. You pass through life thought by thought.',
      'A short line about guarding the present moment — the closest thing here to what is now called focus, written without a single word about focus. „Thought by thought" does not mean: be present. It means: do not do two things at once and do not run ahead. In the third stage this becomes a practice — one task carried to the end. This passage is its source, two centuries before the first productivity manual.'
    ),
    (
      'en', 3::smallint, 9::smallint,
      'Gorin no shō: nine rules', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Gorin no shō" (五輪書), 1645, the Book of Earth (地之巻), the list of nine rules closing the book.',
      '1. Think without falsehood.
2. Train in the Way.
3. Touch upon many arts.
4. Know the ways of the various trades.
5. Tell loss from gain in every matter.
6. Develop judgement of things.
7. Come to know what cannot be seen.
8. Pay attention even to trifles.
9. Do nothing useless.',
      'Musashi closes the Book of Earth with a list of nine things for anyone who wants to learn his Way. It is not a creed but a programme: nine activities, not nine virtues. Look at the ninth — do nothing useless — because it is the only one that lands squarely on a person with a calendar full of meetings. Read the list once and count how many of the nine you actually do, and how many you merely consider right.'
    ),
    (
      'en', 3::smallint, 10::smallint,
      'Gorin no shō: two ways of looking', 'Miyamoto Musashi',
      'Own rendering from the Japanese: Miyamoto Musashi, „Gorin no shō" (五輪書), 1645, the Book of Water (水之巻), the section „兵法の目付といふ事".',
      'Look broadly. There are two ways of looking: taking in and picking out. Taking in should be strong, picking out weak. See what is far as if near, and what is near as if far. Without moving the eyes, see both sides.',
      'The passage on looking that half of modern advice about attention came from. Musashi distinguishes two ways of seeing: taking in the whole and picking out the detail — and says the first should be strong, the second weak. He wrote it about combat, where a detail kills if it hides the whole. At a desk it works the same way: what is urgent is the detail, what matters is the whole. This stage gives you two tools for it: silence, and one task to the end.'
    ),
    (
      'en', 3::smallint, 11::smallint,
      'Nitobe: self-control', 'Inazō Nitobe',
      'Own rendering from the English public-domain text: Inazō Nitobe, „Bushido: The Soul of Japan", 1900, chapter XI „Self-Control" (Project Gutenberg, ebook 12096).',
      'It was considered unmanly for a samurai to betray his emotions on his face. „He shows no sign of joy or anger" was a phrase used in describing a strong character. The most natural affections were kept under control.
[…]
Discipline in self-control can easily go too far. It can well repress the genial current of the soul. It can force pliant natures into distortions and monstrosities, beget bigotry, breed hypocrisy or hebetate affections.',
      'Here the register changes. Nitobe wrote this book in English, in 1900, for an American reader, and constructed a coherent code where there had been none. Read this chapter as a document of its period, not as a source. The most interesting part is that Nitobe himself draws a line: he writes that discipline in self-control can easily go too far and repress the genial current of the soul. That sentence is more honest than the rest of the chapter — and worth remembering right now, near the end of this path.'
    ),
    (
      'en', 3::smallint, 12::smallint,
      'Marcus Aurelius beside Musashi', 'Marcus Aurelius, Miyamoto Musashi',
      'Own rendering from the English public-domain text: Marcus Aurelius, „Meditations", Book IV, 3 and Book V, 1 (Project Gutenberg, ebook 2680), and Miyamoto Musashi, „Dokkōdō", line 21.',
      'Meditations IV, 3: „They seek out private retiring places for themselves — country villages, the sea-shore, mountains; and you yourself long for such places. But all this comes of simplicity. Whenever you wish, it is in your power to retire into yourself. A man can retire nowhere better than into his own soul".
Meditations V, 1: „When in the morning you find yourself unwilling to rise, think at once: I am stirred up to a man’s work. Am I unwilling to go about that for which I was born? Or was I made for this, to lie down and keep myself warm in bed?".
Dokkōdō, line 21: „Never depart from the Way".',
      'The last week: two texts from two ends of the world, set side by side deliberately and without suggesting any continuity between them. Marcus Aurelius wrote in Greek around the year 170, as an emperor in a military camp; Musashi in Japanese in 1645, as a swordsman at the end of his life. They did not know of each other and shared no tradition. They share a problem: what to do with discipline when nothing enforces it. Read both passages together and notice where they part ways — that is more interesting than where they agree.'
    )
) as r (
  language, stage_ordinal, week, title, author, attribution, body, framing
)
  on r.language = p.language
 and r.stage_ordinal = st.ordinal
where p.slug = 'warrior-in-peacetime'
  and p.version = 1;
