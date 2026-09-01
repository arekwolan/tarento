-- Dane startowe dla lokalnego środowiska (`supabase db reset`).
--
-- Cytaty: dzieła źródłowe (Marek Aureliusz, Seneka, Epiktet) są w domenie
-- publicznej. Polskie brzmienia poniżej są własnymi przekładami na potrzeby
-- projektu — nie przepisujemy istniejących tłumaczeń, bo te są odrębnymi
-- utworami i chronione prawem autorskim.

insert into public.quotes (content, author, source_book, language, tags, is_public_domain)
values
  ('Masz władzę nad swoim umysłem, nie nad tym, co dzieje się na zewnątrz. Uświadom to sobie, a znajdziesz siłę.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','kontrola'], true),
  ('Nie trać już czasu na spory o to, jakim człowiekiem należy być. Bądź nim.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','działanie'], true),
  ('Jakość twojego życia zależy od jakości twoich myśli.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','uwaga'], true),
  ('Gdy budzisz się rano, pomyśl, jaki to skarb: żyć, oddychać, móc myśleć i kochać.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','poranek','wdzięczność'], true),
  ('Przeszkoda w działaniu popycha działanie naprzód. To, co stoi na drodze, staje się drogą.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','przeszkody'], true),
  ('Zajmij się tylko tym, co masz teraz przed sobą: tą myślą, tym czynem, tym słowem.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','skupienie'], true),
  ('Nigdzie człowiek nie znajdzie spokojniejszego schronienia niż we własnej duszy.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','spokój'], true),
  ('Nie zachowuj się tak, jakbyś miał żyć dziesięć tysięcy lat. Póki możesz, póki jeszcze czas, bądź dobry.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','czas'], true),
  ('Wszystko, co słyszymy, jest opinią, nie faktem. Wszystko, co widzimy, jest perspektywą, nie prawdą.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','sąd'], true),
  ('Kop w głąb siebie. Tam jest źródło dobra i będzie biło, jeśli nie przestaniesz kopać.',
   'Marek Aureliusz', 'Rozmyślania', 'pl', array['stoicyzm','wytrwałość'], true),

  ('Nie mamy zbyt mało czasu. Zbyt wiele go tracimy.',
   'Seneka', 'O krótkości życia', 'pl', array['stoicyzm','czas'], true),
  ('Nie dlatego nie próbujemy, że coś jest trudne. Trudne staje się dlatego, że nie próbujemy.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','działanie'], true),
  ('Każdy odchodzi z życia tak, jakby dopiero co do niego wszedł.',
   'Seneka', 'O krótkości życia', 'pl', array['stoicyzm','czas'], true),
  ('Zacznij żyć od zaraz i licz każdy dzień jako osobne życie.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','codzienność'], true),
  ('Cierpimy częściej w wyobraźni niż w rzeczywistości.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','lęk'], true),
  ('Póki odkładasz życie na później, ono przemija.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','zwlekanie'], true),
  ('Nikt nie jest właścicielem jutra.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','czas'], true),
  ('Szczęśliwy nie ten, kto ma dużo, lecz ten, komu wystarcza.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','umiar'], true),
  ('W wielkich sprawach powolność jest bezpieczniejsza niż pośpiech.',
   'Seneka', 'Listy moralne do Lucyliusza', 'pl', array['stoicyzm','cierpliwość'], true),
  ('Życie jest wystarczająco długie, jeśli wiesz, jak z niego korzystać.',
   'Seneka', 'O krótkości życia', 'pl', array['stoicyzm','czas'], true),

  ('Jedne rzeczy zależą od nas, inne nie. Cały spokój bierze się z rozróżnienia między nimi.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','kontrola'], true),
  ('Nie poruszają nas zdarzenia, lecz nasze sądy o nich.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','sąd'], true),
  ('Nie żądaj, by rzeczy działy się tak, jak chcesz. Chciej, by działy się tak, jak się dzieją, a będzie ci dobrze.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','akceptacja'], true),
  ('Najpierw powiedz sobie, kim chcesz być. Potem rób to, co trzeba robić.',
   'Epiktet', 'Diatryby', 'pl', array['stoicyzm','tożsamość'], true),
  ('Nie mów, jaki jesteś. Pokaż to.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','działanie'], true),
  ('Wolność nie polega na spełnianiu wszystkich pragnień, lecz na tym, by pragnąć rzeczy możliwych.',
   'Epiktet', 'Diatryby', 'pl', array['stoicyzm','wolność'], true),
  ('Dwie rzeczy warto ćwiczyć najbardziej: wytrwałość i powściągliwość.',
   'Epiktet', 'Diatryby', 'pl', array['stoicyzm','dyscyplina'], true),
  ('Człowieka rani nie obelga, lecz jego własne przekonanie, że został zraniony.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','sąd'], true),
  ('Trudność ujawnia człowieka. Gdy przychodzi próba, pamiętaj, że jesteś na treningu.',
   'Epiktet', 'Diatryby', 'pl', array['stoicyzm','przeszkody'], true),
  ('Ćwicz na drobiazgach: na rozlanej oliwie, na skradzionym winie. Dopiero potem na rzeczach większych.',
   'Epiktet', 'Encheiridion', 'pl', array['stoicyzm','ćwiczenie'], true);

-- Szablony nawyków. Opisy są własne — inspirowane książkami wskazanymi
-- w source_book, ale nie są z nich cytatami ani parafrazami zdań.

insert into public.habit_templates (
  title, description, icon, unit,
  start_value, increment_value, target_value, progression_mode,
  source_book, source_author, category, language, sort_order
)
values
  ('Dwie minuty na start',
   'Nowa rzecz zaczyna się od wersji tak małej, że nie da się jej odpuścić. Dwie minuty dziennie, dopóki samo siadanie do tego nie przestanie kosztować.',
   'timer-outline', 'minutes', 2, 1, 20, 'completion',
   'Atomic Habits', 'James Clear', 'focus', 'pl', 1),

  ('Blok głębokiej pracy',
   'Jedno okno bez powiadomień i bez przełączania się między zadaniami. Zaczynasz od pół godziny i wydłużasz dopiero wtedy, gdy uwaga przestaje uciekać.',
   'lock-closed-outline', 'minutes', 30, 5, 90, 'completion',
   'Deep Work', 'Cal Newport', 'focus', 'pl', 2),

  ('Poranne strony',
   'Trzy strony pisane ręcznie zaraz po przebudzeniu, bez planu i bez poprawiania. Nie po to, żeby powstał tekst, tylko żeby głowa się przewietrzyła.',
   'create-outline', 'pages', 3, 0, 3, 'completion',
   'The Artist''s Way', 'Julia Cameron', 'mindfulness', 'pl', 3),

  ('Przegląd tygodnia',
   'Raz w tygodniu zbierasz wszystkie luźne końce w jedno miejsce i decydujesz, co z nimi dalej. Bez tego lista zadań powoli przestaje odpowiadać rzeczywistości.',
   'calendar-outline', 'minutes', 30, 0, 60, 'completion',
   'Getting Things Done', 'David Allen', 'focus', 'pl', 4),

  ('Telefon poza sypialnią',
   'Ładowarka ląduje w innym pokoju. Ekran przed snem odsuwa zasypianie w czasie, a budzik w telefonie to najsłabszy z możliwych powodów, żeby go tam trzymać.',
   'moon-outline', 'none', 1, 0, null, 'completion',
   'Why We Sleep', 'Matthew Walker', 'health', 'pl', 5),

  ('Jedna rzecz najważniejsza',
   'Zanim otworzysz skrzynkę, wybierasz jedno zadanie, które ma się dzisiaj wydarzyć. Reszta dnia układa się wokół niego, a nie odwrotnie.',
   'flag-outline', 'count', 1, 0, 1, 'completion',
   'Essentialism', 'Greg McKeown', 'focus', 'pl', 6),

  ('Spacer bez telefonu',
   'Wyjście z domu bez słuchawek i bez ekranu. Nuda w ruchu jest jednym z niewielu stanów, w których myśli układają się same.',
   'walk-outline', 'minutes', 10, 2, 45, 'completion',
   'Digital Minimalism', 'Cal Newport', 'health', 'pl', 7),

  ('Trzy rzeczy z wczoraj',
   'Wieczorem wypisujesz trzy konkretne rzeczy z minionego dnia, za które jesteś wdzięczny. Konkret, nie ogólniki, bo inaczej po tygodniu zostaje sama rutyna.',
   'heart-outline', 'count', 3, 0, 3, 'completion',
   'The Miracle Morning', 'Hal Elrod', 'mindfulness', 'pl', 8),

  ('Strony przed snem',
   'Papierowa książka zamiast ekranu w ostatniej godzinie dnia. Zaczynasz od pięciu stron, bo do pięciu stron zawsze da się usiąść.',
   'book-outline', 'pages', 5, 1, 30, 'completion',
   'Make Time', 'Jake Knapp', 'learning', 'pl', 9),

  ('Krótki trening siłowy',
   'Kilka serii bez sprzętu, zawsze o tej samej porze i w tym samym miejscu. Stały sygnał robi tu więcej niż motywacja.',
   'barbell-outline', 'reps', 10, 2, 50, 'completion',
   'The Power of Habit', 'Charles Duhigg', 'health', 'pl', 10),

  ('Rozmowa bez ekranu',
   'Kwadrans z bliską osobą, telefony odłożone poza zasięg ręki. Słuchasz po to, żeby zrozumieć, a nie żeby przygotować odpowiedź.',
   'chatbubbles-outline', 'minutes', 15, 0, 30, 'completion',
   'The 7 Habits of Highly Effective People', 'Stephen R. Covey', 'relationships', 'pl', 11),

  ('Zdanie o tym, co poszło nie tak',
   'Jedno zdanie dziennie o potknięciu i o tym, co z niego wynika. Zapisany błąd przestaje być porażką, a zaczyna być informacją.',
   'bulb-outline', 'count', 1, 0, 1, 'completion',
   'Mindset', 'Carol S. Dweck', 'learning', 'pl', 12);
