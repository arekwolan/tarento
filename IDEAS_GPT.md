# IDEAS_GPT — audyt produktu i prompty wdrożeniowe

> Stan repozytorium: zweryfikowany 2026-08-31  
> Cel dokumentu: pomysły wynikające z analizy obecnej aplikacji, zapisane tak, aby dało się je wdrażać pojedynczo w Claude Code albo Codex.  
> Ten dokument rozwija istniejący `IDEAS.md`. Status oznacza wynik audytu kodu, tras i migracji z podanej daty; sam prompt nie jest dowodem wdrożenia. Sekcja 8 pozostaje bankiem warunkowym, nie bieżącym backlogiem.

## 1. Najkrótsza diagnoza

Tarento ma już znacznie więcej niż zwykły tracker nawyków: budżet czasu, logiczny dzień, odpoczynek bez kary, ciche tygodnie, łagodne zmniejszanie nawyku, emeryturę nawyku, ścieżki rozwoju, prognozy, dziennik i listy do przyszłego siebie. Największą przewagą produktu nie powinno więc być „więcej funkcji”, tylko wiarygodna odpowiedź na pytanie:

> Co naprawdę zmieści się w moim dzisiejszym życiu i co warto kontynuować?

Proponowane pozycjonowanie:

> **Tarento zamienia jedną ideę w mały eksperyment, który mieści się w prawdziwym dniu, sprawdza, czy działa, i sam schodzi z listy, kiedy spełnił swoją rolę.**

Skrót mechaniki produktu:

> **idea → zachowanie → dowód → korekta albo emerytura**

Punkt wyjścia technicznego jest zdrowy, ale dokument nie utrwala liczby testów,
bo szybko się dezaktualizuje. Miarodajny jest wynik bieżących poleceń
`npm run typecheck`, `npm run lint` i `npm run test` raportowany przy zmianie.
Poniższe uwagi dotyczą głównie spójności produktu i wykorzystania istniejącej
architektury, nie ratowania niestabilnej bazy kodu.

To odróżnia aplikację od:

- klasycznego trackera, który tylko liczy serie;
- planera, który dokłada zadania do kalendarza;
- aplikacji książkowej, która kończy na streszczeniu;
- czatu AI, który codziennie produkuje nowe porady.

## 2. Co już jest mocne i należy chronić

1. **Prosty ekran „Dzisiaj”.** Użytkownik powinien móc otworzyć aplikację, zobaczyć krótką listę, wykonać zadania i zamknąć aplikację.
2. **Brak karania za odpoczynek.** Dni odpoczynku, cichy tydzień, ponowne wejście i emerytura nawyku są spójne z produktem bez poczucia winy.
3. **Budżet czasu zamiast nieskończonej listy.** To jest prawdziwa przewaga, ale jej semantyka musi być identyczna na ekranie, w seriach i statystykach.
4. **Jedna aktywna ścieżka.** Ograniczenie jest lepsze od katalogu równoległych wyzwań.
5. **AI po stronie serwera i walidowane wyniki.** Należy utrzymać tę granicę; AI ma proponować, a nie samodzielnie zmieniać plan.
6. **Offline-first, RLS, soft delete, PL/EN i design tokens.** Każda nowa funkcja musi zachować te właściwości.

## 3. Zweryfikowane luki po wdrożonych etapach

### 3.1. Rytm dnia nadal można ustawić tylko w onboardingu

Model `day_templates` / `day_blocks` / `day_rotations` i komponenty edytora
istnieją, ale Ustawienia nie mają wejścia ani osobnej trasy do późniejszej
edycji. Prompt P2 pozostaje aktualny.

### 3.2. Onboarding nadal gubi wybrany obszar

`area` dociera do wyboru szablonów, ale trasa `reminders` go nie otrzymuje,
a event `onboarding_completed` zapisuje `area: null`. Przypomnienia są nadal
planowane osobno dla każdego nawyku, więc część P4 o kontrakcie copy/agregacji
również nie jest zakończona.

### 3.3. Analityka jest użyteczna, ale nie domknięta jako kontrakt prywatności

Jest typowany katalog eventów i integracja PostHog/Sentry, jednak nie ma
`ANALYTICS.md`, runtime sanitizera, deduplikacji eventów mutacji ani mechanizmu
flag opisanego w P5. Status P5 jest więc częściowy.

### 3.4. Samodzielny generator planu pozostał jako legacy

Biblioteka kieruje już do jednego przepływu intencji w `/habit/new`, lecz
`/plan` i `generate-daily-plan` pozostają dostępne dla kompatybilności. Ich
późniejsze usunięcie wymaga danych o użyciu lub jawnej decyzji produktowej;
nie jest częścią P10.

### 3.5. Dwa prompty oznaczone jako ukończone nie mają odpowiadającej funkcji

W schemacie i UI nie ma jednorazowego budżetu „Dzisiaj jest inaczej” z P6.
Kalibracja z P7 ma źródło rewizji i ręczną zmianę pory w przepływie tarcia,
ale nie ma detektora opartego na lokalnej porze `completed_at`, progów,
tłumienia ani dedykowanego Undo. Oba statusy zostały skorygowane poniżej.

## 4. Pomysł książkowy — co jest naprawdę wyróżnikiem

Sam pomysł „wybierz książkę i wygeneruj z niej plan” nie jest już unikalny. Podobne obietnice mają między innymi [TempleReads](https://apps.apple.com/us/app/templereads-ai-habit-coach/id6739692275), [DailyWins](https://dailywins.ai/), [Bukwise](https://www.bukwise.com/), [afterwords](https://www.tryafterwords.com/) i [BookShift](https://bookshift.co/). Aplikacje takie jak [Headway](https://makeheadway.com/headway-app-features/), [Shortform](https://www.shortform.com/summaries) i [Readwise](https://docs.readwise.io/readwise) już łączą wiedzę z ćwiczeniami, przypomnieniami lub powtórkami.

Możliwy wyróżnik Tarento to dopiero połączenie czterech rzeczy:

1. plan powstaje z **notatek użytkownika**, nie z samego tytułu ani nielegalnie pozyskanej treści książki;
2. plan musi zmieścić się w istniejącym **budżecie dnia** i może mieć tylko jedną aktywną praktykę naraz;
3. kolejne etapy **zastępują** wcześniejsze praktyki zamiast stale powiększać listę;
4. system sprawdza **transfer do życia**: czy zachowanie wystąpiło w prawdziwej sytuacji, a nie tylko czy użytkownik odhaczył lekcję.

Robocza nazwa funkcji: **Laboratorium książki** albo **Protokół książki**.

Przykład bez kopiowania książki:

1. Użytkownik wpisuje tytuł, autora i 3–7 idei własnymi słowami.
2. Wybiera jedną zmianę, np. „chcę odkładać telefon poza sypialnię”.
3. Tarento proponuje mały protokół: jednorazowe przygotowanie środowiska, jedną praktykę i wersję minimalną na trudny dzień.
4. Przed uruchomieniem pokazuje: co zostanie dodane, co zastąpione i ile minut zajmie.
5. Po kilku realnych okazjach pyta, czy zachowanie wystąpiło i co konkretnie przeszkodziło.
6. Na końcu tworzy prywatne „potwierdzenie wdrożenia”: co zostało w życiu, co odrzucono i dlaczego.

Nie należy budować katalogu streszczeń książek. To drogi, zatłoczony i ryzykowny prawnie kierunek, który odciąga od najmocniejszej części produktu.

## 5. Priorytety

| Kolejność | Pomysł                                              |           Wpływ | Koszt | Dlaczego teraz                                            |
| --------- | --------------------------------------------------- | --------------: | ----: | --------------------------------------------------------- |
| 0         | P0 — prawdziwy dzienny limit bez ukrytego długu     |   bardzo wysoki |     L | naprawia podstawową obietnicę produktu                    |
| 0a        | P10 — aktualizacja dokumentacji                     |          średni |     S | zapobiega błędnym decyzjom kolejnych agentów              |
| 1         | P1 — czytania i „Kontynuuj ścieżkę”                 |          wysoki |     M | odblokowuje dane i kod, które już istnieją                |
| 1a        | P8 — porządek w Bibliotece                          |   średni/wysoki |   S/M | upraszcza wejście do już istniejącej wartości             |
| 2         | P2 — edycja rytmu dnia i zmian                      |   bardzo wysoki |   M/L | realizuje podstawowy przypadek: godziny pracy użytkownika |
| 3         | P3 — uproszczenie generatora AI                     |   średni/wysoki |   S/M | usuwa duplikację i ryzyko nadprodukcji nawyków            |
| 4         | P4 — kontrakty onboardingu i powiadomień            |          średni |   S/M | szybko zwiększa zaufanie                                  |
| 5         | P5 — prywatna analityka produktu                    |          wysoki |     M | pozwala odróżnić wartość od efektownych ekranów           |
| 6         | P6 — „Dzisiaj jest inaczej”                         |          wysoki |     M | dopasowuje plan do realnego dnia                          |
| 7         | P7 — kalibracja pory nawyku                         |   średni/wysoki |     M | personalizacja z danych, bez czatu AI                     |
| 8         | B1 — fundament protokołów książkowych               |          wysoki |     L | bezpieczna baza dla funkcji książkowej                    |
| 8a        | P9 — jednorazowe przygotowanie środowiska           |   średni/wysoki |     M | przekłada ideę na zmianę warunków, nie kolejną serię      |
| 9         | B2 — Laboratorium książki z własnych notatek        |   bardzo wysoki |  L/XL | główny kandydat na wyróżnik                               |
| 10        | B3 — sprawdzian transferu i potwierdzenie wdrożenia |          wysoki |   M/L | mierzy realną zmianę, nie konsumpcję treści               |
| 11        | W1 — historia wersji zachowania                     |          wysoki |     L | wyjaśnia, co faktycznie działało                          |
| 12        | W2 — mapa tarcia                                    |          wysoki |     M | zamienia porażkę w konkretną zmianę konstrukcji           |
| 13        | W3 — instrukcja obsługi siebie                      |   bardzo wysoki |  L/XL | „wow” oparte na dowodach użytkownika                      |
| 14        | W4 — eksperyment osobisty A/B                       | eksperymentalny |     L | rzadka, mierzalna forma rozwoju osobistego                |
| 15        | W5 — radar konfliktów między ideami                 | eksperymentalny |  L/XL | wykrywa sprzeczności przed przeciążeniem planu            |

Rekomendowana kolejność wydania:

- **Etap 1 — zaufanie:** P10, P0, P1, P8, P2, P3, P4, P5.
- **Etap 2 — adaptacja:** P6, P7 i dopiero potem pomiar retencji.
- **Etap 3 — książki:** B1 jako ręcznie opracowany pilotaż, P9, potem B2 i B3.
- **Etap 4 — funkcje „wow”:** najpierw W1 i W2, ponieważ tworzą wiarygodne dane dla W3–W5.

## 6. Czego zmienić lub usunąć

### Usunąć z głównej nawigacji albo wygasić

- osobną kartę/link do `/plan`, jeśli telemetria nie pokazuje wyraźnej wartości; zostawić jedno wejście „opisz, co chcesz zmienić” w formularzu nowego nawyku;
- obietnicę „jednego powiadomienia”, dopóki silnik faktycznie nie agreguje przypomnień;
- elementy Biblioteki, które konkurują wizualnie z aktywną ścieżką; najpierw powinno być „Kontynuuj”.

### Nie budować teraz

- ogólnego czatu z coachem AI;
- katalogu streszczeń książek;
- uploadu całych książek, automatycznego scrapowania lub generowania programu wyłącznie z tytułu;
- drugiego systemu zadań dla książek — należy wykorzystać istniejący silnik ścieżek i nawyków;
- kalendarza będącego pełnym menedżerem zadań;
- publicznych rankingów, presji społecznej, odznak za serię i czerwonych stanów porażki;
- codziennych ocen nastroju jako obowiązkowego kroku;
- dodatkowych powiadomień, których użytkownik sam nie ustawił;
- wielu aktywnych ścieżek/protokołów jednocześnie;
- natywnej integracji kalendarza przed potwierdzeniem retencji rdzenia produktu.

## 7. Jak używać promptów

Każdy prompt poniżej jest przeznaczony na osobną sesję Claude Code lub Codex. Nie należy wklejać kilku naraz. Po każdym wdrożeniu warto ponownie ocenić priorytety na podstawie danych.

Wspólne zasady dla wszystkich zadań:

- najpierw przeczytaj całe `CLAUDE.md` oraz dokumentację wskazaną przez repozytorium;
- traktuj obecny kod jako źródło prawdy, a ten dokument jako specyfikację produktu;
- nie wykonuj migracji na zdalnym Supabase i nie zmieniaj danych produkcyjnych;
- nie dodawaj zależności, uprawnień natywnych ani zmian w `app.config.*` bez wyraźnej zgody;
- zachowaj offline-first, kolejkę synchronizacji, logiczny dzień, strefę czasową, RLS, soft delete, PL/EN, design tokens i dostępność;
- tekst widoczny dla użytkownika dodawaj przez i18n;
- AI działa wyłącznie po stronie serwera, jego wynik przechodzi walidację, a użytkownik widzi podgląd przed zapisem;
- nie dodawaj powiadomień innych niż jawnie ustawione przez użytkownika;
- po wdrożeniu uruchom co najmniej `npm run typecheck`, `npm run lint` i `npm run test`; po zmianach promptów również `npm run prompt:test`;
- nie naprawiaj przy okazji niepowiązanych zmian użytkownika w brudnym worktree.

---

## P0 — dzienny limit bez ukrytego długu

**Status: ✅ DONE (2026-08-28).**

**Efekt dla użytkownika:** zadanie, którego Tarento celowo nie umieściło w dzisiejszym planie, nie obniża statystyk ani nie przerywa serii.

```text
Pracujesz w repozytorium Tarento (Expo/React Native + TypeScript strict + Supabase). Przeczytaj całe CLAUDE.md, a następnie przeanalizuj implementację dziennego limitu, listy Dzisiaj, serii i statystyk. Szczególnie sprawdź app/(tabs)/index.tsx, model today-task/applyDailyCeiling, API Today, migracje funkcji statystyk i serii oraz obsługę offline.

Cel: napraw semantyczną niespójność, przez którą nawyk schowany przez dzienny limit nadal może być uznany w bazie za oczekiwany i przez to obniżyć adherence albo przerwać serię. Ukrycie przez system nie może być zapisywane jako ręczne „pominięcie” użytkownika.

Najpierw zaprojektuj jedno źródło prawdy dla dziennego planu. Preferuj trwały snapshot planu albo trwałe wykluczenia per użytkownik + data logiczna + nawyk. Rozważ tabele day_plans i day_plan_items (planned/overflow + reason + sort_order + snapshot celu) albo równoważny, prostszy model. Uzasadnij wybraną wersję w krótkiej notatce technicznej. Nie zmieniaj znaczenia istniejących logów completed/skipped.

Wymagania:
1. Ustal plan dla daty logicznej deterministycznie i idempotentnie. Wielokrotne otwarcie aplikacji nie może losowo zmieniać składu dnia.
2. Ukończone lub ręcznie pominięte zadanie pozostaje widoczne. Zadanie oznaczone jako overflow może być pokazane po „Pokaż wszystko”, ale samo ujawnienie nie tworzy długu.
3. Jeśli użytkownik wykona zadanie overflow, wykonanie liczy się pozytywnie; brak wykonania pozostaje neutralny.
4. Funkcje serii, podsumowań, heatmapy, prognoz i obserwacji mają używać tej samej definicji oczekiwanego zadania. Dla historycznych dni bez snapshotu zastosuj jawnie opisany kompatybilny fallback.
5. Zmiana limitu w środku dnia nie może anulować już wykonanych pozycji. Opisz i przetestuj regułę rekoncyliacji.
6. Uwzględnij dzień odpoczynku, quiet week, nawyki emerytowane, zmianę strefy/dnia logicznego, nawyki ścieżki i kolejkę offline.
7. Dodaj lokalną migrację SQL z indeksami, RLS, unikalnościami i komentarzami. Zaktualizuj typy Supabase zgodnie z praktyką repozytorium. Nie uruchamiaj migracji zdalnie.
8. Nie dodawaj widocznej złożoności do podstawowego widoku Dzisiaj poza istniejącym mechanizmem pokazania nadmiaru.

Testy akceptacyjne muszą obejmować co najmniej:
- 5 zaplanowanych nawyków, limit 3: dwa niewidoczne nie psują wyniku ani serii;
- ukończenie pozycji overflow daje pozytywny wpis bez tworzenia obowiązku;
- zmiana limitu 3→2 i 2→4 w tym samym dniu;
- ukończona pozycja nigdy nie znika z planu;
- odtworzenie po offline i powtórzona synchronizacja są idempotentne;
- dzień odpoczynku i quiet week są neutralne;
- granica dnia logicznego oraz zmiana strefy czasowej;
- stare daty bez snapshotu zachowują dotychczasową kompatybilność.

Dodaj krótką dokumentację semantyki „planned / overflow / completed / skipped / rest” i uruchom typecheck, lint oraz pełne testy. W raporcie końcowym podaj zmienione migracje, funkcje RPC i dokładne wyniki testów.
```

---

## P1 — czytania ścieżek i sekcja „Kontynuuj”

**Status: ✅ DONE (2026-08-28).**

**Efekt dla użytkownika:** istniejąca ścieżka przestaje być samym zestawem nawyków; użytkownik widzi aktualną ideę, krótki materiał i następny krok.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Zbadaj istniejące path_readings, usePathReadings, model etapów, app/paths/[slug].tsx, app/(tabs)/library.tsx oraz aktualny lifecycle ścieżki. Nie twórz nowego systemu treści — wykorzystaj istniejące dane i API.

Cel: udostępnij użytkownikowi czytania ścieżek oraz wyraźny punkt „Kontynuuj aktywną ścieżkę”.

Zakres:
1. W Bibliotece dodaj na samej górze sekcję „Kontynuuj”, widoczną tylko przy aktywnej ścieżce. Ma pokazywać nazwę ścieżki, bieżący etap, jedną krótką informację o postępie i przycisk prowadzący do właściwego miejsca.
2. Na ekranie szczegółów ścieżki pokaż czytania przypisane do bieżącego etapu w prawidłowej kolejności. Obsłuż wszystkie istniejące source_kind, w tym pointer bez body.
3. Dodaj dostępny ekran/czytnik materiału. Treść ma mieć komfortową szerokość, poprawne odstępy, skalowanie fontów i stany loading/error/empty/offline.
4. Pointer ma wyświetlać bezpieczną informację bibliograficzną lub wskazanie rozdziału/strony, ale nie może udawać treści, której baza nie zawiera.
5. Nie dodawaj serii czytania, osobnego obowiązku „przeczytaj”, czerwonych braków ani nowych powiadomień. Czytanie ma wspierać praktykę, nie stać się kolejnym trackerem.
6. Jeśli potrzebujesz zapamiętać ostatnio otwarty materiał lub stan przeczytania, wybierz minimalny prywatny model danych, dodaj RLS i wyjaśnij, po co ten stan jest potrzebny. Preferuj brak nowej tabeli, jeśli produkt działa bez niej.
7. Dodaj zdarzenia analityczne bez treści czytania: path_continue_opened, path_reading_opened, path_reading_finished. Nie wysyłaj tytułów prywatnych materiałów ani tekstu.
8. Wszystkie teksty dodaj w PL/EN i użyj istniejących tokenów oraz komponentów.

Kryteria akceptacji:
- aktywna ścieżka jest pierwszą rzeczą w Bibliotece;
- użytkownik otwiera czytanie bieżącego etapu maksymalnie w dwóch tapnięciach;
- materiał typu pointer działa bez body;
- ścieżka bez czytań ma sensowny stan empty, nie błąd;
- ponowne wejście offline pokazuje dane znajdujące się w cache;
- zakończona ścieżka nie jest błędnie pokazywana jako „Kontynuuj”.

Dodaj testy modelu/komponentów tam, gdzie repozytorium je stosuje, uruchom typecheck, lint i pełne testy. Nie modyfikuj treści seedów poza poprawą oczywistego błędu.
```

---

## P2 — edycja rytmu dnia, godzin pracy i rotacji

**Status: ⬜ NIEZAIMPLEMENTOWANE (audyt 2026-08-31).** Model i ekran
onboardingowy istnieją, ale w Ustawieniach nie ma wejścia ani trasy edycji.
Poniższy prompt pozostaje aktualny.

**Efekt dla użytkownika:** plan nadal pasuje po zmianie pracy, grafiku, opieki lub rytmu snu, bez ponownego onboardingu.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Przeanalizuj onboarding day-shape, src/features/day-budget, day_templates, day_blocks, day_template_days/rotations, profile day_start i useSaveDayShape. Sprawdź, które możliwości modelu danych nie mają interfejsu po onboardingu.

Cel: dodać w Ustawieniach pełną, ale prostą edycję „Mój rytm dnia”. Użytkownik ma móc ustawić godziny snu, pracę/zajętość, czas dla siebie oraz tygodniowy albo zmianowy cykl dnia.

Projekt UX:
1. W Ustawieniach dodaj wejście „Mój rytm dnia” i osobną trasę edycji, aby nie przeładować głównego ekranu ustawień.
2. Pierwszy ekran powinien obsłużyć najczęstszy przypadek: dni pracy, godziny pracy, pobudkę/sen i minuty dla siebie.
3. Dodaj opcję „Mój grafik się zmienia”. Po jej wybraniu użytkownik może zbudować cykl 1–28 dni z nazwanymi typami dnia, np. praca rano, praca nocna, wolne. Wykorzystaj istniejący model rotacji zamiast kodować tylko pon.–niedz.
4. Dla zmiany nocnej pokaż jasny podgląd, do którego dnia logicznego należą bloki. Użyj istniejących helperów czasu; nie twórz obliczeń dat ad hoc w komponentach.
5. Przed zapisem pokaż podsumowanie tygodnia/cyklu i wyliczony budżet. Jeżeli nowy budżet nie mieści obecnych nawyków, nie zmieniaj ich automatycznie: pokaż konkretny preview oraz istniejący mechanizm dopasowania/downshift.
6. Zapis wszystkich szablonów, bloków i mapowania dni ma być atomowy albo bezpiecznie idempotentny. Błąd nie może zostawić połowy grafiku.
7. Zachowaj dane offline i pokaż stan synchronizacji zgodnie z aktualnymi wzorcami aplikacji.
8. Nie proś o dostęp do kalendarza i nie dodawaj zależności.
9. Dodaj PL/EN, accessibility, skeleton/error/empty oraz design tokens.

Kryteria akceptacji:
- użytkownik zmienia standard 9–17 na 7–15 i nowy budżet jest używany przez Dzisiaj;
- może ustawić cztery dni pracy i trzy wolne;
- może utworzyć cykl 2-2-3 albo prosty cykl nocny w zakresie obsługiwanym przez bazę;
- zapis/ponowienie po utracie sieci nie duplikuje bloków;
- anulowanie edycji nie zmienia aktywnego grafiku;
- zmiana grafiku nie usuwa logów, nawyków ani historii;
- konflikt z obciążeniem pokazuje liczby „było / będzie / przekroczenie”, bez automatycznej decyzji za użytkownika.

Wydziel logikę domenową poza pliki tras, dodaj testy rotacji, północy/DST, walidacji i atomowego zapisu. Uruchom typecheck, lint i pełne testy.
```

---

## P3 — jedno wejście do sugestii AI zamiast generatora planu

**Status: ✅ DONE (2026-08-28).**

**Efekt dla użytkownika:** AI pomaga dodać jeden sensowny krok, a nie tworzy drugi, równoległy system planowania.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Porównaj app/plan.tsx, generate-daily-plan, suggest-habit, IntentSuggestions w formularzu nowego nawyku, kartę AI w Bibliotece i bieżące eventy analityczne.

Cel: uprościć produkt do jednego przepływu AI: „Powiedz, co chcesz zmienić → zobacz 1–3 małe propozycje → wybierz jedną → edytuj → zapisz”. Profil i day-budget mają dostarczać znany kontekst, więc nie pytaj ponownie o dane już zapisane.

Najpierw wykonaj read-only ocenę użycia istniejącego /plan na podstawie dostępnej telemetrii lub kodu eventów. Jeśli brak danych produkcyjnych, przyjmij bezpieczne wygaszenie powierzchni, a nie natychmiastowe usunięcie backendu.

Zakres:
1. Usuń lub ukryj kartę samodzielnego generatora z Biblioteki i skieruj jedno CTA do formularza nowego nawyku z sekcją intencji.
2. Zadbaj, aby sugestia używała po stronie serwera aktualnego budżetu, istniejących nawyków, pory dnia i aktywnej ścieżki. Klient wysyła tylko minimalny niezbędny kontekst; żadnych sekretów.
3. Odpowiedź ma być propozycją, nigdy automatycznym zapisem. Każda pozycja pokazuje minuty, częstotliwość, porę i wersję minimalną, a użytkownik może wszystko edytować.
4. Domyślnie pozwól zaakceptować tylko jedną propozycję. Jeśli dodanie jej przekracza budżet, uruchom istniejący preview dopasowania zamiast tworzyć przeciążenie.
5. Nie usuwaj od razu generate-daily-plan, jeżeli mogłoby to zepsuć starszego klienta. Oznacz deprecację, usuń nowe wejścia, dodaj telemetryczny event legacy_plan_opened i opisz warunek późniejszego usunięcia.
6. Uporządkuj i18n, błędy, retry, rate limiting i dostępność.
7. Jeśli zmieniasz prompt/schema, zaktualizuj fixtures i uruchom prompt:test.

Kryteria akceptacji:
- w produkcie istnieje jedno oczywiste wejście do pomocy AI przy tworzeniu nawyku;
- AI nie pyta ponownie o zapisane minuty ani godziny pracy;
- żadna sugestia nie tworzy nawyku bez podglądu i potwierdzenia;
- przekroczenie budżetu pokazuje różnicę i dostępne decyzje;
- stary deep link /plan nie kończy się białym ekranem;
- zdarzenia pozwalają policzyć: rozpoczęcie → sukces odpowiedzi → wybór → zapis → odrzucenie.

Uruchom typecheck, lint, testy i — jeśli dotknięto promptów — prompt:test. W podsumowaniu osobno wypisz to, co usunięto z UI, oraz to, co pozostało czasowo dla kompatybilności.
```

---

## P4 — naprawa onboardingu i agregacja przypomnień

**Status: ⚠️ CZĘŚCIOWO (audyt 2026-08-31).** Rekoncyliacja przypomnień
istnieje, ale `area` kończy jako `null`, szkic nie obejmuje całego onboardingu,
a przypomnienia o tej samej porze nie są agregowane. Poniższy prompt pozostaje
aktualny dla brakującego zakresu.

**Efekt dla użytkownika:** onboarding nie obiecuje czegoś innego niż później robi aplikacja, a kilka nawyków o tej samej porze nie zasypuje powiadomieniami.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Prześledź stan od app/(onboarding)/index.tsx przez area, day-shape, habits i reminders aż do complete_onboarding oraz analytics. Następnie przeanalizuj planowanie powiadomień per habit i teksty mówiące o liczbie przypomnień.

Cel: naprawić utratę danych onboardingu i zapewnić prawdziwą, przewidywalną politykę powiadomień.

Zakres:
1. Zachowaj wybrany obszar rozwoju przez cały onboarding, użyj go do rozsądnych domyślnych propozycji i przekaż do eventu onboarding_completed. Nie zapisuj wartości zawsze jako null.
2. Odświeżenie aplikacji lub cofnięcie ekranu nie może zgubić dotychczasowego szkicu. Użyj istniejącego mechanizmu stanu/persistencji bez dokładania ciężkiej biblioteki.
3. Zdecyduj na podstawie obecnej architektury, czy przypomnienia o tej samej minucie mają być agregowane. Preferowana reguła: na urządzeniu użytkownika wszystkie aktywne zadania z tym samym logicznym czasem tworzą jedno powiadomienie zbiorcze prowadzące do Dzisiaj.
4. Jeśli agregacja jest niemożliwa bez nadmiernego ryzyka, zmień copy na całkowicie zgodne z rzeczywistością. Nie pozostawiaj obietnicy „jedno”, jeśli będą trzy.
5. Rekoncyliacja powiadomień musi usuwać stare identyfikatory po edycji, emeryturze, quiet week i wyłączeniu zgody, bez duplikatów po restarcie.
6. Treść zbiorcza nie może ujawniać prywatnych nazw na zablokowanym ekranie ponad to, co użytkownik już wybrał w ustawieniach prywatności. Jeżeli brak takiego ustawienia, użyj neutralnego copy.
7. Nie dodawaj żadnego nowego typu powiadomienia ani prośby o zgodę wcześniej niż obecny etap.
8. Dodaj PL/EN oraz eventy: onboarding_area_selected, reminder_bundle_scheduled (tylko count/band, bez nazw).

Testy akceptacyjne:
- wybrany area dociera do końca i analityki;
- kill/restart na każdym kroku nie zeruje poprawnego szkicu;
- trzy nawyki na 08:00 dają jedno powiadomienie, jeśli wdrożono agregację;
- 08:00 i 18:00 dają dwa osobne przypomnienia;
- edycja, emerytura, quiet week i wyłączenie przypomnień rekoncyliują plan bez duplikatów;
- brak uprawnienia ma spokojny stan i nie blokuje zakończenia onboardingu.

Uruchom typecheck, lint i pełne testy. Nie zmieniaj natywnych uprawnień ani app.config bez osobnej zgody.
```

---

## P5 — prywatna analityka wartości i flagi funkcji

**Status: ⚠️ CZĘŚCIOWO (audyt 2026-08-31).** Jest typowany katalog eventów
i integracja telemetryczna, ale brakuje `ANALYTICS.md`, runtime sanitizera,
deduplikacji mutacji i bezpiecznych flag. Poniższy prompt pozostaje aktualny
dla brakującego zakresu.

**Efekt dla zespołu:** wiadomo, które funkcje zmieniają zachowanie użytkownika, bez zbierania jego intymnych treści.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md i przeanalizuj src/features/analytics, obecną usługę telemetryczną, politykę prywatności oraz eventy onboarding/habit/streak/day-complete. Nie podłączaj nowego dostawcy analityki bez zgody.

Cel: stworzyć mały, prywatny katalog eventów i mierzalne lejki przed dalszym rozbudowywaniem produktu.

Zaimplementuj:
1. Typowany katalog eventów dla ścieżek: path_catalog_viewed, path_detail_viewed, path_started, path_fit_previewed, path_stage_advanced, path_ended, path_reentered.
2. Eventy dla czytań, edycji day-shape, dziennego override, AI suggestion i protokołów książkowych, jeśli dana funkcja już istnieje. Nie dodawaj martwych eventów wywoływanych nigdzie.
3. Wspólne dozwolone właściwości: anonymous/user id zgodnie z obecną polityką, locale, platforma, wersja aplikacji, source enum, count, duration bucket, result enum. Zakazane: nazwa nawyku, treść notatki, tytuł prywatnej książki, prompt, cytat, body czytania, dokładne godziny pracy.
4. Runtime sanitizer albo typy uniemożliwiające przypadkowe wysłanie tekstu dowolnego. W dev/test błąd ma być widoczny; w produkcji payload ma zostać odrzucony bez awarii UI.
5. Stabilne event_id i zabezpieczenie przed podwójnym wysłaniem przy offline retry tam, gdzie event jest wynikiem mutacji.
6. Minimalny mechanizm feature flags wykorzystujący istniejącą konfigurację/backend, jeśli jest dostępny. Bez nowego SDK. Flaga ma mieć bezpieczny default i nie może wpływać na integralność danych.
7. Dokument ANALYTICS.md z definicją: event, moment wysłania, pola, zakazane dane i metryka, której służy.

Zaproponuj i umożliw policzenie czterech metryk:
- activation: ukończony onboarding + pierwszy własny nawyk + realizacje w co najmniej trzech różnych dniach;
- useful week: dobrowolny powrót w co najmniej trzech dniach, bez ukrytego długu overflow;
- path transfer: rozpoczęty etap → praktyka w realnych dniach → świadome przejście dalej;
- suggestion quality: pokazana sugestia → zaakceptowana → nadal aktywna po 14 dniach albo świadomie emerytowana.

Nie twórz dashboardu, jeśli repo nie ma infrastruktury. Celem jest poprawne i udokumentowane źródło danych. Dodaj testy katalogu, sanitizera i deduplikacji; uruchom typecheck, lint i pełne testy.
```

---

## P6 — „Dzisiaj jest inaczej” jako jednorazowy budżet

**Status: ⬜ NIEZAIMPLEMENTOWANE (audyt 2026-08-31).** Nie ma modelu override
dla pojedynczej `plan_date` ani odpowiadającego mu UI. Poniższy prompt jest
gotowy do użycia po decyzji o priorytecie.

**Zależność:** wdrażaj po P0.

**Efekt dla użytkownika:** bez zmiany całego grafiku może powiedzieć, że dziś ma mniej lub więcej przestrzeni.

```text
Pracujesz w repozytorium Tarento po wdrożeniu trwałej semantyki dziennego planu. Przeczytaj całe CLAUDE.md, implementację day-budget, rest days, daily ceiling, plan snapshot/overflow oraz ekran Dzisiaj.

Cel: dodać spokojną akcję „Dzisiaj jest inaczej”, która zmienia wyłącznie pojemność bieżącej daty logicznej.

UX:
1. Akcja ma być drugorzędna, dostępna z nagłówka/podsumowania Dzisiaj, a nie jako modal przy każdym otwarciu.
2. Opcje: „jak zwykle”, 5, 10, 15, 30 minut oraz wartość niestandardowa w bezpiecznym zakresie. Zero minut powinno wyraźnie kierować do istniejącego dnia odpoczynku, zamiast tworzyć drugi typ zera.
3. Przed zapisem pokaż: planowanych było X min / N pozycji, po zmianie będzie Y min / M pozycji. Pokaż, które pozycje przejdą do overflow; niczego nie kasuj ani nie oznaczaj skipped.
4. Zmiana obowiązuje tylko dla bieżącej daty logicznej i wygasa automatycznie. Ma mieć „Cofnij” oraz powrót do wartości profilu.
5. Ukończone zadania pozostają w planie nawet po obniżeniu budżetu. Podwyższenie może odsłonić kolejne pozycje według stabilnej reguły P0.
6. Zapis i undo działają offline oraz są idempotentne.
7. Nie wysyłaj przypomnienia sugerującego zmianę budżetu i nie pytaj o powód.

Model danych powinien rozróżniać stały budżet profilu od override dla konkretnej plan_date. Dodaj RLS, indeks, unique(user_id, plan_date), soft-delete/clear zgodnie z konwencją repo. Użyj logicznej daty z helperów.

Testy: mniej czasu, więcej czasu, zero→rest day, cofnięcie, ukończone pozycje, overflow neutralny dla statystyk, północ logiczna, DST, offline retry i konflikt dwóch urządzeń. Dodaj PL/EN i eventy bez podawania dokładnej godziny pracy. Uruchom typecheck, lint i pełne testy.
```

---

## P7 — kalibracja pory z realnych wykonań

**Status: ⚠️ CZĘŚCIOWO (audyt 2026-08-31).** Historia rewizji rozpoznaje
`calibration/time_calibration`, a mapa tarcia pozwala ręcznie zmienić porę.
Brakuje detektora z `completed_at`, progów jakości, tłumienia i dedykowanego
Undo. Poniższy prompt pozostaje aktualny dla tego zakresu.

**Efekt dla użytkownika:** aplikacja zauważa, że nawyk konsekwentnie wykonywany jest o innej porze, i proponuje jedną konkretną poprawkę.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Zbadaj habit_logs.completed_at, timezone/logical day, day bands, harmonogram nawyku, przypomnienia, statystyki oraz możliwość cofania mutacji.

Cel: wdrożyć deterministyczną „kalibrację pory” bez AI i bez śledzenia lokalizacji. Przykład: „Czytanie planujesz rano, ale 7 z ostatnich 9 wykonań było wieczorem. Przenieść na wieczór?”

Reguły domenowe:
1. Nie pokazuj sugestii przed minimalną liczbą wiarygodnych próbek; zaproponuj i zakoduj rozsądny próg, np. co najmniej 7 wykonań w 14–28 dniach i co najmniej 70% w tym samym alternatywnym paśmie.
2. Licz lokalną porę wykonania w strefie obowiązującej dla danych zgodnie z helperami repo. Obsłuż północ logiczną i DST.
3. Nie używaj danych wpisanych zbiorczo długo po fakcie, jeśli system nie potrafi wiarygodnie ustalić faktycznej pory. Opisz regułę jakości próbki.
4. Sugestia pojawia się najwyżej raz na określony okres i tylko dla jednego nawyku naraz. Odrzucenie ją wycisza; nie wraca następnego dnia.
5. CTA pokazuje dokładną zmianę. Akceptacja aktualizuje timeOfDay i opcjonalne przypomnienie wyłącznie po osobnym, jawnym potwierdzeniu. Nie włączaj powiadomienia, jeśli było wyłączone.
6. Po zmianie pokaż Undo. Zapisz pochodzenie zmiany jako calibration, aby później mogła wejść do historii wersji zachowania.
7. Nie formułuj wniosku jako prawdy psychologicznej. Używaj języka obserwacji: „ostatnio częściej…”.

Umieść sugestię poza główną listą checkboxów, np. jako pojedynczą spokojną kartę po zadaniach albo w szczegółach nawyku. Dodaj testy progu, tłumienia, timezone/DST, undo, reminder opt-in i braku sugestii przy słabych danych. Dodaj PL/EN, dostępność oraz prywatne eventy suggestion_shown/accepted/dismissed. Uruchom typecheck, lint i pełne testy.
```

---

## B1 — fundament „Protokołów książkowych” na istniejących ścieżkach

**Status: ✅ DONE (2026-08-28).**

**Efekt dla użytkownika:** książka prowadzi do jednego małego działania, nie do kolejnej listy treści do skonsumowania.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Przeanalizuj paths, path_stages, path_practices, path_readings, user_paths, lifecycle etapów, source_book/source_author na nawykach i szablonach oraz RLS. Nie buduj osobnego trackera książek.

Cel: rozszerzyć istniejące ścieżki tak, aby mogły bezpiecznie reprezentować ręcznie opracowane, kuratorowane „Protokoły książkowe”. Pierwsze wydanie ma mieć jeden protokół przygotowany ręcznie, bez generowania AI i bez kopiowania chronionej treści.

Model produktu:
1. Protokół ma jawne pola provenance: typ źródła, tytuł, autor, opcjonalne wydanie/identyfikator, informacja „opracowanie Tarento”, status review i disclaimer.
2. path_readings typu pointer wskazuje rozdział/sekcję/stronę, ale nie przechowuje tekstu książki. Własne objaśnienia Tarento mają być krótkie, oryginalne i oddzielone od cytatu.
3. Cytat, jeśli w ogóle występuje, musi mieć osobne pole, źródło i konserwatywny limit długości. Preferuj brak cytatów w MVP.
4. Protokół składa się maksymalnie z 3 etapów. Każdy etap wprowadza najwyżej jedną nową praktykę powtarzalną; może też zawierać jednorazowe przygotowanie środowiska. Przejście etapu ma zastępować/wycofywać poprzednią praktykę zgodnie z istniejącym lifecycle.
5. Przed startem pokaż preview: dodawane praktyki, praktyki wycofywane, minuty, częstotliwość i wpływ na budżet. Jedna aktywna ścieżka pozostaje twardą regułą.
6. Nawyki z protokołu zachowują source_book/source_author i odnośnik do origin path.
7. Katalog odróżnia „Ścieżki Tarento” i „Z książek”, ale aktywna ścieżka pozostaje jednym wspólnym pojęciem.
8. Nie dodawaj wyszukiwarki publicznego katalogu, ocen, komentarzy ani uploadu książki.

Technicznie:
- rozszerz istniejący model najmniejszą kompatybilną migracją;
- dodaj CHECK, indeksy, RLS i bezpieczne polityki dla child tables;
- zachowaj kompatybilność obecnych ścieżek i seedów;
- dodaj komponent provenance i czytania/pointer zgodne z P1;
- dodaj kompletne PL/EN;
- dodaj testy lifecycle, budżetu, provenance, RLS i wstecznej zgodności.

Jako dane demonstracyjne przygotuj wyłącznie neutralny, autorski protokół testowy lub fixture. Nie twórz szczegółowego komercyjnego programu na podstawie konkretnej chronionej książki bez osobnej decyzji redakcyjnej/prawnej. Uruchom typecheck, lint i pełne testy.
```

---

## B2 — Laboratorium książki: własne notatki → prywatny protokół

**Status: ✅ DONE (2026-08-29).**

**Zależność:** B1 oraz stabilny P0/P2.

**Efekt dla użytkownika:** może zamienić własne wnioski z dowolnej książki w mały plan dopasowany do swojego życia.

```text
Pracujesz w repozytorium Tarento po wdrożeniu kuratorowanych protokołów książkowych. Przeczytaj całe CLAUDE.md, wszystkie zasady AI/promptów, schemat paths i RLS, aktywny path lifecycle, day-budget, path-fit oraz source_book/source_author. Nie twórz drugiego silnika planów.

Cel: dodać „Laboratorium książki”, które tworzy prywatny draft protokołu wyłącznie z notatek użytkownika. AI nie ma znać ani odtwarzać całej książki i nie może generować programu na podstawie samego tytułu.

Przepływ:
1. Użytkownik wpisuje tytuł i autora wyłącznie jako prywatne metadane.
2. Musi podać jedną pożądaną zmianę zachowania oraz 3–7 idei własnymi słowami. Każda idea może mieć opcjonalny pointer „rozdział/strona”, ale nie upload pliku.
3. Formularz przypomina: „Nie wklejaj całych rozdziałów ani długich fragmentów”. Dodaj rozsądne limity znaków po stronie klienta i serwera.
4. Serwer otrzymuje wyłącznie te notatki oraz niezbędny kontekst strukturalny: dostępny budżet, pasma dnia, istniejące nawyki i aktywna ścieżka. Nie wysyłaj niepotrzebnego dziennika, listów ani nazw innych prywatnych nawyków, jeśli wystarczą kategorie/minuty.
5. AI zwraca walidowany draft: maksymalnie 3 etapy, jedna praktyka powtarzalna na etap, jedno opcjonalne przygotowanie środowiska, wersja minimalna na trudny dzień, kryterium przejścia i wskazanie, z której notatki wynika każdy element.
6. Łączny koszt aktywnego etapu ma mieścić się w bezpiecznej części wolnego budżetu, np. maksymalnie 60%; liczba i próg mają być stałymi domenowymi, nie magicznymi wartościami w UI.
7. Pokaż ekran diff przed zapisem: DODA / ZASTĄPI / NIE ZMIEŚCI SIĘ, liczba minut i kolizje pasma. Użytkownik może edytować albo odrzucić każdy element. AI nigdy nie aktywuje ścieżki automatycznie.
8. Po zatwierdzeniu zapisz draft jako prywatną ścieżkę właściciela i użyj istniejącego lifecycle. Rozważ owner_id + origin_kind/private w paths albo równoważny model, ale katalog publiczny musi zawsze filtrować tylko opublikowane rekordy. Child-table RLS ma dziedziczyć dostęp przez rodzica.
9. Po rozpoczęciu używana wersja protokołu jest stabilna. Edycja treści tworzy nową wersję/draft, nie zmienia historii aktywnej ścieżki pod spodem.
10. Użytkownik może usunąć prywatne notatki i protokół zgodnie z polityką soft delete/export. Żaden prywatny tytuł ani tekst nie trafia do analityki.

Bezpieczeństwo AI:
- Edge Function po stronie serwera, uwierzytelnienie, rate limit, timeout, retry zgodny z repo;
- ścisły schema validator, wersja promptu, fixture/regression tests;
- obrona przed instrukcjami w notatkach: notatki są danymi, nie poleceniami systemowymi;
- brak porad medycznych/terapeutycznych/finansowych i jasny fallback;
- brak sugestii usunięcia odpoczynku, snu lub omijania limitów;
- brak długich podobnych do źródła fragmentów w odpowiedzi.

Kryteria akceptacji:
- sam tytuł bez notatek nie uruchamia generowania;
- notatki jednego użytkownika są niemożliwe do odczytu przez drugiego;
- prywatny protokół nie pojawia się w katalogu innej osoby;
- aktywacja nie omija reguły jednej ścieżki i path-fit;
- wynik nie mieszczący się w budżecie nie może być zapisany jako przeciążający bez świadomej korekty;
- powtórzony request nie duplikuje ścieżki;
- export/delete obejmuje nowe dane;
- offline ma uczciwy stan: szkic lokalny może przetrwać, generowanie wymaga sieci.

Zaktualizuj i18n, dokumentację danych/AI i testy RLS, schematu, prompt injection, idempotencji oraz całego happy path. Uruchom typecheck, lint, pełne testy i prompt:test. Nie uruchamiaj migracji zdalnie.
```

---

## B3 — sprawdzian transferu i „potwierdzenie wdrożenia”

**Status: ✅ DONE (2026-08-29).**

**Efekt dla użytkownika:** aplikacja nie gratuluje za przeczytanie; pokazuje, czy idea faktycznie pojawiła się w życiu.

```text
Pracujesz w repozytorium Tarento z działającymi ścieżkami/protokołami. Przeczytaj całe CLAUDE.md, lifecycle etapów, logi nawyków, day notes, statystyki i zakończenie ścieżki.

Cel: dodać lekki „sprawdzian transferu” na końcu etapu oraz prywatne podsumowanie zakończonego protokołu. To nie jest quiz z treści książki ani kolejny dzienny obowiązek.

Przepływ:
1. Gdy użytkownik sam wybiera przejście dalej, pokaż jedno pytanie: „Czy ta praktyka pojawiła się w realnej sytuacji, w której miała pomóc?”. Odpowiedzi: „tak”, „jeszcze nie”, „nie było okazji”.
2. Opcjonalnie pozwól dodać jedno krótkie zdanie dowodu/przykładu. Nie wymagaj tekstu i nie używaj go do analityki.
3. „Jeszcze nie” nie karze i nie blokuje. Zaproponuj trzy neutralne decyzje: zostań na etapie, zmniejsz praktykę przy użyciu istniejącego downshift albo przejdź dalej świadomie.
4. „Nie było okazji” nie liczy się jako niepowodzenie i może zasugerować przedłużenie etapu bez serii.
5. Po zakończeniu protokołu utwórz prywatne „Potwierdzenie wdrożenia”: źródło, ukończone etapy, praktyki zachowane, praktyki emerytowane, odpowiedzi transferu i jedno zdanie użytkownika. Bez odznaki, rankingu i automatycznego share.
6. Podsumowanie ma odróżniać „wykonano często” od „zgłoszono transfer”; nie wyciągaj z korelacji wniosku o przyczynowości.
7. Użytkownik może usunąć swoje odpowiedzi i ująć je w eksporcie.

Model danych ma być append-only dla odpowiedzi historycznej lub zachowywać audyt zmian, z RLS i indeksami po user_path/stage. Eventy analityczne mogą zawierać tylko enum odpowiedzi i identyfikator typu protokołu, nigdy notatkę ani prywatny tytuł.

Testy: wszystkie trzy odpowiedzi, przejście mimo „jeszcze nie”, downshift, brak okazji, ponowne wejście, zakończenie/porzucenie ścieżki, export/delete, RLS i offline retry. Dodaj PL/EN, dostępność i uruchom typecheck, lint oraz pełne testy.
```

---

## W1 — historia wersji zachowania („behavioral version control”)

**Status: ✅ DONE (2026-08-29).**

**Dlaczego może dać efekt wow:** większość trackerów pokazuje serię. Tarento może pokazać, która wersja nawyku działała w jakich warunkach i pozwolić wrócić do niej jednym kliknięciem.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Zmapuj wszystkie miejsca zmieniające nawyk: formularz edycji, downshift, path stage/lifecycle, reentry, retirement/restore, kalibracja pory i ewentualny day-fit. Zbadaj optimistic updates i kolejkę offline.

Cel: zbudować append-only historię wersji nawyku, bez zmiany prostoty listy Dzisiaj.

Wymagania:
1. Dodaj habit_revisions lub równoważny model. Każda trwała zmiana domenowa zapisuje before/after snapshot najważniejszych parametrów, source enum (user, downshift, path, calibration, reentry, restore), reason enum, logical effective date i idempotency key.
2. Mutacja nawyku i zapis rewizji muszą być atomowe po stronie bazy/RPC albo mieć mechanizm gwarantujący brak cichej utraty historii.
3. Nie zapisuj sekretów, promptów AI ani zbędnego tekstu. Jeśli nazwa nawyku jest w snapshotcie, obejmij ją RLS/export/delete tak jak sam nawyk.
4. W szczegółach nawyku dodaj „Historia zmian”: czytelny timeline typu „5 min → 2 min, powód: trudny okres”, nie surowy JSON.
5. Pozwól przywrócić wcześniejsze ustawienia przez preview diff. Przywrócenie samo tworzy nową rewizję; nigdy nie kasuje historii.
6. Konflikt z obecnym budżetem lub aktywną ścieżką musi przejść przez path-fit/budget preview. Rollback nie może ominąć ograniczeń.
7. Zmiana samego logu ukończenia nie jest rewizją definicji nawyku.
8. Dodaj migrację wypełniającą bezpieczny „initial snapshot” tylko tam, gdzie to potrzebne; nie wymyślaj historycznych zmian.

Opcjonalny widok wartości: dla kolejnych wersji pokaż wyłącznie opisową obserwację przy wystarczającej liczbie porównywalnych okazji, np. „wersja 2 min była wykonywana częściej niż 10 min”. Nie deklaruj przyczynowości i nie porównuj okresów o różnych harmonogramach bez normalizacji.

Testy: każda ścieżka mutacji tworzy dokładnie jedną rewizję, retry nie duplikuje, rollback tworzy nową rewizję, RLS izoluje użytkowników, export/delete, offline conflict i budżet. Dodaj PL/EN i uruchom typecheck, lint oraz pełne testy.
```

---

## W2 — mapa tarcia zamiast poczucia winy

**Status: ✅ DONE (2026-08-29).**

**Dlaczego może dać efekt wow:** po kilku podobnych trudnościach aplikacja nie mówi „postaraj się”, tylko proponuje jedną zmianę konstrukcji nawyku.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Przeanalizuj semantykę skipped, TaskDetailsSheet, downshift, edycję pory, quiet week, day notes i statystyki. Nie zamieniaj odhaczania zadania w obowiązkową ankietę.

Cel: dodać opcjonalną, strukturalną „mapę tarcia”. Po ręcznym pominięciu albo w szczegółach użytkownik może jednym tapnięciem wskazać przeszkodę, a po powtarzalnym wzorcu dostać jedną konkretną propozycję zmiany.

Kategorie MVP:
- zapomniałem;
- nie miałem czasu;
- krok był za duży;
- zła pora;
- brakowało przygotowania/środowiska;
- dziś nie pasowało (bez diagnozy).

Wymagania:
1. Powód jest zawsze opcjonalny. Zamknięcie arkusza nie blokuje statusu skipped.
2. Domyślnie nie zbieraj free text. Jeśli istnieje „inne”, zapisuj tylko enum other albo pozwól pominąć.
3. Przechowuj zdarzenie per habit + logical date, z RLS, idempotencją i możliwością usunięcia/exportu.
4. Po co najmniej 3 powtórzeniach jednego powodu w odpowiednim oknie pokaż najwyżej jedną sugestię:
   - brak czasu / za duży → istniejący downshift;
   - zła pora → preview zmiany pasma;
   - zapomniałem → opcjonalny preview przypomnienia, ale nigdy automatyczne włączenie;
   - środowisko → jednorazowy krok przygotowania, nie nowy stały tracker;
   - dziś nie pasowało → informacja o day override/rest, bez presji.
5. Sugestia musi wynikać z jawnej reguły, nie z AI. Pokaż obserwację i dokładne liczby bez osądu.
6. Odrzucenie wycisza sugestię na ustalony okres. Jednocześnie widoczna jest najwyżej jedna karta tarcia.
7. Nie pokazuj czerwieni, score psychologicznego ani etykiet „brak dyscypliny”.

Testy: opcjonalność, każdy enum, próg 3, brak duplikatów, suppression, poprawny routing do istniejących preview, przypomnienie wymaga opt-in, logical day/timezone, offline retry, RLS/export/delete. Dodaj PL/EN, accessibility i prywatne eventy tylko z enumem. Uruchom typecheck, lint i pełne testy.
```

---

## W3 — prywatna „Instrukcja obsługi siebie”

**Status: ✅ DONE (2026-08-29).**

**Zależność:** najlepiej po W1 i W2, gdy system ma wiarygodną historię zmian i tarcia.

**Dlaczego może dać efekt wow:** zamiast ogólnych porad użytkownik buduje własny, audytowalny zbiór zasad popartych jego historią.

```text
Pracujesz w repozytorium Tarento po wdrożeniu historii rewizji i mapy tarcia. Przeczytaj całe CLAUDE.md. Zbadaj statystyki, obserwacje, completion logs, day shape, revisions, friction events, path transfers i prywatność.

Cel: zbudować „Instrukcję obsługi siebie” — prywatny zbiór hipotez/reguł, które użytkownik akceptuje na podstawie własnych danych. To nie jest profil osobowości, diagnoza ani czat AI.

Przykładowa reguła:
„Krótkie czytanie po kolacji działało częściej niż czytanie rano: 8/11 vs 2/7 porównywalnych okazji. Potraktuj to jako wskazówkę, nie pewnik.”

Wymagania:
1. Silnik kandydatów jest deterministyczny w MVP. Generuj tylko reguły z zamkniętego katalogu wzorców: pora dnia, rozmiar celu, typ dnia, powtarzalne tarcie, działanie wersji minimalnej i wyniki przed/po rewizji.
2. Ustal minimalne próbki i nie pokazuj reguły przy słabych danych. Pokaż licznik prób, zakres dat i ostrożny język; bez procentów przy bardzo małym N.
3. Każda reguła ma status candidate/accepted/rejected/expired, wersję algorytmu, evidence snapshot i datę ponownej oceny.
4. Użytkownik musi zaakceptować regułę. Kandydat nie wpływa automatycznie na plan.
5. Zaakceptowana reguła może być użyta jako jawny kontekst w preview nowego nawyku/protokołu: „Uwzględniono Twoją regułę: wieczór”. Zawsze można ją wyłączyć.
6. Jeśli nowe dane przeczą regule, oznacz ją „do ponownego sprawdzenia”, nie nadpisuj historii.
7. Nie generuj cech typu leniwy, nocny marek, ADHD, wypalenie ani żadnej diagnozy. Nie wyciągaj wniosków z treści dziennika/listów.
8. Dane i dowody są prywatne, objęte RLS, export/delete. Do analityki trafia najwyżej typ reguły i akcja, bez wartości ani nazw nawyków.
9. Widok ma być poza Dzisiaj, np. w Statystykach lub Bibliotece. Na Dzisiaj pokaż co najwyżej jedną istotną propozycję i tylko po działaniu użytkownika.

Dodaj dokumentację statystycznych ograniczeń i testy minimalnych prób, porównywalności okazji, rewaluacji, akceptacji/odrzucenia, RLS, export/delete oraz niewpływania niezaakceptowanej reguły na plan. Uruchom typecheck, lint i pełne testy.
```

---

## W4 — osobisty eksperyment A/B bez udawania nauki

**Status: ✅ DONE (2026-08-30).**

**Dlaczego może dać efekt wow:** użytkownik może sprawdzić na sobie „2 min rano czy 5 min wieczorem?”, zamiast wierzyć ogólnej poradzie.

```text
Pracujesz w repozytorium Tarento po wdrożeniu habit revisions i poprawnej semantyki oczekiwanych okazji. Przeczytaj całe CLAUDE.md, statystyki, logical day, day shapes, revisions, reminders i offline sync.

Cel: stworzyć mały moduł osobistego eksperymentu dla jednego istniejącego nawyku. MVP porównuje jedną zmienną w dwóch kolejnych blokach czasowych; nie randomizuj codziennie i nie formułuj wniosków przyczynowych.

Przepływ:
1. Użytkownik wybiera hipotezę z zamkniętej listy: pora A/B albo rozmiar celu A/B. Nie pozwalaj jednocześnie zmieniać kilku parametrów.
2. System pokazuje plan dwóch bloków, np. 7 porównywalnych okazji A i 7 B. Dni odpoczynku, quiet week i overflow nie liczą się jako okazje.
3. Start tworzy zaplanowane rewizje albo bezpieczny harmonogram zmian. Użytkownik zawsze może przerwać, a pierwotna konfiguracja jest zachowana.
4. Przed zmianą przypomnienia pytaj jawnie; nie włączaj go automatycznie.
5. Wynik pokazuje liczby wykonane/oczekiwane, różnicę opisową i ograniczenia: kolejność bloków, mała próbka, inne warunki. Copy: „W tym eksperymencie B pasowało częściej”, nigdy „B powoduje sukces”.
6. Na końcu użytkownik wybiera A, B albo wcześniejsze ustawienie. Decyzja tworzy normalną rewizję.
7. Jednocześnie może działać najwyżej jeden eksperyment. Nie uruchamiaj go podczas quiet week, bez wystarczających zaplanowanych okazji lub gdy ścieżka ma zaraz automatycznie zmienić ten sam nawyk.
8. Moduł nie może zajmować miejsca na głównej liście zadań; pokaż mały status w szczegółach nawyku.

Dodaj model danych z RLS, idempotencją, stanami draft/active/paused/completed/cancelled i snapshotem konfiguracji. Testy: pełny przebieg, przerwanie, odpoczynek/overflow, DST, konflikt ze ścieżką, reminder opt-in, mała próbka, offline retry i wybór zwycięskiej wersji. Dodaj PL/EN i uruchom typecheck, lint oraz pełne testy.
```

---

## W5 — radar konfliktów między ideami i książkami

**Status: ✅ DONE (2026-08-30).**

**Zależność:** B2 oraz stabilny budżet/wersjonowanie.

**Dlaczego może dać efekt wow:** zanim kolejna dobra rada przeciąży dzień, aplikacja pokazuje, z czym się zderza i każe wybrać kontekst.

```text
Pracujesz w repozytorium Tarento z prywatnymi protokołami książkowymi. Przeczytaj całe CLAUDE.md, schema prywatnych notes/protocols, day-budget, active path, path-fit, habit revisions i zasady AI. Funkcja nie może analizować całej książki ani danych innych użytkowników.

Cel: przed uruchomieniem nowego protokołu wykryć trzy typy konfliktu:
1. pojemność — brak minut w danym typie dnia/paśmie;
2. wykonanie — dwie praktyki wymagają tego samego ograniczonego momentu lub środowiska;
3. reguła — dwie notatki użytkownika sugerują przeciwne działania w podobnym kontekście.

Wymagania:
1. Pojemność i kolizje harmonogramu wykrywaj deterministycznie bez AI.
2. Konflikt semantyczny może użyć serwerowego AI tylko na krótkich notatkach użytkownika. Ścisły schema ma zwracać parę note_id, krótki neutralny opis i confidence enum; nie może rozstrzygać, która książka „ma rację”.
3. UI pokazuje diff przed aktywacją: DODA / USUNIE / ZASTĄPI / KOLIZJA. Dla konfliktu pyta: „W jakiej sytuacji obowiązuje A, a w jakiej B?” i pozwala ustawić prosty kontekst z zamkniętej listy typów dnia/pór.
4. Brak odpowiedzi nie blokuje zapisania draftu, ale blokuje automatyczne aktywowanie sprzecznych praktyk naraz. Użytkownik może odrzucić jedną z nich.
5. Jedna aktywna ścieżka nadal obowiązuje. Funkcja nie może stać się pretekstem do wielu równoległych programów.
6. Do analityki nie wysyłaj tekstu, tytułu ani par notatek; tylko typ konfliktu i decyzję enum.
7. Dodaj prompt-injection tests, ponieważ notatki są niezaufanymi danymi. Wynik AI jest sugestią, nie mutacją.

Kryteria akceptacji: poprawne kolizje minut/pasma, brak false conflict dla różnych typów dnia, preview wszystkich zmian, RLS między użytkownikami, odrzucenie konfliktu, retry bez duplikatu, brak wycieku prywatnych treści i działanie bez AI dla konfliktów strukturalnych. Uruchom typecheck, lint, pełne testy i prompt:test.
```

---

## P8 — porządek w Bibliotece bez dodawania nowej funkcji

> **Status: ✅ DONE (2026-08-30).**

**Efekt dla użytkownika:** Biblioteka odpowiada „co mam kontynuować?”, a nie pokazuje zbiór równorzędnych kart.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md i FRONTEND.md. Przeanalizuj app/(tabs)/library.tsx, aktywną/zakończoną ścieżkę, szablony, cytaty, listy i wejścia AI. To zadanie dotyczy architektury informacji, nie pełnego redesignu.

Cel: uporządkować Bibliotekę według intencji użytkownika.

Docelowa kolejność:
1. Kontynuuj — aktywna ścieżka/protokół i bieżący etap;
2. Zacznij — katalog ścieżek/protokołów, gdy nic nie jest aktywne;
3. Narzędzia do działania — szablony nawyków i jedno wejście do sugestii z intencji;
4. Do refleksji — listy/cytaty/archiwalne materiały;
5. Zakończone — historia, domyślnie zwinięta.

Wymagania:
- nie duplikuj CTA prowadzących do tej samej funkcji;
- stan aktywnej ścieżki zmienia hierarchię ekranu;
- sekcje mają loading/error/empty i poprawny cache/offline;
- zachowaj istniejący styl, tokens, PL/EN i dostępność;
- nie dodawaj karuzeli, agresywnych gradientów, badge’y ani spersonalizowanego feedu;
- wydziel orkiestrację danych z trasy do feature hooks/view model, jeśli dzięki temu plik stanie się wyraźnie prostszy; bez abstrakcji „na zapas”.

Dodaj testy stanów: brak ścieżki, aktywna, zakończona, offline cache i błąd częściowej sekcji. Uruchom typecheck, lint i pełne testy. W raporcie dołącz krótkie uzasadnienie hierarchii, nie screenshotowy redesign całej aplikacji.
```

---

## P9 — jednorazowe przygotowanie środowiska

> **Status: ✅ DONE (2026-08-31).**

**Efekt dla użytkownika:** plan mówi nie tylko „rób nawyk”, ale najpierw usuwa praktyczną przeszkodę, np. przygotuj książkę przy łóżku.

```text
Pracujesz w repozytorium Tarento. Przeczytaj całe CLAUDE.md. Przeanalizuj habits, path practices, stage advance, today tasks, completion logs, retirement i task source/origin. Nie buduj pełnego systemu zadań jednorazowych.

Cel: dodać w ścieżce/protokole jeden opcjonalny „krok przygotowania środowiska”, który wspiera praktykę i po ukończeniu znika na stałe.

Wymagania:
1. Setup action należy do konkretnego etapu/path enrollment, ma tytuł, opcjonalne krótkie wyjaśnienie, kolejność i status pending/completed/dismissed.
2. Na Dzisiaj pojawia się przed powiązaną praktyką tylko wtedy, gdy etap właśnie się rozpoczął i akcja jest pending. Ma wyraźny wygląd jednorazowego przygotowania, a nie nawyku.
3. Ukończenie nie buduje serii, nie wchodzi do adherence i nie tworzy recurring reminder. Dismiss nie jest porażką.
4. Akcja może blokować praktykę tylko informacyjnie; użytkownik może wykonać praktykę mimo braku setupu.
5. Przy przejściu etapu pending action zostaje zarchiwizowana albo jawnie przeniesiona według jednej opisanej reguły.
6. W prywatnym protokole AI może zaproponować maksymalnie jedną setup action na etap, lecz użytkownik widzi ją w preview i może usunąć przed aktywacją.
7. Dodaj RLS, offline/idempotent completion, export/delete, PL/EN i dostępność.

Testy: pierwsze pojawienie, ukończenie, dismiss, ponowne otwarcie, przejście etapu, zakończenie ścieżki, offline retry, brak wpływu na serie/statystyki i izolacja RLS. Uruchom typecheck, lint i pełne testy; po zmianie schema/promptu AI także prompt:test.
```

---

## P10 — synchronizacja dokumentacji z rzeczywistym produktem

> **Status: ✅ DONE (2026-08-31).**

**Efekt dla zespołu:** Claude Code i Codex nie podejmują błędnych decyzji na podstawie nieaktualnych instrukcji.

```text
Pracujesz w repozytorium Tarento. To zadanie jest dokumentacyjne. Przeczytaj całe CLAUDE.md, README.md, IDEAS.md, FRONTEND.md, package.json, aktualne trasy, src/features i wszystkie migracje. Nie wdrażaj nowych funkcji.

Cel: zsynchronizować dokumentację projektu ze stanem kodu.

Wykonaj:
1. Zidentyfikuj twierdzenia w CLAUDE.md/README, które są już nieprawdziwe — szczególnie dotyczące ścieżek, statystyk, AI, journal, quiet week, retirement, day budget i zakresu MVP.
2. Zmień wyłącznie faktycznie nieaktualne fragmenty. Zachowaj reguły architektoniczne, bezpieczeństwa, i18n, offline, testów i format raportowania.
3. Dodaj zwięzłą mapę obecnych feature modules i tras zamiast rozbudowanego opisu historycznego.
4. Rozdziel „stan zaimplementowany” od „kierunek/backlog”. Linkuj do IDEAS.md i IDEAS_GPT.md zamiast kopiować całe backlogi do CLAUDE.md.
5. Dodaj datę ostatniej weryfikacji oraz prostą zasadę aktualizacji dokumentacji przy dodaniu trasy, tabeli lub Edge Function.
6. Zweryfikuj komendy i liczby testów na bieżącym środowisku; nie wpisuj liczby testów jako wiecznej stałej, jeśli szybko się dezaktualizuje.

Pokaż diff i uzasadnij każdą zmianę faktami z repozytorium. Nie zmieniaj kodu produktu, zależności ani migracji. Uruchom co najmniej typecheck/lint/test, jeśli instrukcje repo wymagają ich również dla zmian dokumentacji; w przeciwnym razie wykonaj kontrolę linków i nazw ścieżek.
```

## 8. Dalsze pomysły — bank, nie backlog na teraz

Te pomysły są potencjalnie wartościowe, ale dopiero po zebraniu danych z etapów 1–3:

1. **Plan sezonowy zamiast stałego tygodnia.** Użytkownik ustawia „do końca września pracuję inaczej”, a harmonogram ma datę początku i końca. Ma sens dopiero po edytorze rotacji.
2. **Tryb powrotu po zmianie życia.** Po dłuższej przerwie aplikacja porównuje dawny day-shape z obecnym i proponuje ponowny onboarding tylko dla zmienionych elementów.
3. **Pamięć decyzji, nie pamięć rozmów.** AI widzi zaakceptowane reguły i poprzednie decyzje użytkownika, ale nie przechowuje nieskończonego czatu.
4. **„Cena utrzymania” praktyki.** Obok czasu aplikacja obserwuje, ile razy użytkownik ją zmniejszał, przekładał lub oznaczał tarcie; prezentuje to opisowo jako koszt dopasowania, nie score charakteru.
5. **Eksport osobistego podręcznika.** Czytelny PDF/Markdown z zaakceptowanymi regułami, wersjami nawyków i potwierdzeniami wdrożenia, bez surowych danych analitycznych.
6. **Publiczny protokół bez social feedu.** Użytkownik może wyeksportować sam szablon protokołu bez logów i notatek. Import zawsze pokazuje diff/budżet i nie uruchamia nic automatycznie.
7. **Tryb opiekuna prywatności.** Jedno miejsce pokazujące, które dane pozostają lokalne, które są synchronizowane i które pojedyncze pola trafiają do AI przy danej akcji.

### Prompty warunkowe do banku

Poniższe prompty są przygotowane do późniejszego użycia. Nie są zgodą na
wdrożenie ani zmianą kolejności priorytetów. Przed uruchomieniem każdego trzeba
potwierdzić jego bramkę danymi z §9 oraz ponownie sprawdzić aktualny kod.

#### F1 — sezonowa wersja rytmu dnia

**Bramka:** najpierw ukończ P2 i potwierdź, że użytkownicy rzeczywiście
poprawiają rotację po onboardingu.

```text
Pracujesz w repozytorium Tarento po wdrożeniu edytora „Mój rytm dnia”. Przeczytaj całe CLAUDE.md, day_templates/day_blocks/day_rotations, trwały day plan, logical day, offline mutations i eksport danych. Nie buduj kalendarza ani ogólnego systemu cyklicznych zdarzeń.

Cel: pozwolić użytkownikowi zapisać czasowo ograniczoną wersję rytmu dnia, np. „od 1 czerwca do 30 września pracuję inaczej”, bez niszczenia rytmu bazowego.

Wymagania:
1. Okres ma nazwę, valid_from, valid_until i wskazuje wersjonowany snapshot rotacji. Zakresy jednego użytkownika nie mogą się nakładać; poza okresem obowiązuje rytm bazowy.
2. Dla danej logicznej daty klient i serwer wybierają ten sam aktywny okres. Granice dat, timezone, DST i nocna zmiana korzystają z istniejących helperów.
3. Przed zapisem pokaż wpływ na budżet i planowane/overflow dla reprezentatywnych typów dnia. Nie zmieniaj automatycznie nawyków ani aktywnej ścieżki.
4. Edycja okresu tworzy nową wersję albo audytowalną zmianę; zakończony okres nie przepisuje historii day_plans.
5. Obsłuż draft, anulowanie, konflikt dwóch urządzeń i idempotentny retry offline. Dodaj RLS, export/delete, PL/EN i dostępność.
6. Zezwól najwyżej na jeden obowiązujący i jeden przyszły okres, dopóki dane nie uzasadnią bardziej rozbudowanego planowania.

Testy: początek/koniec okresu, brak nakładania, fallback do bazy, dzień nocny, DST, preview overflow, retry offline, RLS i niezmienność historycznych snapshotów. Uruchom typecheck, lint i pełne testy.
```

#### F2 — powrót po zmianie życia

**Bramka:** P2 działa, istnieje bezpieczna historia wersji day-shape i dane
pokazują powroty po dłuższej przerwie.

```text
Pracujesz w repozytorium Tarento po wdrożeniu edycji i wersjonowania rytmu dnia. Przeczytaj całe CLAUDE.md, auth/profile, logical day, day-budget, onboarding, habit revisions, quiet week, path reentry i semantykę day_plans. Nie diagnozuj przyczyny przerwy i nie wysyłaj powiadomienia „wróć”.

Cel: po dobrowolnym otwarciu aplikacji po dłuższej przerwie zaproponować krótkie sprawdzenie tylko tych elementów rytmu dnia, które mogły się zmienić.

Wymagania:
1. Zdefiniuj deterministyczny próg przerwy na podstawie braku realnych aktywności, z wyłączeniem quiet week, odpoczynku i świadomie zakończonej ścieżki.
2. Pokaż neutralne zaproszenie możliwe do pominięcia. Nie używaj copy o porażce, utraconej serii ani „wykrytej zmianie życia”.
3. Porównuj zapisane wersje day-shape; nie wnioskuj z treści dziennika, listów ani notatek książkowych. Użytkownik jawnie wskazuje, co się zmieniło.
4. Otwórz częściowy onboarding tylko dla wybranych pól. Przed zatwierdzeniem pokaż było/będzie, nowy budżet i overflow; nie mutuj nawyków ani ścieżki automatycznie.
5. Zapis ma być atomowy/idempotentny i działać z retry offline. Odrzucenie propozycji wycisza ją na zamknięty okres.
6. Dodaj RLS, export/delete, PL/EN, dostępność i analitykę wyłącznie z enumem decyzji.

Testy: próg przerwy, quiet week/rest bez fałszywego triggera, pominięcie, częściowa edycja, preview budżetu, noc logiczna/DST, retry, wyciszenie i RLS. Uruchom typecheck, lint i pełne testy.
```

#### F3 — pamięć decyzji zamiast pamięci rozmów

**Bramka:** zaakceptowane self-rules i decyzje użytkowników mają wystarczające
użycie, a zespół potrafi wskazać konkretną sugestię, którą kontekst poprawi.

```text
Pracujesz w repozytorium Tarento z self_rules, habit revisions, path decisions i serwerowymi Edge Functions AI. Przeczytaj całe CLAUDE.md oraz zasady prywatności, RLS, export/delete i prompt-injection. Nie dodawaj trwałej historii czatu.

Cel: przekazywać AI mały, jawny zestaw zaakceptowanych decyzji użytkownika, aby kolejna sugestia nie przeczyła wcześniejszym wyborom.

Wymagania:
1. Pamięć obejmuje wyłącznie jawnie zaakceptowane self-rules i zamknięte decyzje domenowe z enumem źródła, zakresem, datą, wersją i opcjonalnym terminem przeglądu. Nie zapisuj promptów, odpowiedzi modelu ani swobodnej rozmowy.
2. Przed każdym użyciem serwer wybiera tylko rekordy istotne dla konkretnej akcji i nakłada niski, mierzalny limit kontekstu. Klient nie może podmienić pamięci w body requestu.
3. UI pokazuje „Czego użyje sugestia?” i pozwala wyłączyć lub usunąć każdy wpis. Nie ujawniaj system promptu ani sekretów.
4. Sprzeczne lub wygasłe reguły nie są rozstrzygane przez model: wymagają decyzji użytkownika albo są pomijane.
5. Wynik AI pozostaje sugestią bez mutacji. Do analityki trafia wyłącznie typ pamięci i decyzja enum, bez treści.
6. Dodaj RLS, idempotencję, export/delete, PL/EN oraz testy niezaufanych wartości i izolacji użytkowników.

Testy: selekcja relewantnego kontekstu, limit, wyłączenie/usunięcie, wygaśnięcie, konflikt reguł, cross-user RLS, brak treści w analityce, prompt injection i brak automatycznej mutacji. Uruchom typecheck, lint, pełne testy i prompt:test po zmianie promptu/schema.
```

#### F4 — opisowa cena utrzymania praktyki

**Bramka:** istnieje wystarczająco dużo porównywalnych rewizji, zdarzeń tarcia
i okazji planu; najpierw zdefiniuj minimalną próbę na realnych danych.

```text
Pracujesz w repozytorium Tarento z habit_revisions, friction map, day_plans, retirement i statystykami. Przeczytaj całe CLAUDE.md oraz dokumenty semantyki expected/planned/overflow. Nie twórz score charakteru, rankingu ani automatycznej kary.

Cel: pokazać opisowo, ile dopasowań wymaga utrzymanie praktyki, np. „często zmniejszana w trudnych tygodniach”, obok informacji o czasie.

Wymagania:
1. Zdefiniuj czysty, deterministyczny model oparty tylko na porównywalnych okazjach, rewizjach użytkownika/downshift, dobrowolnym tarciu i — jeśli już istnieje — day override. Rest, quiet week i overflow są neutralne.
2. Wymagaj minimalnej próby i pokazuj „za mało danych”, zamiast ekstrapolować. Nie łącz danych z różnych wersji praktyki bez jawnej reguły.
3. Wynik ma zamknięte kategorie opisowe oraz widoczne składniki, nigdy jedną ocenę 0–100. Copy nie przypisuje cech psychologicznych.
4. Informacja nie zmienia planu, serii, adherence ani przypomnień. Może prowadzić wyłącznie do istniejącej edycji, downshiftu lub emerytury po decyzji użytkownika.
5. Obliczenia wykonuj lokalnie albo w prywatnym agregacie z RLS; bez AI i bez tekstu w analityce.

Testy: minimalna próba, zmiana wersji, rest/quiet/overflow, odrzucone sugestie, brak danych, RLS i brak wpływu na statystyki bazowe. Dodaj PL/EN i dostępność; uruchom typecheck, lint i pełne testy.
```

#### F5 — eksport osobistego podręcznika

**Bramka:** użytkownicy wracają do zaakceptowanych reguł, wersji nawyków i
potwierdzeń transferu; zakres eksportu da się wyjaśnić jednym ekranem preview.

```text
Pracujesz w repozytorium Tarento z data-export, self_rules, habit_revisions, path transfer i implementation confirmations. Przeczytaj całe CLAUDE.md. Zachowaj istniejący surowy eksport JSON; to zadanie dodaje czytelny dokument, nie zastępuje eksportu danych.

Cel: wygenerować lokalnie osobisty podręcznik w Markdown, a PDF tylko jeśli można go uzyskać bez nowej zależności lub po osobnej zgodzie.

Wymagania:
1. Preview pozwala wybrać: aktywne praktyki, zaakceptowane reguły, istotne wersje zachowania, decyzje eksperymentów i potwierdzenia wdrożenia. Domyślnie pomiń surowe logi, analitykę, tarcie, notatki dnia, listy i notatki książkowe.
2. Każda sekcja wyjaśnia źródło i datę. Nie przedstawiaj obserwacji jako diagnozy ani wyniku przyczynowego.
3. Dokument powstaje na urządzeniu z danych należących do użytkownika i działa z cache offline. Nie wysyłaj treści do AI ani zewnętrznego generatora PDF.
4. Udostępnienie wymaga jawnej akcji i używa obecnego mechanizmu share. Plik tymczasowy jest nadpisywany/usuwany zgodnie z bezpiecznym wzorcem eksportu.
5. Dodaj PL/EN, dostępność i testy redakcji prywatnych pól, pustych sekcji, kolejności, offline oraz deterministycznego Markdown.

Uruchom typecheck, lint i pełne testy. Jeśli PDF wymaga zależności lub zmiany konfiguracji natywnej, zatrzymaj się i poproś o zgodę.
```

#### F6 — przenośny protokół bez social feedu

**Bramka:** prywatne protokoły przechodzą pilotaż z §9, a kwestie praw do
udostępnianych opracowań mają zaakceptowaną politykę redakcyjną.

```text
Pracujesz w repozytorium Tarento z prywatnymi book protocols, conflict radar, path-fit, day-budget i jedną aktywną ścieżką. Przeczytaj całe CLAUDE.md. Nie buduj katalogu społecznościowego, profili twórców, ocen, komentarzy ani automatycznej publikacji.

Cel: eksportować i importować wersjonowany plik szablonu protokołu bez prywatnych danych wykonania.

Wymagania:
1. Zdefiniuj ścisły, wersjonowany schema pliku. Dozwolone są wyłącznie treści szablonu, provenance i jawna licencja/oświadczenie autora. Zakazane: owner_id, logi, notatki użytkownika, konteksty konfliktów, self-rules, fit, enrollment, analityka i wewnętrzne identyfikatory.
2. Eksport pokazuje preview pól i ostrzega o prawach do treści. Nie publikuj pliku na serwerze; użyj lokalnego share.
3. Import traktuje cały plik jako niezaufane dane: limit rozmiaru, schema, wersja, długości tekstu i odrzucenie instrukcji/payloadów spoza formatu. Import nie trafia do promptu AI.
4. Zawsze twórz prywatny draft należący do importującego. Przed aktywacją pokaż pełny diff, budżet, path-fit i konflikty. Nigdy nie aktywuj automatycznie i zachowaj jedną aktywną ścieżkę.
5. Retry importu jest idempotentny; dodaj RLS, soft delete, export/delete, PL/EN i dostępność.

Testy: pełna redakcja danych prywatnych, zły/tampered schema, limity, starsza wersja, duplicate retry, RLS, preview diff/budżetu i brak autoaktywacji. Uruchom typecheck, lint i pełne testy.
```

#### F7 — opiekun prywatności

**Bramka:** katalog przepływów danych jest najpierw domknięty w ramach P5;
widok nie może obiecywać gwarancji, których kod nie egzekwuje.

```text
Pracujesz w repozytorium Tarento z privacy route, data-export, analytics i wszystkimi Supabase Edge Functions. Przeczytaj całe CLAUDE.md, ANALYTICS.md (jeśli już istnieje), politykę prywatności i schematy requestów AI. Nie dodawaj nowej telemetrii ani skanera śledzącego użytkownika.

Cel: jedno miejsce wyjaśniające per funkcja, co zostaje na urządzeniu, co synchronizuje się z Supabase i jakie dokładnie kategorie pól trafiają do AI po jawnej akcji.

Wymagania:
1. Zbuduj typowany, statyczny katalog przepływów danych będący kontraktem w kodzie. Kategorie: local, synced, AI-on-action, analytics i never-sent. Nie zapisuj kopii danych użytkownika dla samego widoku.
2. Dla każdej Edge Function pokaż trigger, kategorie wejścia, retencję i skutek. Nie ujawniaj system promptów, sekretów ani technicznych danych ułatwiających atak.
3. Widok pokazuje rzeczywisty stan konfiguracji telemetrii i linkuje do eksportu/usunięcia konta. Brak konfiguracji ma być opisany zgodnie z prawdą.
4. Dodaj kontrolę testową: każde nowe zdarzenie analityczne i każda Edge Function muszą mieć wpis w katalogu; niedokumentowane pole tekstowe powoduje błąd testu.
5. Zachowaj PL/EN, dostępność, cache/offline i istniejący styl. Bez zgód, przełączników lub obietnic, których backend nie obsługuje.

Testy: kompletność katalogu, zakazane pola, stan bez telemetrii, wszystkie funkcje AI, offline, PL/EN i brak prywatnych wartości w UI diagnostycznym. Uruchom typecheck, lint i pełne testy; prompt:test tylko jeśli zmieniono prompt/schema.
```

## 9. Bramki decyzyjne przed funkcjami „wow”

W3–W5 istnieją już w kodzie, ale nie należy rozszerzać ich ani szeroko
udostępniać tylko dlatego, że brzmią efektownie. Najpierw sprawdź:

- czy użytkownicy wracają do Dzisiaj bez nowych funkcji;
- czy day-shape jest poprawiany po onboardingu i czy poprawa zmniejsza overflow;
- czy ścieżki mają sensowny start → etap → koniec;
- czy czytania są otwierane, ale nie wypierają praktyk;
- czy sugestie AI są akceptowane i pozostają aktywne po 14 dniach;
- czy użytkownicy dobrowolnie podają powód tarcia;
- czy istnieje wystarczająca liczba porównywalnych okazji, aby pokazywać osobiste wnioski.

Przykładowe kryterium przed szerszym udostępnieniem generowania prywatnych
protokołów książkowych:

1. 10–20 użytkowników przechodzi ręcznie opracowany protokół.
2. Co najmniej połowa dociera do drugiego etapu bez zwiększenia średniej liczby zadań na Dzisiaj.
3. Użytkownicy potrafią własnymi słowami powiedzieć, co zmieniło się w życiu.
4. Dopiero potem funkcja wychodzi poza kontrolowany pilotaż.

## 10. Uwaga o „unikalności”

Przegląd rynku był punktowy, a rynek zmienia się szybko. Nie należy reklamować żadnej funkcji hasłem „nigdzie indziej tego nie ma” bez osobnego, aktualnego badania prawnego i konkurencyjnego. Najmocniejsza przewaga nie leży w pojedynczej funkcji, lecz w kombinacji:

> **realny budżet dnia + jedna praktyka + kontrolowana zamiana + dowód transferu + prywatna pamięć tego, co działa**

To jest kierunek trudniejszy do skopiowania niż sam generator planu z książki, ponieważ wymaga spójnych danych historycznych, dobrych ograniczeń produktu i zaufania użytkownika.
