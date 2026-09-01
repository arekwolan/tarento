# IDEAS.md — Tarento: kierunek produktu i prompty wdrożeniowe

> **Status dokumentu (weryfikacja 2026-08-31): archiwalny plan i bank promptów.**
> Nie jest mapą aktualnego wdrożenia ani bieżącym backlogiem. Stan produktu
> opisują [README.md](README.md) i [CLAUDE.md](CLAUDE.md); przed użyciem promptu
> zawsze sprawdź trasę, moduł i migracje. Tabela niżej zachowuje pierwotną
> sekwencję wydań, a nie dzisiejszy status prac.

Dokument ma dwie warstwy. Pierwsza to decyzje produktowe i uzasadnienia — do czytania.
Druga to ponumerowane prompty (`P0`–`P16`) w blokach kodu — do kopiowania wprost do
Claude Code. Każdy prompt jest samodzielny: zawiera zakres, model danych, mikrocopy po
polsku i kryteria odbioru zgodne z `CLAUDE.md` §8 i §9.

## Jak używać tego pliku

Prompty są napisane pod jedno zadanie na sesję. Nie wklejaj dwóch naraz — każdy kończy
się listą kryteriów, które trzeba zweryfikować, zanim ruszy następny. Kolejność wdrożenia
jest w §F, nie w numeracji: numeracja idzie za tematem, sekwencja za ryzykiem.

`P0` został wykonany w ramach synchronizacji dokumentacji 2026-08-31. Pozostałe
prompty mogą częściowo pokrywać się z późniejszą implementacją; nie uruchamiaj ich
na podstawie samego nagłówka albo dawnej kolejności.

| ID    | Temat                                           | Wydanie | Koszt |
| ----- | ----------------------------------------------- | ------- | ----- |
| `P0`  | Synchronizacja `CLAUDE.md` §1 z rzeczywistością | teraz   | S     |
| `P1`  | Model danych budżetu czasu                      | 1       | M     |
| `P2`  | Onboarding kształtu dnia w 90 sekund            | 1       | M     |
| `P3`  | Okno dnia, sufit dnia, przeliczenie o 14:00     | 1       | M     |
| `P4`  | Dzień pusty — ochrona odpoczynku                | 1       | S     |
| `P5`  | Schemat ścieżek + katalog treści                | 2       | M     |
| `P6`  | Feature `paths` — zapis, gate budżetowy, etapy  | 2       | L     |
| `P7`  | Ścieżka „Wyjście z chaosu" (14 dni)             | 2       | S     |
| `P8`  | Ścieżka „Droga wojownika w czasach pokoju" (90) | 2       | L     |
| `P9`  | Pauza, powrót, zakończenie ścieżki              | 2       | M     |
| `P10` | AI: zamiar → praktyka                           | 1       | M     |
| `P11` | AI: downshift po słabym tygodniu                | 3       | M     |
| `P12` | AI: dopasowanie ścieżki + walidator + fixtures  | 2       | M     |
| `P13` | Emerytura nawyku                                | 3       | M     |
| `P14` | Tempo zamiast serii + statystyki zdaniem        | 3       | S     |
| `P15` | Cichy tydzień                                   | 3       | S     |
| `P16` | Dziennik jednej linii + cofnięcie dnia          | 3       | M     |

---

## 0. Kierunek: jeden produkt czy dwa

To nie są dwie aplikacje sklejone taśmą, ale też nie są trzy filary. Są dwa filary
i jeden mechanizm, i pomylenie tego jest jedynym realnym zagrożeniem architektonicznym
w całym briefie.

Filar 1 (rozplanowanie dnia) i filar 3 (ścieżki) odpowiadają przeciwnie na pytanie, kto
jest właścicielem dnia. Planer mówi: dzień jest twój, ja go tylko ułożę. Ścieżka mówi:
dzień należy do programu, idź za nim. Postawione obok siebie bez rozstrzygnięcia dają
aplikację, która raz prosi o zgodę, a raz wydaje polecenia — i użytkownik nie wie, w co
gra. Filar 2 nie jest filarem. Budżet czasu to mechanizm, nie obietnica; nikt nie
zainstaluje aplikacji, bo liczy wolne minuty.

Zdanie, które spina to w jeden produkt, brzmi: **ścieżka proponuje, budżet rozstrzyga.**
Ścieżka nigdy nie decyduje, ile miejsca zajmie w dniu — deklaruje zapotrzebowanie,
a budżet je przycina albo odmawia zapisu. Jeśli ścieżka może przebić budżet, masz dwie
aplikacje. Jeśli nie może — masz jedną, i to taką, której nie ma na rynku.

Osobno: **nie buduj planera dnia.** Filar 1 w wersji, którą opisujesz — „wiem co robić,
w jakiej kolejności i ile to zajmie" — to nie jest funkcja, to jest Todoist plus
kalendarz, i przegrasz to starcie w pierwszym tygodniu. Buduj _kształt dnia_: od trzech
do sześciu rzeczy z przypisanym oknem („rano", „po pracy", „wieczorem"), bez godzin, bez
czasów trwania na ekranie, bez zależności między pozycjami. Różnica jest istotna, bo
harmonogram o 14:00 się psuje i produkuje wyrzut, a kształt tylko się przestawia.

I jeszcze jedno założenie, które trzeba zakwestionować wprost: piszesz, że aplikacja ma
nie dokładać obowiązków, a jednocześnie że ścieżka prowadzi przez zestaw praktyk.
Ścieżka z definicji dokłada. Jedyny sposób, żeby te dwa zdania nie były sprzeczne, to
dać ścieżce **sufit zamiast podłogi**: deklaruje maksimum, którego nie przekroczy,
i przy każdym awansie etapu coś oddaje. Ścieżka, która kończy się dwunastoma nawykami,
jest nieudana, choćby użytkownik ją domknął.

---

## A. Model budżetu czasu

### Co jest nie tak z pytaniem, które zadajesz

Onboarding zbierający godziny pracy, dojazdy, sen i stałe obowiązki to formularz
kadrowy. Zajmie sześć minut, wypełni go co trzeci, a dane i tak będą nieprawdziwe, bo
ludzie nie znają swojego dnia — znają jego wersję z poniedziałku.

Zbieraj **kotwice, nie grafik**. Trzy pytania, każde z jednym gestem:

1. Kiedy wstajesz i kiedy chcesz być w łóżku — dwa pokrętła, wartości domyślne 6:30
   i 23:00. Dziesięć sekund.
2. Kiedy jesteś zajęty w dni robocze — jeden poziomy pas doby, na nim jeden przeciągalny
   blok, domyślnie 9:00–17:00. Piętnaście sekund. Nie pytaj o dojazd; przesunięcie
   krawędzi bloku załatwia to samo bez dodatkowego pytania.
3. Ile chcesz dać sobie dziennie na siebie — chipy 15 / 30 / 45 / 60+ minut. Pięć sekund.

Reszta jest wyprowadzana i korygowana obserwacją. Po dwóch tygodniach wiesz z `habit_logs`
i `completed_at`, o której użytkownik faktycznie odhacza, i możesz zaproponować korektę
okna w jednym zdaniu — nie w kolejnym formularzu.

### Najważniejsza decyzja copy w całej aplikacji

Wyliczonej wolnej puli **nigdy nie pokazuj jako zasobu**. „Masz dziś 3 godziny 20 minut
wolnego" to zaproszenie do zapełnienia i dokładnie ten mechanizm, którego się obawiasz.
Pokazuj przydzielone okno: „Twoje okno: 35 minut." Liczba na ekranie ma być granicą,
nie inwentarzem. Wolna pula żyje w modelu, nie w interfejsie.

Do tego **reguła 60%**: nic, co aplikacja proponuje — plan, ścieżka, sugestia AI — nie
może przekroczyć 60% zadeklarowanego okna. Pozostałe 40% nie jest „nieprzydzielone",
tylko chronione, i aplikacja umie to powiedzieć: „Reszta dnia nie jest do zaplanowania."

### Grafik zmianowy, rodzic, student

Nie modeluj tygodnia. Modeluj **szablony dnia i rotację**. Szablon to kształt jednego
typu doby (dzień roboczy, wolne, dyżur nocny, dzień z dzieckiem). Rotacja to uporządkowana
lista szablonów plus data zakotwiczenia; `templateForDate(date)` liczy resztę z dzielenia.
Ten jeden model obsługuje 12-godzinny system D-D-N-N-W-W-W, dwutygodniowy plan zajęć
studenta i „co drugi weekend u dziecka", bez żadnego kodu specjalnego. Domyślnie rotacja
ma długość 7 i mapuje się na dni tygodnia — czyli zwykły użytkownik nigdy jej nie widzi.

### Kiedy dzień się rozsypie o 14:00

Zasada: **plan nie przelicza się sam i nigdy nie informuje o przeliczeniu.** Brak
powiadomienia, brak baneru „zaległości", brak licznika. Przy następnym otwarciu aplikacji
lista na dziś jest po prostu krótsza — pozycje, które nie mieszczą się w pozostałym oknie,
znikają z widoku bez oznaczenia. Nie są zarchiwizowane, nie są nieudane, nie mają odznaki.
Dyskretna linia u dołu: „Pokaż wszystko" — dla tych, którzy chcą.

Nadmiar jest niewidoczny domyślnie. To nie jest ukrywanie danych, to odmowa prowadzenia
rejestru długów.

### PROMPT 0 — synchronizacja instrukcji z kodem

```text
Zadanie: zaktualizuj CLAUDE.md §1 tak, żeby opisywał stan faktyczny repozytorium.

Kontekst: §1 „Zakres MVP" wymienia sześć pozycji i przenosi generowanie planu przez
Gemini do „Poza MVP". Tymczasem w src/features/ stoją już: ai-plan (z Edge Function
supabase/functions/generate-daily-plan), stats, templates, data-export, analytics,
a w app/ są zakładki library i stats oraz katalog (onboarding).

Co zrobić:
1. Przepisz §1 „Zakres MVP" na listę odzwierciedlającą src/features/ i app/.
   Weryfikuj przez odczyt katalogów, nie przez to, co napisane w §4.
2. Przenieś „generowanie planu dnia przez Gemini" z „Poza MVP" do zakresu, zachowując
   zdanie o tym, że działa wyłącznie po stronie serwera (reguła krytyczna 1).
3. Zaktualizuj §4 (struktura katalogów) o istniejące, a niewymienione feature'y.
4. Dopisz do „Poza MVP": ścieżki rozwojowe, budżet czasu, widżet ekranu głównego.
5. Niczego nie usuwaj z §5 (system designu) ani §6 (reguły krytyczne).

Kryteria odbioru:
- każdy katalog w src/features/ jest wymieniony w §4
- każda zakładka w app/(tabs)/ jest wymieniona w §1 albo §4
- npm run lint i npm run typecheck bez zmian w wyniku (to zmiana tylko w dokumentacji)
```

### PROMPT 1 — model danych budżetu czasu — DONE

```text
Zadanie: dodaj feature src/features/day-budget/ wraz z migracją Supabase. Warstwa danych
i czysta logika. Bez ekranów — te przychodzą w osobnym zadaniu.

Migracja supabase/migrations/<timestamp>_day_budget.sql

Tabela public.day_templates — kształt jednego typu doby:
  id uuid pk default gen_random_uuid()
  user_id uuid not null references public.profiles(id) on delete cascade
  name text not null
  kind text not null check (kind in ('workday','free','night_shift','care','custom'))
  wake_time time not null default '06:30'
  sleep_time time not null default '23:00'
  self_minutes smallint not null default 30 check (self_minutes between 0 and 480)
  sort_order integer not null default 0
  archived_at timestamptz
  created_at, updated_at timestamptz not null default now()

Tabela public.day_blocks — zajęte pasy wewnątrz szablonu:
  id uuid pk
  template_id uuid not null references public.day_templates(id) on delete cascade
  user_id uuid not null references public.profiles(id) on delete cascade
  label text
  kind text not null check (kind in ('work','commute','care','fixed','meal','sleep'))
  start_time time not null
  end_time time not null
  archived_at timestamptz
  constraint day_blocks_order check (start_time < end_time)
Komentarz w migracji: bloki przechodzące przez północ (dyżur nocny) rozbijamy na dwa
wiersze przy zapisie — CHECK celowo tego nie dopuszcza, bo arytmetyka okna staje się
wtedy jednoznaczna.

Tabela public.day_rotations — przypisanie szablonów do dni:
  id uuid pk
  user_id uuid not null unique references public.profiles(id) on delete cascade
  anchor_date date not null
  template_ids uuid[] not null check (array_length(template_ids,1) between 1 and 28)
  created_at, updated_at
Komentarz: domyślna rotacja ma długość 7 i odpowiada dniom tygodnia — zwykły użytkownik
nigdy nie widzi pojęcia rotacji. Dłuższe tablice obsługują zmianowość i plan studenta.

RLS na wszystkich trzech tabelach zgodnie z CLAUDE.md regułą 3: polityki select/insert/
update na auth.uid() = user_id, brak polityki delete (archiwizacja przez archived_at,
reguła 4). day_rotations może mieć delete — to nie są dane historyczne.
Granty jak w istniejących migracjach: revoke all from anon, authenticated; grant all to
service_role; grant select, insert, update to authenticated.

Kod TypeScript:

src/features/day-budget/model/schemas.ts
  Schematy zod dla wierszy (snake_case) z transform na camelCase, wzorowane dokładnie na
  src/features/habits/model/habit.ts — ten sam styl, ten sam sposób zawężania enumów.
  Typy: DayTemplate, DayBlock, DayRotation, TimeWindow.

src/features/day-budget/model/windows.ts — CZYSTE FUNKCJE, sercem tego zadania są testy:
  export type TimeWindow = { start: string; end: string; minutes: number }

  templateForDate(rotation: DayRotation, date: IsoDate): string
    Indeks = mod(daysBetween(anchorDate, date), template_ids.length). Użyj daysBetween
    z @/lib/date. Ujemna różnica ma dawać poprawny indeks (mod, nie %).

  freeWindows(template: DayTemplate, blocks: DayBlock[]): TimeWindow[]
    Doba od wake_time do sleep_time minus bloki. Nakładające się bloki scalamy.
    Okna krótsze niż 10 minut odrzucamy — nie da się w nich nic zrobić i tylko
    zaśmiecają wynik.

  allocatedWindow(template: DayTemplate, blocks: DayBlock[]): TimeWindow | null
    Wybiera JEDNO okno o długości self_minutes, umieszczone w najdłuższym wolnym oknie,
    dosunięte do jego początku. To jest liczba, którą widzi użytkownik. Jeśli żadne
    wolne okno nie mieści self_minutes, zwróć najdłuższe dostępne, a nie null; null
    tylko gdy nie ma żadnego okna >= 10 minut.

  budgetCeiling(template: DayTemplate): number
    Math.floor(self_minutes * 0.6). Reguła 60% z IDEAS.md §A. Ta funkcja jest jedynym
    miejscem, w którym ten współczynnik występuje.

  Zakaz new Date() i Date.now() w tym pliku (CLAUDE.md reguła 2) — cała arytmetyka dat
  przez @/lib/date.

src/features/day-budget/model/__tests__/windows.test.ts
  Minimum: rotacja 7-dniowa mapuje się na dni tygodnia; rotacja 4-dniowa D-D-N-N zwraca
  właściwy szablon 10 dni po kotwicy i 3 dni przed nią; bloki nakładające się scalają
  się w jedno; okno 8-minutowe wypada z wyniku; allocatedWindow przy zerze wolnego czasu
  zwraca null; budgetCeiling(30) === 18.

src/features/day-budget/api/ — zapytania do Supabase i klucze TanStack Query, wzorowane
na src/features/habits/api/keys.ts. Hook useDayBudget(date) zwraca
{ template, blocks, allocatedWindow, ceiling, isLoading, error }.

src/features/day-budget/index.ts — publiczne API feature'a.

Kryteria odbioru:
- npm run typecheck bez błędów, zero any, zero as
- npm run lint bez błędów
- npm run test — nowe testy windows.test.ts przechodzą
- npm run db:reset przechodzi, npm run db:types przebudowuje src/types/database.ts
- każda nowa tabela ma enable row level security i komplet polityk w tej samej migracji
- brak nowych zależności w package.json
```

### PROMPT 2 — onboarding kształtu dnia w 90 sekund — DONE

```text
Zadanie: dodaj krok „kształt dnia" do istniejącego onboardingu w app/(onboarding)/.
Cel twardy: trzy pytania, mediana czasu wypełnienia poniżej 90 sekund, zero pól
tekstowych, zero klawiatury.

Nowy ekran app/(onboarding)/day-shape.tsx, wstawiony PRZED (onboarding)/habits.tsx —
budżet musi istnieć, zanim użytkownik wybierze nawyki, bo to on ogranicza wybór.
Plik trasy zostaje cienki (CLAUDE.md §3): składa komponenty z src/features/day-budget/
components/ i woła hooki, zero logiki.

Trzy kroki na jednym ekranie, przewijane pionowo, bez paginacji:

1. „Kiedy zaczynasz i kończysz dzień?"
   Dwa pokrętła czasu obok siebie. Domyślnie 6:30 i 23:00. Wykorzystaj istniejące
   parseTimeOfDay/formatTimeOfDay/isValidTimeOfDay z @/lib/date.

2. „Kiedy w dni robocze jesteś zajęty?"
   Poziomy pas reprezentujący dobę od wake_time do sleep_time, na nim jeden blok kind
   'work', domyślnie 9:00–17:00, z dwoma uchwytami do przeciągania. Skok 15 minut,
   haptyka selectionAsync() na każdym skoku (CLAUDE.md §5, haptyka). Pod pasem jedna
   linia: „Przesuń krawędzie, jeśli doliczasz dojazd." Przycisk ghost „Dodaj drugi blok"
   dodaje kolejny wiersz (maks. 4).
   Gest przeciągania przez Reanimated, z obsługą useReducedMotion(): przy włączonej
   redukcji ruchu bez animacji przyciągania, sama zmiana wartości.

3. „Ile chcesz dać sobie dziennie na siebie?"
   Cztery <Chip> — 15, 30, 45, 60 minut. Domyślnie zaznaczone 30.
   Pod spodem jedna linia, aktualizowana na żywo, i to jest najważniejszy tekst
   w całym onboardingu: „Twoje okno: 30 minut dziennie."
   NIGDY nie pokazuj wyliczonej wolnej puli. Nie renderuj zdania typu „masz 4 godziny
   wolnego". Liczbą na ekranie jest wyłącznie przydzielone okno.
   Jeśli wybrane self_minutes nie mieszczą się w żadnym wolnym oknie, pokaż zamiast tego:
   „W dni robocze zmieści się {n} minut. W weekend więcej." — bez ostrzeżenia, bez ikony
   ostrzegawczej, bez koloru warning.

Zapis: jeden mutation tworzy dwa szablony (kind 'workday' zastosowany pn–pt oraz
kind 'free' zastosowany sb–nd, kopiujący wake/sleep, bez bloków) plus rotację długości 7.
Zaawansowana konfiguracja (zmianowość, więcej szablonów) NIE jest tutaj — trafia do
ustawień jako osobny ekran w późniejszym zadaniu.

Gość bez konta: zapisz do MMKV przez istniejący mechanizm i zsynchronizuj przy rejestracji,
tak jak robi to obecny onboarding.

Teksty: wszystkie klucze do src/i18n/locales/pl.json i en.json w tym samym commicie,
pod onboarding.dayShape.*. Zero stringów w JSX.

Kryteria odbioru (CLAUDE.md §9, przejdź całą listę):
- tylko tokeny semantyczne, zero hexów
- sprawdzone w motywie ciemnym i jasnym
- layout nie łamie się przy fontScale 1.3 — chipy zawijają się do drugiej linii
- uchwyty pasa >= 48x48 dp
- Reduce Motion obsłużone
- klucze w pl.json i en.json, test parzystości src/i18n/__tests__/locales.test.ts przechodzi
- npm run lint i npm run typecheck bez błędów
- pomijalne: przycisk ghost „Pominę to" ustawia self_minutes = 30 i domyślny szablon
  9-17, nie blokuje przejścia dalej
```

### PROMPT 3 — okno dnia, sufit dnia, przeliczenie w trakcie — DONE

```text
Zadanie: podłącz budżet czasu do ekranu „Dziś" (app/(tabs)/index.tsx) i wprowadź sufit
liczby pozycji. Logika w src/features/habits/model/ i src/features/day-budget/, ekran
zostaje cienki.

1. Nagłówek okna
   Nad listą jedna linia, wariant caption, tone secondary:
   „Twoje okno: 35 minut."
   Po przekroczeniu połowy okna (liczonej z czasu, jaki upłynął, nie z wykonania):
   „Zostało 15 minut z Twojego okna."
   Bez paska postępu czasu, bez odliczania sekund, bez koloru accent — akcent jest
   zarezerwowany dla wykonania (CLAUDE.md reguła 8).

2. Sufit dnia
   Nowa czysta funkcja w src/features/habits/model/today-task.ts:
     applyDailyCeiling(tasks: TodayTask[], ceiling: number, remainingMinutes: number)
       : { visible: TodayTask[]; overflow: TodayTask[] }
   Reguły:
   - pozycje już wykonane (isCompleted) zawsze zostają w visible, niezależnie od sufitu
   - limit sztuk: domyślnie 5, z profiles.daily_ceiling (nowa kolumna, smallint not null
     default 5, check between 1 and 12)
   - limit minutowy: suma szacowanego czasu pozycji niewykonanych nie przekracza
     remainingMinutes; szacowanie: unit 'minutes' → target, 'seconds' → target/60,
     pozostałe jednostki → 3 minuty ryczałtem
   - kolejność wypadania: najpierw pozycje o time_of_day, którego pora już minęła,
     potem od najdłuższych
   Testy w src/features/habits/model/__tests__/today-task.test.ts: pozycja wykonana nie
   wypada nigdy; przy remainingMinutes = 0 visible zawiera wyłącznie wykonane; sufit 5
   przy 9 nawykach zwraca 5 + 4.

3. Zachowanie overflow
   Pozycje z overflow NIE renderują się domyślnie. Nie mają odznaki, licznika, koloru,
   ikony. Pod listą, wariant caption, tone tertiary, wyśrodkowane:
   „Pokaż wszystko" — po dotknięciu rozwija resztę bez żadnego komunikatu wyjaśniającego.
   ZAKAZANE teksty: „zaległe", „niewykonane", „przegapiłeś", „zostało Ci", „nadrób”.
   ZAKAZANE: powiadomienie o przeliczeniu, banner o zmianie planu, badge z liczbą.

4. Migracja
   supabase/migrations/<timestamp>_profiles_daily_ceiling.sql — dodaje kolumnę
   daily_ceiling do public.profiles. RLS już istnieje, polityk nie ruszamy.
   Ustawienie w app/(tabs)/settings.tsx: „Maksymalnie pozycji na dziś" — chipy 3/5/8/bez
   limitu (bez limitu = 12).

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test bez błędów
- nowe klucze w pl.json i en.json
- lista z §9 CLAUDE.md przechodzi w całości
- grep po repo nie znajduje w JSX ani w pl.json słów: zaległ, nadrob, przegap
```

### PROMPT 4 — dzień pusty — DONE

```text
Zadanie: „Dzień pusty" — zaplanowany dzień bez zobowiązań, który nie łamie serii i nie
wygląda na porażkę. To jest funkcja chroniąca odpoczynek, nie tryb pauzy.

Model:
  Migracja supabase/migrations/<timestamp>_rest_days.sql
  public.rest_days:
    id uuid pk
    user_id uuid not null references public.profiles(id) on delete cascade
    weekday smallint check (weekday between 0 and 6)   -- cykliczny dzień pusty
    rest_date date                                      -- albo pojedyncza data
    created_at timestamptz not null default now()
    constraint rest_days_one_of check (num_nonnulls(weekday, rest_date) = 1)
    unique nullsnotdistinct (user_id, weekday, rest_date)
  RLS: select/insert/delete na auth.uid() = user_id. DELETE jest tu dozwolone —
  to nie są dane historyczne, tylko deklaracja, którą wolno odwołać (odstępstwo od
  reguły 4 uzasadnione komentarzem w migracji).

Logika:
  isRestDay(date, restDays): boolean — czysta funkcja w
  src/features/day-budget/model/rest.ts, z testami.

Wpływ na resztę aplikacji:
1. Ekran „Dziś" w dniu pustym renderuje: cytat dnia, pod nim jedno zdanie wariantem
   title, wyśrodkowane — „Dziś nic nie trzeba." — i nic więcej. Bez listy, bez pustego
   stanu z CTA, bez przycisku „pokaż nawyki mimo to" na pierwszym planie; ten ostatni
   jako ghost na samym dole, tekst „Pokaż listę".
2. Seria: dzień pusty jest PRZEZROCZYSTY. Nie przedłuża serii i jej nie zrywa. Popraw
   funkcje serii w supabase/migrations (habits_streaks) oraz w src/features/habits/
   tak, żeby przy liczeniu ciągłości pomijały daty będące dniem pustym — czyli
   przeskakiwały je, a nie traktowały jako wykonane.
3. Mapa dni (StreakGrid): dzień pusty renderuje się jako streak-0, identycznie jak dzień
   bez danych. Zero wyróżnienia, zero ikony, zero koloru danger (CLAUDE.md reguła 7).
   Etykieta dostępności: „dzień pusty".
4. Powiadomienia: use-reminder-reconcile pomija dni puste przy planowaniu. Cisza jest
   częścią funkcji.

Ustawienia (app/(tabs)/settings.tsx), sekcja „Odpoczynek":
  „Dzień pusty" + siedem przełączników dni tygodnia, domyślnie żaden.
  Pod spodem, caption, tertiary: „W ten dzień aplikacja nie prosi o nic. Seria się nie
  zrywa."
Na ekranie „Dziś", w menu kontekstowym dnia: „Zrób dziś dzień pusty" — wstawia rest_date
i pokazuje toast z akcją „Cofnij" (CLAUDE.md §5, cofnij zamiast potwierdzaj).

Mikrocopy — dokładnie te teksty:
  rest.today.title        = „Dziś nic nie trzeba."
  rest.today.showList     = „Pokaż listę"
  rest.settings.title     = „Dzień pusty"
  rest.settings.hint      = „W ten dzień aplikacja nie prosi o nic. Seria się nie zrywa."
  rest.today.make         = „Zrób dziś dzień pusty"
  rest.today.undone       = „Dzień pusty cofnięty"
ZAKAZANE: „odpocznij, zasłużyłeś", „nagroda", „przerwa" w znaczeniu przerwania serii.

Kryteria odbioru:
- testy: seria 5 dni + dzień pusty + 3 dni daje currentStreak 8, nie 3 i nie 9
- testy: dzień pusty bez żadnego wpisu nie zeruje serii
- migracja z RLS i komentarzem uzasadniającym politykę DELETE
- klucze w pl.json i en.json
- lista z §9 CLAUDE.md
```

---

## B. System ścieżek

### Ścieżka jako obiekt — jedna decyzja, która zdejmuje 80% pracy

Ścieżka **nie dostaje własnego silnika śledzenia**. Ścieżka to generator wierszy w
`public.habits` plus maszyna etapów nad nimi. Każda praktyka materializuje się jako
zwykły nawyk z ustawionym `source_path_id` i `source_stage_id`.

Konsekwencje są takie, że serie, ekran „Dziś", powiadomienia, statystyki, tryb offline,
optimistic UI i cofanie działają dla ścieżek od pierwszego dnia, bez dotykania linii
istniejącego kodu. Współistnienie z nawykami dodanymi ręcznie przestaje być problemem,
bo to są te same wiersze — różnią się tylko pochodzeniem. A porzucenie ścieżki nie
kasuje niczego: nawyki zostają, użytkownik decyduje, czy je zatrzymać.

Elementy definicji: **etap** (`path_stages`), **praktyka** (`path_practices`, z pełnym
kompletem parametrów, które przyjmuje `habits`), **lektura** (`path_readings`) oraz
**kryteria przejścia** zapisane na etapie.

Kryterium przejścia nie może być kalendarzowe. „Trzydzieści dni" karze osobę, która
zaczęła i zgubiła tydzień. Właściwa forma to koniunkcja z sufitem:

```
advance_when: dni_w_etapie >= min_days AND wykonanie_14d >= threshold
auto_advance_after: max_days
```

`auto_advance_after` jest obowiązkowe i jest sednem: **ścieżka nigdy nie może uwięzić
użytkownika w etapie pierwszym**. Po `max_days` etap przechodzi mimo niespełnionego
progu, z łagodniejszym copy. Nie ma komunikatu „nie zaliczyłeś".

Do tego **sufit budżetowy**: każdy etap deklaruje `daily_minutes_p50`. Zapis na ścieżkę
jest blokowany, gdy `daily_minutes_p50` ostatniego etapu przekracza 60% okna użytkownika —
wtedy ścieżka proponuje wariant lekki (mniej praktyk, niższe parametry startowe) albo
odmawia z konkretną liczbą, nie z ogólnikiem.

Porzucenie i powrót: trzy stany, nie dwa. `active` / `paused` / `ended`. Pauza jest
jawna, darmowa i nie ma limitu. Powrót wznawia etap, na którym się skończyło, ale
z **tygodniem wejściowym** — siedem dni na obniżonych parametrach. Copy: „Wracasz do
etapu 2. Pierwszy tydzień jest lżejszy." Nigdy „zaczynasz od nowa".

### „Droga samuraja" — dlaczego ta nazwa musi zniknąć

Da się to zrobić uczciwie, ale nie pod tą nazwą i nie z tą obietnicą.

Nieuczciwa wersja brzmi: zostań samurajem, oto twoja dyscyplina. Uczciwa przestaje
sprzedawać samuraja i zaczyna sprzedawać teksty — a prawdziwa historia tych tekstów jest
znacznie ciekawsza niż mit. _Hagakure_ to zapis żalu urzędnika, który nie widział wojny
i tęsknił za nią, spisany sto lat po epoce, którą rzekomo opisuje. _Dokkōdō_ to dwadzieścia
jeden linijek, które Musashi napisał tydzień przed śmiercią, po życiu spędzonym w
samotności. _Bushidō_ Nitobego powstało po angielsku, w 1900 roku, dla amerykańskiego
czytelnika, i skonstruowało spójny kodeks tam, gdzie go nie było.

Właściwa nazwa ścieżki to **„Droga wojownika w czasach pokoju"**. To nie jest złagodzenie
— to jest dosłownie temat tych tekstów. Napisali je ludzie wyszkoleni do walki, którym
odebrano wojnę, próbujący ustalić, jak żyć w dyscyplinie, kiedy nic jej nie wymusza.
To jest dokładnie problem człowieka z biurkiem. Ta rama jest jednocześnie prawdziwsza
historycznie i mocniejsza sprzedażowo od miecza w tle, i to jest rzadka sytuacja, w której
uczciwość nic nie kosztuje.

Uwaga historyczna wchodzi jako akapit otwierający opis ścieżki — nie jako disclaimer
drobnym drukiem, tylko jako haczyk. Ludzie, którzy kupują cepelię, i tak odpadną
w drugim tygodniu.

### „Droga wojownika w czasach pokoju" — pełna specyfikacja

`slug: warrior-in-peacetime`, 90 dni, trzy etapy, szczyt sześć śledzonych praktyk
i około 40 minut dziennie. Ścieżka zamykająca się dwunastoma nawykami jest nieudana,
choćby użytkownik ją domknął — dlatego każdy etap coś oddaje.

**Etap 1 — Porządek (dni 1–30, ~22 min/dzień, `min_days` 21, `max_days` 40, próg 0,6)**

| Praktyka            | Parametry                                       | Źródło                                                      |
| ------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Jednakowe wstawanie | `unit: none`, codziennie, siedem dni w tygodniu | _Budōshoshinshū_ — gotowość jako codzienność, nie jako zryw |
| Jedno miejsce       | `unit: minutes`, start 5, increment 0, wieczór  | zen _samu_; _Tenzo Kyōkun_ Dōgena                           |
| Trzy oddechy        | `unit: count`, start 3, rano                    | _Hagakure_, „w przestrzeni siedmiu oddechów"                |
| Czytanie            | `unit: minutes`, start 10, increment 0          | lektura tygodnia, patrz niżej                               |

Przy „trzech oddechach" copy mówi wprost, że u Tsunetomo to była nagana za rozmyślanie,
a nie technika uważności. Ta jedna linijka robi więcej dla wiarygodności ścieżki niż
cały opis.

**Etap 2 — Powściągliwość (dni 31–60, ~35 min/dzień, `min_days` 21, `max_days` 40,
próg 0,55)**

Dochodzi: _Jedno „nie" dziennie_ (`unit: count`, start 1, notatka z treścią odmowy;
źródło: _Dokkōdō_), _Zimna woda_ (`unit: seconds`, start 30, increment 10, target 90,
`progression_mode: calendar`; ramą jest tolerancja dyskomfortu, **nigdy zdrowie** —
i praktyka jest wyłączalna przy zapisie), _Wieczorne rozliczenie_ (`unit: minutes`,
start 3, jedna zapisana linia).

Odchodzi: _Trzy oddechy_ — wsiąka w rutynę i przestaje być śledzone.

**Etap 3 — Ostrość (dni 61–90, ~40 min/dzień, `min_days` 21, `max_days` 45, próg 0,5)**

Dochodzi: _Jedno zadanie do końca_ (`unit: minutes`, start 25, increment 5, target 45,
`calendar`), _Cisza_ (`unit: minutes`, start 20 — bez telefonu, bez muzyki, bez książki).

Odchodzi: _Jedno miejsce_.

Zamknięcie: jednorazowy wpis „List do siebie za rok", przechowywany i wyświetlony
365 dni później. To jedyna rzecz w całej aplikacji, która wraca po roku, i dlatego działa.

**Lektury — dwanaście tygodni, wszystko z domeny publicznej w oryginale**

Tydzień 1–4: _Dokkōdō_ (21 linii, po 5 na tydzień). Tydzień 5–8: fragmenty _Hagakure_.
Tydzień 9–10: _Gorin no shō_, księga ziemi i wody. Tydzień 11: Nitobe, rozdział o
samokontroli — czytany jako dokument epoki, z komentarzem. Tydzień 12: Marek Aureliusz
w zestawieniu z Musashim, jawnie oznaczony jako zestawienie międzykulturowe, nie jako
ciągłość tradycji.

**Mikrocopy — do wzięcia wprost**

```
path.warrior.hook
  „Teksty pisane przez wojowników, którym odebrano wojnę. Dokładnie ten sam problem,
   co Twój."

path.warrior.honesty
  „Bushidō jako spójny kodeks to w dużej mierze wynalazek z 1900 roku — Nitobe napisał
   je po angielsku, dla Amerykanów. Samurajowie z epoki wojen domowych nie czytali
   Hagakure: powstało sto lat po nich, spisane przez urzędnika, który tęsknił za wojną,
   której nie widział. Ta ścieżka nie udaje, że jest inaczej. Bierzemy z tych tekstów
   to, co działa dla kogoś, kto ma biurko zamiast miecza."

path.enroll.fits
  „Ta ścieżka potrzebuje około 22 minut dziennie na starcie i 40 pod koniec.
   Twoje okno to {{minutes}} minut. Zmieści się."

path.enroll.tight
  „Ta ścieżka dochodzi do 40 minut dziennie. Twoje okno to {{minutes}}.
   Mogę poprowadzić wariant lekki — te same praktyki, mniejsze liczby."

path.stage.advance
  „Etap {{n}}: {{name}}. Dochodzą dwie praktyki, jedna odchodzi."

path.stage.advanceSlow
  „Przechodzisz do etapu {{n}}. Poprzedni nie domknął się w całości — to nic nie zmienia."

path.pause
  „Ścieżka wstrzymana. Wróci dokładnie tam, gdzie ją zostawiłeś."

path.resume
  „Wracasz do etapu {{n}}. Pierwszy tydzień jest lżejszy."

path.retire
  „{{practice}} odchodzi z listy. Masz to."
```

Zauważ, czego tu nie ma: słowa „gratulacje", słowa „poziom", słowa „odblokowałeś".

### Osiem kolejnych ścieżek

**„Wyjście z chaosu"** (`out-of-chaos`, 14 dni, S) — dla kogoś, komu życie właśnie się
rozjechało. Zero filozofii, zero lektur, trzy rzeczy: jedna godzina wstawania, jedno
uprzątnięte miejsce, jedno zdanie zapisane przed snem. Najkrótsza ścieżka w katalogu
i domyślna rekomendacja. To ona ma stać pierwsza na liście, nie samuraj.

**„Poranek, który nie boli"** (`gentle-morning`, 30 dni, S) — dla ludzi, którzy
nienawidzą poranków. Nie jest to klub piątej rano: przesuwa pobudkę o 15 minut na
tydzień, maksymalnie cztery kroki. Wygrywa z alternatywą, bo jedyna szczera obietnica
w tej kategorii to „o godzinę wcześniej za miesiąc", a nie „o trzy godziny od jutra".

**„Głęboka praca"** (`deep-work`, 60 dni, M) — dla pracy umysłowej. Bloki 25 → 60 minut,
telefon w innym pomieszczeniu, jeden rytuał zamknięcia dnia. Bez lektur objętych prawem
autorskim — własna synteza plus wskazania (patrz model treści niżej).

**„Stoik na co dzień"** (`everyday-stoic`, 60 dni, M) — Marek Aureliusz, Epiktet, Seneka.
Uwaga prawna, którą łatwo przeoczyć: oryginały są w domenie publicznej, ale **polskie
przekłady zwykle nie są** (Krokiewicz zmarł w 1977, ochrona do 2047). Potrzebne własne
tłumaczenia z oryginału albo z przekładu angielskiego w domenie publicznej.

**„Ciało bez siłowni"** (`body-no-gym`, 60 dni, M) — sam ruch. Ramą jest ruch, nie
zdrowie; ani jedno zdanie o zdrowiu, wadze, diecie czy samopoczuciu. To ścieżka najbliżej
granicy, którą sam sobie postawiłeś — jeśli copy zacznie się osuwać, wytnij ją.

**„Uwaga"** (`attention`, 30 dni, S) — jedyna ścieżka, w której **każdy etap coś zabiera,
zamiast dokładać**. Etap 1: telefon poza sypialnią. Etap 2: powiadomienia od ludzi, nie
od aplikacji. Etap 3: jedna aplikacja usunięta. Postęp mierzy się liczbą rzeczy, których
już nie ma. To najciekawsza rzecz w całym katalogu i najtańsza w produkcji.

**„Czytelnik"** (`reader`, 90 dni, S) — 10 → 40 minut dziennie, jedna skończona książka.
Wygrywa konkretnością wyniku: „skończysz książkę" jest sprawdzalne, „będziesz bardziej
skupiony" nie.

**„Powrót"** (`comeback`, 14 dni, S) — dla kogoś, kto porzucił wszystko i wraca. Nie da
się jej uruchomić dwa razy pod rząd. Odbudowuje jeden nawyk, ten, który szedł najlepiej,
w najniższej wersji. Antywstyd wpisany w mechanikę, nie w copy.

### Realny koszt treści — liczby, nie wrażenia

Jedna ścieżka to: opis (~150 słów), trzy opisy etapów (~80 słów), sześć do dziewięciu
praktyk po cztery linie każda (tytuł, po co, jak, co robić kiedy nie idzie) — razem
~550 słów, dwanaście przypisań lektur po ~100 słów ramy — 1200 słów, oraz około
dwudziestu tekstów przejść. **Sumarycznie ~2600 słów po polsku, tyle samo po angielsku.**

Czas jednej osoby: **dwa dni robocze na ścieżkę**, z czego półtora to nie pisanie, tylko
weryfikacja źródeł. Model napisze akapit o _Hagakure_ w dziesięć sekund i z prawdopodobieństwem
bliskim pewności przypisze mu zdanie, którego tam nie ma. Sprawdzenie tego jest wolne
i nie da się go pominąć — a jedna zmyślona atrybucja w aplikacji sprzedającej uczciwość
wobec źródeł kosztuje więcej niż cała ścieżka jest warta.

Dziewięć ścieżek to około **osiemnastu dni roboczych, czyli miesiąc pracy w pełnym
wymiarze na samą treść.**

Czy ścieżki są pułapką contentową? **Tak, przy dziewięciu. Nie, przy dwóch.** Pułapką nie
jest pierwsza ścieżka, tylko powierzchnia utrzymania: każda ścieżka to obietnica
dziewięćdziesięciodniowego doświadczenia, więc kiedy użytkownik jest na 47. dniu ścieżki
numer cztery, a ty chcesz poprawić etap trzeci, masz migrację **treści**. Stąd `path_version`
od pierwszego dnia i przypięcie zapisanych użytkowników do wersji, którą zaczęli.

Rekomendacja: **wydaj dwie.** „Wyjście z chaosu" (tanie, krótkie, wysoka trafność) oraz
„Droga wojownika w czasach pokoju" (powód, dla którego ktoś opowie o aplikacji znajomemu).
Trzecią dokładaj dopiero, gdy zobaczysz, ilu ludzi dochodzi do etapu drugiego. Format
buduj tak, żeby dodanie ścieżki było plikiem JSON i migracją, nigdy kodem.

### Prawo autorskie — model, który jest czysty i nadal wartościowy

Cztery kategorie treści, każda z innym reżimem, zapisane w schemacie jako `source_kind`:

**`public_domain`** — oryginał w domenie publicznej. Uwaga: domena publiczna oryginału
nie oznacza domeny publicznej przekładu. Tłumacz ma własne prawa, siedemdziesiąt lat od
śmierci. Większość dobrych polskich przekładów klasyków wciąż jest chroniona.

**`own_translation`** — własne tłumaczenie z tekstu w domenie publicznej, oznaczone
„przekład własny z {źródło}". To jest domyślna droga dla wszystkich klasyków w tej
aplikacji i jednocześnie miejsce, gdzie AI daje realną wartość przy niskim ryzyku.

**`citation`** — krótki cytat w ramach prawa cytatu (art. 29 pr. aut.), w utworze
własnym, z pełną atrybucją, uzasadniony wyjaśnieniem lub analizą. Karta cytatu dnia
z dwuwierszem i komentarzem jest broniona. Ścieżka odtwarzająca trzy rozdziały nie jest.

**`pointer`** — wskazanie do współczesnej książki. **Zero treści źródła.** Aplikacja
renderuje wyłącznie własną, stuwyrazową ramę: dlaczego akurat ten rozdział, na co zwrócić
uwagę, co z tego wejdzie do praktyki jutro. Plus atrybucja i link. To jest czyste prawnie
i produktowo lepsze, bo nie konkurujesz ze streszczeniem, tylko dokładasz to, czego
książka nie ma — powiązanie z konkretnym dniem konkretnej osoby.

Reguła egzekwowana schematem, nie dyscypliną: przy `source_kind = 'pointer'` kolumna
`body` musi być NULL-em, wymuszone CHECK-iem. Wtedy nie da się przypadkiem wkleić rozdziału.

### PROMPT 5 — schemat ścieżek i katalog treści

```text
Zadanie: warstwa danych systemu ścieżek. Definicje treści, zapis użytkownika, powiązanie
z istniejącą tabelą habits. Bez ekranów.

ZASADA NADRZĘDNA, od której zależy całe zadanie: ścieżka NIE dostaje własnego silnika
śledzenia. Praktyka ścieżki materializuje się jako zwykły wiersz w public.habits
z ustawionym source_path_id i source_stage_id. Serie, ekran Dziś, powiadomienia,
statystyki i offline mają działać bez zmian w tych modułach. Jeśli w trakcie okaże się,
że musisz zduplikować logikę serii albo listy dnia — zatrzymaj się i zgłoś to zamiast
implementować drugi silnik.

Migracja supabase/migrations/<timestamp>_paths.sql

public.paths — definicja, treść wersjonowana i niemutowalna:
  id uuid pk
  slug text not null
  version integer not null default 1
  unique (slug, version)
  title text not null
  hook text not null              -- jedno zdanie na karcie
  honesty text                    -- akapit o uczciwości wobec źródeł, może być NULL
  duration_days smallint not null
  language text not null default 'pl'
  is_published boolean not null default false
  sort_order integer not null default 0
  created_at timestamptz not null default now()

public.path_stages:
  id uuid pk
  path_id uuid not null references public.paths(id) on delete cascade
  ordinal smallint not null           -- 1,2,3
  name text not null
  description text not null
  daily_minutes_p50 smallint not null
  min_days smallint not null
  max_days smallint not null          -- sufit: po tylu dniach etap przechodzi mimo progu
  completion_threshold numeric not null check (completion_threshold between 0 and 1)
  unique (path_id, ordinal)
  constraint path_stages_days check (min_days <= max_days)
Komentarz w migracji: max_days jest obowiązkowe, bo ścieżka nie może uwięzić użytkownika
w pierwszym etapie. Po max_days przechodzimy z łagodniejszym komunikatem.

public.path_practices — pełne odbicie parametrów habits:
  id uuid pk
  stage_id uuid not null references public.path_stages(id) on delete cascade
  title text not null
  why text not null                   -- jedno zdanie: po co
  how text not null                   -- jedno zdanie: jak
  when_hard text                      -- jedno zdanie: co zrobić, gdy nie idzie
  unit text not null check (unit in ('minutes','seconds','reps','pages','count','none'))
  start_value numeric not null default 1
  increment_value numeric not null default 0
  target_value numeric
  progression_mode text not null default 'completion'
    check (progression_mode in ('completion','calendar'))
  schedule_type text not null default 'daily'
    check (schedule_type in ('daily','weekdays','custom'))
  schedule_days smallint[]
  time_of_day text check (time_of_day in ('morning','afternoon','evening'))
  category text check (category in
    ('mindfulness','health','focus','learning','relationships'))
  is_optional boolean not null default false   -- wyłączalna przy zapisie
  retires_practice_id uuid references public.path_practices(id)  -- co odchodzi z listy
  sort_order integer not null default 0

public.path_readings:
  id uuid pk
  stage_id uuid not null references public.path_stages(id) on delete cascade
  week smallint not null
  title text not null
  author text
  source_kind text not null check
    (source_kind in ('public_domain','own_translation','citation','pointer','original'))
  attribution text                    -- „przekład własny z …" albo dane wydania
  body text                           -- treść albo NULL
  framing text not null               -- własna rama, ~100 słów, ZAWSZE wymagana
  constraint path_readings_pointer_has_no_body check
    (source_kind <> 'pointer' or body is null)
Komentarz: CHECK przy pointerze jest zabezpieczeniem prawnym wpisanym w schemat.
Wskazanie do współczesnej książki nie może renderować treści źródła — aplikacja pokazuje
wyłącznie własną ramę.

public.user_paths — zapis:
  id uuid pk
  user_id uuid not null references public.profiles(id) on delete cascade
  path_id uuid not null references public.paths(id)     -- przypięcie do WERSJI
  state text not null default 'active' check (state in ('active','paused','ended'))
  current_stage_id uuid references public.path_stages(id)
  stage_entered_on date not null
  started_on date not null
  paused_at timestamptz
  ended_at timestamptz
  ended_reason text check (ended_reason in ('completed','abandoned','replaced'))
  reentry_until date          -- data końca tygodnia wejściowego po powrocie
  fit jsonb                   -- wynik dopasowania z P12, może być NULL
  created_at, updated_at
  Indeks częściowy: unique (user_id) where state = 'active'
    — jedna aktywna ścieżka naraz. To jest decyzja produktowa, nie ograniczenie
    techniczne: dwie równoległe ścieżki gwarantują przekroczenie budżetu.

public.user_path_practices — most do habits:
  id uuid pk
  user_path_id uuid not null references public.user_paths(id) on delete cascade
  practice_id uuid not null references public.path_practices(id)
  habit_id uuid not null references public.habits(id) on delete cascade
  user_id uuid not null references public.profiles(id) on delete cascade
  activated_on date not null
  retired_on date
  unique (user_path_id, practice_id)

Zmiany w public.habits (osobna migracja albo ta sama, alter table):
  source_path_id uuid references public.paths(id)
  source_stage_id uuid references public.path_stages(id)
  retired_at timestamptz     -- wycofanie przez ścieżkę, różne od archived_at
Komentarz: retired_at oznacza „ścieżka zdjęła to z listy", archived_at „użytkownik
usunął". Odczyty ekranu Dziś filtrują oba.

RLS (CLAUDE.md reguła 3):
- paths, path_stages, path_practices, path_readings: select dla anon i authenticated
  z warunkiem is_published (dla paths) i przez join dla reszty; brak insert/update/delete
  z klienta — katalog wypełniają migracje
- user_paths, user_path_practices: select/insert/update na auth.uid() = user_id,
  brak delete (reguła 4)
Granty jak w istniejących migracjach.

Kod TypeScript:
  src/features/paths/model/schemas.ts — zod dla wszystkich powyższych, transform na
    camelCase, styl jak src/features/habits/model/habit.ts
  src/features/paths/model/stage.ts — CZYSTE FUNKCJE:
    shouldAdvance(stage, daysInStage, completionRatio14d): 'no' | 'threshold' | 'ceiling'
    practicesForStage(stage, practices, skipOptional: string[]): PathPractice[]
    practiceToHabitInsert(practice, userId, pathId, stageId, startedOn): HabitInsert
  src/features/paths/model/__tests__/stage.test.ts:
    - min_days niespełnione → 'no' nawet przy ratio 1.0
    - min_days i próg spełnione → 'threshold'
    - max_days przekroczone przy ratio 0.1 → 'ceiling' (NIGDY 'no' — to sedno)
    - praktyka z is_optional na liście skipOptional nie trafia do wyniku
  src/features/paths/api/ — keys.ts + zapytania + hooki TanStack Query
  src/features/paths/index.ts — publiczne API

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test bez błędów
- npm run db:reset przechodzi, npm run db:types odświeża src/types/database.ts
- każda tabela ma RLS i komplet polityk w tej samej migracji
- CHECK path_readings_pointer_has_no_body istnieje i jest opatrzony komentarzem
- zero any, zero as, zero new Date() poza @/lib/date
- brak nowych zależności
```

### PROMPT 6 — feature ścieżek: zapis, gate budżetowy, maszyna etapów

```text
Zadanie: warstwa działania ścieżek. Zapis z bramką budżetową, materializacja praktyk
w habits, przejścia etapów, wycofywanie praktyk. Wymaga ukończonych P1 i P5.

1. Ekran katalogu — app/paths/index.tsx
   Lista opublikowanych ścieżek jako karty: tytuł, hook, długość, przedział minut
   („22–40 min dziennie"). Sortowanie po sort_order; „Wyjście z chaosu" stoi pierwsze.
   Cztery stany widoku danych (CLAUDE.md reguła 9): skeleton w kształcie kart, empty,
   error, offline przez <Banner>.
   Bez akcentu na kartach — akcent jest zarezerwowany dla postępu (reguła 8). Kolor
   pojawia się dopiero na ścieżce, na którą użytkownik jest zapisany.

2. Ekran ścieżki — app/paths/[slug].tsx
   Akapit honesty renderowany BEZPOŚREDNIO POD hookiem, wariantem body, nie drobnym
   drukiem, nie w rozwijanym akordeonie, nie jako „więcej".
   Trzy etapy jako karty: nazwa, opis, minuty, lista praktyk z why.
   Na dole jedna akcja główna (reguła 7 w §5): „Zacznij" albo bramka budżetowa.

3. Bramka budżetowa — src/features/paths/model/fit.ts, czysta funkcja + testy:
     checkPathFit(stages, allocatedMinutes):
       { verdict: 'fits' | 'tight' | 'lite' | 'blocked'; peakMinutes: number }
   Reguła: peak = max(daily_minutes_p50 po etapach).
     peak <= budgetCeiling(okno)             → 'fits'
     peak <= okno                            → 'tight'
     peak <= okno * 1.5                      → 'lite'   (proponuj wariant lekki)
     peak > okno * 1.5                       → 'blocked'
   budgetCeiling importuj z @/features/day-budget — współczynnik 0.6 ma jedno miejsce
   w kodzie i nie wolno go tu powtórzyć.
   Copy dla każdego werdyktu jest w IDEAS.md §B, klucze path.enroll.*.
   Przy 'blocked' NIE blokuj przyciskiem disabled bez wyjaśnienia. Pokaż konkretną
   liczbę i jedną alternatywę: „Ta ścieżka dochodzi do 40 minut. Twoje okno to 15.
   Zacznij od »Wyjścia z chaosu« — 10 minut dziennie przez dwa tygodnie."

4. Wariant lekki
   Mnożnik 0.6 na start_value i increment_value wszystkich praktyk, plus pominięcie
   praktyk is_optional. Zapisany w user_paths.fit jako { lite: true }.

5. Zapis — mutacja enrollInPath
   W jednej transakcji (funkcja SQL security definer, nie seria zapytań z klienta):
     - wiersz w user_paths ze state 'active', current_stage_id = etap 1
     - wiersz w habits dla każdej praktyki etapu 1 (z source_path_id, source_stage_id,
       started_on = dziś przez getLogicalToday)
     - wiersz w user_path_practices łączący jedno z drugim
   Optimistic UI: po zapisie ekran Dziś ma pokazać nowe pozycje natychmiast, bez
   czekania na sieć (CLAUDE.md §5, punkt 4). Unieważnij klucze habits.

6. Maszyna etapów — hook useStageAdvance
   Sprawdzenie przy każdym wejściu na ekran Dziś, nie przez cron, nie przez Edge Function.
   Wylicz daysInStage z stage_entered_on i getLogicalToday(), completionRatio14d
   z habit_logs praktyk ścieżki, wywołaj shouldAdvance() z P5.
   Przy 'threshold' i 'ceiling' pokaż <Sheet> z podsumowaniem przejścia:
     - nagłówek path.stage.advance albo path.stage.advanceSlow
     - lista „dochodzi" (nowe praktyki z why)
     - lista „odchodzi" (praktyki z retires_practice_id)
     - jedna akcja: „Zaczynam"
   Po potwierdzeniu: materializuj nowe habits, ustaw retired_at i retired_on na
   wycofywanych, zaktualizuj current_stage_id i stage_entered_on.
   Arkusz pokazujemy RAZ. Odrzucenie (zamknięcie) przesuwa etap tak samo — przejście
   nie wymaga zgody, tylko poinformowania.

7. Wycofanie praktyki
   Nawyk z retired_at znika z ekranu Dziś, ZOSTAJE w statystykach i w mapie dni.
   Toast z akcją „Cofnij" (5 s) przy każdym wycofaniu — użytkownik może chcieć to
   zatrzymać. Copy: path.retire, „{{practice}} odchodzi z listy. Masz to."

8. Ekran Dziś
   Pozycje ze ścieżki NIE są wizualnie wyróżnione. Żadnej ikony ścieżki, żadnego
   znacznika, żadnego grupowania. To są zwykłe nawyki. Pochodzenie widać wyłącznie
   w szczegółach nawyku, jedną linią: „Z: Droga wojownika w czasach pokoju, etap 2".

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy fit.ts pokrywają cztery werdykty
- klucze path.* w pl.json i en.json
- lista z §9 CLAUDE.md w całości, ze szczególną uwagą na: cele dotykowe, fontScale 1.3
  na karcie etapu z długą listą praktyk, cztery stany widoku
- zapis ścieżki działa bez sieci (optimistic) i domyka się po powrocie zasięgu
- zero duplikacji logiki serii i listy dnia — jeśli musiałeś ją skopiować, zgłoś to
```

### PROMPT 7 — treść ścieżki „Wyjście z chaosu"

```text
Zadanie: pierwsza ścieżka w katalogu, jako migracja z danymi. Krótka, tania, bez lektur.
To ma być ścieżka domyślnie rekomendowana, nie samuraj.

Migracja supabase/migrations/<timestamp>_path_out_of_chaos.sql
Wstaw kompletne dane do paths / path_stages / path_practices. Bez path_readings —
ta ścieżka nie ma lektur i to jest celowe: człowiek w chaosie nie ma miejsca na czytanie.

paths:
  slug 'out-of-chaos', version 1, duration_days 14, language 'pl', is_published true,
  sort_order 0
  title: „Wyjście z chaosu"
  hook: „Czternaście dni, trzy rzeczy dziennie, żadnej filozofii.
         Dla kogoś, komu właśnie się posypało."
  honesty: NULL — ta ścieżka nie ma źródeł historycznych i nie udaje, że ma

path_stages (dwa etapy, nie trzy):
  1. „Grunt" — dni 1–7, daily_minutes_p50 = 10, min_days 5, max_days 10,
     completion_threshold 0.4
     description: „Trzy rzeczy, każda poniżej pięciu minut. Chodzi o to, żeby w dobie
                   istniał jakikolwiek stały punkt."
  2. „Ciąg dalszy" — dni 8–14, daily_minutes_p50 = 15, min_days 5, max_days 12,
     completion_threshold 0.4
     description: „Te same trzy rzeczy, plus jedna. Nic więcej nie dochodzi."

path_practices, etap 1:
  „Jedna godzina wstawania" — unit none, daily, time_of_day morning
    why: „Kiedy wszystko inne jest ruchome, jedna stała godzina wystarcza, żeby dzień
          miał początek."
    how: „Ustaw jedną godzinę i trzymaj ją także w weekend. Zakres pół godziny jest ok."
    when_hard: „Za trudno? Przesuń godzinę na późniejszą, zamiast rezygnować."
  „Jedno miejsce" — unit minutes, start 3, increment 0, time_of_day evening
    why: „Jedna uprzątnięta powierzchnia to jedyny dowód, że dało się coś dziś domknąć."
    how: „Wybierz jedno miejsce — biurko, blat, jeden stolik. Do zera. Trzy minuty."
    when_hard: „Nie masz trzech minut? Uprzątnij pięć rzeczy i zostaw resztę."
  „Jedno zdanie" — unit count, start 1, time_of_day evening
    why: „Zapisane zdanie zamyka dzień. Niezapisany dzień ciągnie się w noc."
    how: „Jedna linia o tym, co było. Bez oceniania, bez planów na jutro."
    when_hard: „Nie wiesz co napisać? Napisz »nie wiem, co napisać«. To się liczy."

path_practices, etap 2:
  wszystkie trzy powyższe kontynuują (bez retires_practice_id), plus:
  „Dziesięć minut na zewnątrz" — unit minutes, start 10, increment 0, time_of_day afternoon
    why: „Wyjście z pomieszczenia przerywa dzień, który zlał się w jedną bryłę."
    how: „Dziesięć minut poza budynkiem. Bez celu, bez zakupów po drodze."
    when_hard: „Pogoda nie pozwala? Otwórz okno i stój przy nim dziesięć minut."
    UWAGA: ani jednego słowa o zdrowiu, świeżym powietrzu, witaminie D czy samopoczuciu.
    Rama jest wyłącznie strukturalna — przerwanie dnia, nie interwencja zdrowotna.

Zakończenie ścieżki (obsłuż w kodzie z P9, tekst tutaj):
  path.outOfChaos.done:
    „Czternaście dni za Tobą. Te cztery rzeczy zostają na Twojej liście — możesz je
     zostawić, zmienić albo zdjąć. Ścieżka nie jest już potrzebna."

Odpowiednik angielski: dodaj drugą ścieżkę z tym samym slug, version 1, language 'en'
— albo, jeśli schemat z P5 nie rozdziela języków przez wiersze, przenieś teksty do
i18n i trzymaj w bazie wyłącznie klucze. Wybierz jedno i uzasadnij wybór w komentarzu
migracji; nie zostawiaj obu.

Kryteria odbioru:
- npm run db:reset przechodzi, ścieżka pojawia się w katalogu
- checkFit dla okna 15 minut zwraca 'fits' (peak 15, ceiling 9 → sprawdź: to zwróci
  'tight'; jeśli tak, obniż daily_minutes_p50 etapu 2 do 12 albo skoryguj copy —
  ta ścieżka MA się mieścić w najmniejszym oknie, to jej cały sens)
- teksty przechodzą przez i18n, zero polskich stringów w JSX
- grep po migracji nie znajduje słów: zdrowie, zdrowo, samopoczucie, energia, dieta
```

### PROMPT 8 — treść ścieżki „Droga wojownika w czasach pokoju"

```text
Zadanie: ścieżka flagowa. 90 dni, trzy etapy, dwanaście przypisań lektur.
To jest zadanie w połowie badawcze — połowa czasu idzie na weryfikację źródeł, nie na
pisanie. Traktuj to poważnie: jedna zmyślona atrybucja przekreśla całą ścieżkę, której
jedynym wyróżnikiem jest uczciwość wobec źródeł.

Pełna specyfikacja treści jest w IDEAS.md §B, sekcja „Droga wojownika w czasach pokoju".
Przenieś ją do migracji supabase/migrations/<timestamp>_path_warrior_in_peacetime.sql.

Twarde zasady dla tego zadania:

1. NAZWA. Ścieżka nazywa się „Droga wojownika w czasach pokoju", slug
   'warrior-in-peacetime'. Nie „Droga samuraja". Uzasadnienie jest w IDEAS.md i nie
   podlega negocjacji: te teksty napisali ludzie, którym odebrano wojnę, i to jest
   dosłownie ich temat.

2. AKAPIT UCZCIWOŚCI. Pole honesty wypełnij dokładnie tekstem path.warrior.honesty
   z IDEAS.md §B. Renderowany jest bezpośrednio pod hookiem, nie jako disclaimer.

3. WERYFIKACJA ŹRÓDEŁ. Każde path_readings.attribution musi wskazywać konkretny,
   sprawdzalny fragment: dzieło, księga/rozdział, numer maksymy. Dla Dokkōdō — numery
   linii (1–21). Dla Hagakure — księga i sekcja. Dla Gorin no shō — księga (ziemi,
   wody, ognia, wiatru, pustki).
   Jeśli nie jesteś w stanie potwierdzić, że dany fragment mówi to, co przypisuje mu
   framing — NIE WSTAWIAJ GO. Zostaw pusty tydzień i zgłoś to w odpowiedzi. Pusty
   tydzień jest tańszy niż zmyślony cytat.
   Użyj WebSearch/WebFetch do weryfikacji. Nie polegaj na pamięci modelu przy cytatach
   z Hagakure — to jest tekst, wobec którego modele halucynują szczególnie chętnie.

4. PRAWO AUTORSKIE. source_kind ustaw zgodnie z rzeczywistością:
   - oryginały japońskie i Nitobe 1900: 'public_domain'
   - polskie renderowania, które tworzysz: 'own_translation', attribution w formie
     „przekład własny z {konkretne źródło w domenie publicznej}"
   - Marek Aureliusz w tygodniu 12: 'own_translation'. NIE cytuj polskich przekładów
     Krokiewicza ani Reitera — ochrona trwa. To jest częsty błąd i migracja ma
     zawierać komentarz ostrzegający przed nim.
   - żadnego 'pointer' w tej ścieżce; wszystko ma być czytelne w aplikacji
   framing (~100 słów) jest ZAWSZE Twój i zawsze wymagany.

5. PRAKTYKA „ZIMNA WODA". is_optional = true. Framing wyłącznie o tolerancji
   dyskomfortu. ANI JEDNEGO słowa o zdrowiu, odporności, krążeniu, metabolizmie,
   regeneracji czy nastroju. Przy zapisie na ścieżkę praktyka ma się dać odznaczyć
   jednym gestem, bez tłumaczenia się.
   Jeśli nie potrafisz napisać framing dla tej praktyki bez ocierania się o poradę
   zdrowotną — usuń praktykę i zastąp ją inną z tego samego etapu. Zgłoś to.

6. PRAKTYKA „TRZY ODDECHY". W polu why umieść uwagę historyczną:
   „U Tsunetomo »w przestrzeni siedmiu oddechów« było naganą za rozmyślanie, nie
    techniką uważności. Bierzemy stąd tempo, nie duchowość."
   Ta jedna linijka robi dla wiarygodności ścieżki więcej niż cały opis.

7. RETIRES. Ustaw retires_practice_id: etap 2 wycofuje „Trzy oddechy",
   etap 3 wycofuje „Jedno miejsce". Ścieżka kończy się sześcioma śledzonymi praktykami,
   nie dziewięcioma. Jeśli liczba wyjdzie większa — zdejmij coś, nie dodawaj etapu.

8. LIST DO SIEBIE ZA ROK. Zakończenie ścieżki zapisuje jednorazowy wpis użytkownika.
   Potrzebna tabela public.letters (id, user_id, body text not null, written_on date,
   deliver_on date, delivered_at) z RLS jak wszędzie i bez polityki delete.
   Doręczenie: sprawdzenie przy wejściu na ekran Dziś, nie powiadomienie push.
   Copy: „Rok temu napisałeś do siebie."

Zakres wynikowy: paths (1 wiersz), path_stages (3), path_practices (9, w tym 2 wycofywane),
path_readings (12), plus migracja tabeli letters.

Kryteria odbioru:
- npm run db:reset przechodzi
- checkPathFit dla okna 60 minut → 'fits'; dla okna 30 minut → 'lite'
- każdy z 12 wierszy path_readings ma niepuste framing i attribution wskazujące
  konkretny fragment
- w odpowiedzi wypisz listę atrybucji, których NIE udało się zweryfikować (jeśli są)
- grep po migracji nie znajduje: zdrowie, odporność, krążenie, regeneracja, metabolizm
- teksty w pl.json i en.json, test parzystości przechodzi
```

### PROMPT 9 — pauza, powrót, zakończenie

```text
Zadanie: cykl życia ścieżki poza stanem aktywnym. To jest zadanie o tym, żeby porzucenie
nie bolało — i najprostsze do zepsucia copy w całej aplikacji.

1. Pauza
   W szczegółach ścieżki, akcja secondary: „Wstrzymaj ścieżkę".
   Bez dialogu potwierdzenia — to akcja odwracalna, więc idzie od razu plus toast
   z „Cofnij" (CLAUDE.md §5, punkt 3).
   state = 'paused', paused_at = now(). Nawyki ścieżki dostają retired_at (znikają
   z Dziś, zostają w historii). Powiadomienia dla nich są odplanowywane.
   Copy po wstrzymaniu: „Ścieżka wstrzymana. Wróci dokładnie tam, gdzie ją zostawiłeś."
   Bez limitu czasu, bez wygasania, bez przypomnień o wznowieniu. ZERO powiadomień
   typu „wróć do ścieżki".

2. Powrót
   Akcja primary na wstrzymanej ścieżce: „Wznów".
   state = 'active', reentry_until = getLogicalToday() + 7 dni.
   Nawyki wracają (retired_at = null) z parametrami przemnożonymi przez 0.6 na czas
   tygodnia wejściowego. Po reentry_until parametry wracają do wartości etapu —
   bez komunikatu, bez „koniec taryfy ulgowej".
   Copy: „Wracasz do etapu {{n}}. Pierwszy tydzień jest lżejszy."
   ZAKAZANE: „zaczynasz od nowa", „reset", „straciłeś postęp", pokazywanie liczby dni
   przerwy.

3. Zakończenie z porzucenia
   Nie ma akcji „porzuć". Jest „Zakończ ścieżkę", i po jej wybraniu <Sheet> z jednym
   pytaniem i dwiema odpowiedziami:
     „Co zrobić z praktykami?"
     [Zostaw je na liście]  — nawyki tracą source_path_id, stają się zwykłe
     [Zdejmij z listy]      — nawyki dostają archived_at
   user_paths: state 'ended', ended_reason 'abandoned'.
   Copy nagłówka arkusza: „Kończysz ścieżkę." — kropka, nie znak zapytania, nie
   „czy na pewno". To samo pytanie zadaj przy zakończeniu z sukcesem; różni się tylko
   nagłówek.
   ZAKAZANE w tym arkuszu: liczba dni, procent ukończenia, słowo „niedokończona",
   pytanie „dlaczego rezygnujesz?" i jakakolwiek ankieta.

4. Zakończenie z sukcesem
   Wyzwalane przez przejście z ostatniego etapu.
   Nagłówek: „{{path}} — koniec." Pod spodem jedno zdanie z pola paths.completion_note
   (dodaj kolumnę). Dla „Wyjścia z chaosu" tekst jest w P7.
   Potem to samo pytanie o praktyki co wyżej.
   ended_reason 'completed'.
   ZAKAZANE: konfetti, animacja fajerwerków, „gratulacje", „osiągnięcie", odznaka,
   propozycja kolejnej ścieżki na tym samym ekranie. Propozycja następnej ścieżki może
   się pojawić najwcześniej trzy dni później, w katalogu, bez powiadomienia.

5. Ścieżka „Powrót"
   Reguła w checkPathFit albo osobna: slug 'comeback' nie może być uruchomiony, jeśli
   poprzednie user_paths tego użytkownika ze state 'ended' zawiera slug 'comeback'
   z ended_at w ostatnich 60 dniach. Komunikat: „Tę ścieżkę robiłeś niedawno.
   Wybierz inną." — bez tłumaczenia dlaczego.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- test: wznowienie ustawia reentry_until na dziś+7 i mnoży start_value przez 0.6
- test: po reentry_until parametry wracają do wartości z path_practices
- klucze w pl.json i en.json
- grep po pl.json nie znajduje: gratulacje, osiągnięcie, straciłeś, od nowa, dlaczego
  rezygn
- lista z §9 CLAUDE.md
```

---

## C. Rola AI

Zacznę od tego, co jest gadżetem, bo to już stoi w repo: **generowanie całego planu dnia
od zera jest najwyższym ryzykiem przy najniższej wartości w całej aplikacji.** Sam
napisałeś, że jeden absurdalny plan kosztuje więcej niż dziesięć dobrych buduje — a plan
to akurat rzecz, którą funkcja deterministyczna zrobi lepiej. Masz nawyki, harmonogram
i wolne okna; rozłożenie pięciu pozycji na trzy pory dnia to arytmetyka, nie inteligencja.
Nie usuwaj `generate-daily-plan`, ale przestań traktować je jako oś produktu i przenieś
budżet uwagi na trzy zastosowania niżej.

**Zamiar → praktyka.** Użytkownik pisze „chcę więcej czytać", model zwraca od jednej do
trzech kandydatek na nawyk z konkretnymi parametrami: jednostka, wartość startowa,
przyrost, pora dnia, szacowane minuty. To jedyne miejsce, gdzie model naprawdę bije
formularz, bo zamienia mgliste zdanie w strukturę. Ryzyko jest ograniczone konstrukcyjnie:
wynik to **wypełniony formularz, nie zobowiązanie**. Połowa tego już istnieje w
`toHabitFormValues`.

**Downshift po słabym tygodniu.** Kiedy wykonanie nawyku z ostatnich 14 dni spada poniżej
40%, aplikacja raz proponuje: „Ten nawyk nie wchodzi. Zmniejszyć go?" — a model układa
mniejszą wersję (30 minut → 10, codziennie → trzy razy w tygodniu). To jest zastosowanie
o najwyższej wartości w całym produkcie, bo trafia dokładnie w moment, w którym ludzie
rezygnują, a właściwą interwencją jest mniejsza prośba. Ryzyko jest znikome: jedna
pozycja, widoczny diff, a „mniej" jest zawsze do obrony.

**Dopasowanie ścieżki przy zapisie.** Raz na zapis, nie codziennie: model dostaje wolne
okna i istniejące nawyki, i dostraja praktyki — które minuty, w jakiej kolejności, którą
praktykę pominąć, bo użytkownik już to robi. Zabija poczucie „ten program nie był pisany
dla mnie", a ryzyko jest małe, bo wynik przechodzi przez ekran przeglądu i istnieje
deterministyczny wariant zapasowy.

Mechanika przeciw absurdom składa się z czterech rzeczy i żadnej nie wolno pominąć.
Model **nigdy nie dostaje pustej kartki** — w promptcie są wolne okna, istniejące nawyki
i twardy budżet w minutach. Wynik **przechodzi walidator**, który odrzuca sumę powyżej
60% budżetu, pojedynczą pozycję powyżej 45 minut, duplikat istniejącego nawyku i wartość
startową powyżej limitu dla jednostki; odrzucenie oznacza jedną powtórkę, a potem
wariant deterministyczny. Wynik **nigdy nie stosuje się automatycznie** — ląduje
w edytowalnym formularzu. I wreszcie prompt ma **zestaw regresyjny**: dwadzieścia
zamrożonych stanów użytkownika i skrypt sprawdzający, że walidator przechodzi dla
wszystkich. To ostatnie jest jedyną rzeczą, która oddziela funkcję AI od zobowiązania AI.

### PROMPT 10 — AI: zamiar → praktyka

```text
Zadanie: zamiana jednego zdania użytkownika na wypełniony formularz nawyku.
Rozszerzenie istniejącej Edge Function albo nowa — zdecyduj po przeczytaniu
supabase/functions/generate-daily-plan/ i uzasadnij wybór jednym zdaniem.

Wejście z klienta: { intent: string (maks. 200 znaków) }
Kontekst dokładany po stronie funkcji (klient go NIE wysyła — funkcja czyta z bazy
kluczem service_role):
  - allocatedWindow użytkownika w minutach
  - tytuły i jednostki istniejących, niezarchiwizowanych nawyków
  - liczba pozycji już na liście
Wyjście: { candidates: PlanItem[] (1–3), generation_id, remaining }
PlanItem — ten sam kształt co w src/features/ai-plan/model/plan.ts. Nie wymyślaj nowego.

Walidator po stronie funkcji, przed zwróceniem odpowiedzi
(supabase/functions/_shared/validate-proposal.ts, żeby P11 i P12 użyły tego samego):
  - suma szacowanych minut kandydatów <= 60% allocatedWindow
  - żadna pozycja > 45 minut
  - start_value w granicach dla jednostki: minutes <= 20, seconds <= 120, reps <= 20,
    pages <= 15, count <= 5
  - brak duplikatu istniejącego nawyku (normalizacja: małe litery, bez znaków
    diakrytycznych, podobieństwo Levenshteina < 3)
  - increment_value <= start_value * 0.2
Odrzucenie → jedna powtórka z komunikatem o naruszonej regule w promptcie →
przy drugim odrzuceniu zwróć wariant deterministyczny: jedna pozycja,
unit minutes, start 10, increment 0, time_of_day evening, tytuł = intent skrócony.
NIGDY nie zwracaj błędu użytkownikowi z tego powodu.

Klient:
  Ekran app/habit/new.tsx dostaje na górze pole tekstowe z placeholderem
  „Chcę… (np. czytać więcej wieczorem)" i przyciskiem secondary „Podpowiedz".
  Wynik renderuje się jako 1–3 <OptionCard> z tytułem i rationale.
  Wybór karty WYPEŁNIA FORMULARZ i nie zapisuje niczego. Użytkownik widzi wszystkie
  pola i może je zmienić przed zapisem. To jest twarda zasada — żadnego zapisu
  jednym dotknięciem.

Telemetria: dodaj do public.ai_generations kolumny accepted_at timestamptz
i rejected_reason text (migracja). Zapisuj, czy propozycja została użyta.
Bez tego nie zmierzysz trafności i za trzy miesiące nie będziesz wiedział, czy
ta funkcja jest coś warta.
RLS ai_generations już istnieje i nie wolno dodawać klientowi polityki INSERT —
wpisy robi funkcja kluczem service_role.

Stany błędu, wszystkie z tekstem mówiącym co zrobić (CLAUDE.md reguła 9):
  brak sieci    → „Podpowiedzi wymagają połączenia. Możesz dodać nawyk ręcznie."
  limit dzienny → „Podpowiedzi wrócą jutro. Formularz działa bez nich."
  błąd funkcji  → „Nie udało się. Spróbuj jeszcze raz albo wypełnij pola ręcznie."

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy walidatora (uruchamiane w Deno albo przeniesione do wspólnego modułu testowanego
  jestem): każda z pięciu reguł ma test odrzucający i przepuszczający
- klucze w pl.json i en.json
- CLAUDE.md reguła 1: klucz Gemini wyłącznie w sekretach Edge Function, zero
  EXPO_PUBLIC_ dla czegokolwiek związanego z modelem
- lista z §9
```

### PROMPT 11 — AI: downshift po słabym tygodniu

```text
Zadanie: najważniejsza funkcja AI w tej aplikacji. Trafia w moment, w którym ludzie
rezygnują, i proponuje mniejszą wersję zamiast zachęty.

Wyzwalacz — czysta funkcja src/features/habits/model/downshift.ts:
  shouldOfferDownshift(habit, logs, today): boolean
  Warunki (wszystkie muszą być spełnione):
    - nawyk istnieje >= 14 dni (started_on)
    - wykonanie z ostatnich 14 zaplanowanych dni < 0.4
    - nawyk nie ma retired_at ani archived_at
    - nie proponowano downshiftu dla tego nawyku w ostatnich 30 dniach
    - to nie jest praktyka ścieżki w tygodniu wejściowym (reentry_until)
  Testy obowiązkowe, w tym: nawyk 3-dniowy nie kwalifikuje się nigdy; nawyk
  z wykonaniem 0.39 kwalifikuje się, z 0.41 nie; dzień pusty nie liczy się jako
  zaplanowany.

Migracja: public.habit_downshifts (id, habit_id, user_id, offered_at, accepted_at,
  from_params jsonb, to_params jsonb). RLS jak wszędzie, bez delete.

Prezentacja — i to jest cała trudność zadania:
  NIE powiadomienie push. NIE baner na ekranie Dziś. NIE modal przy starcie.
  Wyłącznie w szczegółach nawyku (app/habit/[id].tsx), jako <Card> na dole:
    tytuł:  „Ten nawyk nie wchodzi."
    treść:  „Zrobione {{n}} z 14 dni. To zwykle znaczy, że prośba jest za duża,
             nie że coś jest z Tobą nie tak."
    akcja:  „Zmniejsz" (secondary)
  ZAKAZANE słowa w całym tym przepływie: motywacja, wytrwałość, nie poddawaj się,
  dasz radę, jeszcze raz, porażka, słabość.
  ZAKAZANY kolor: danger i warning (CLAUDE.md reguła 7 — to nie jest ostrzeżenie).

Propozycja:
  Wywołanie funkcji brzegowej kind 'downshift'. Wejście: parametry nawyku i historia
  wykonania po dniach tygodnia. Wyjście: jedna propozycja, ten sam PlanItem plus
  opcjonalne schedule_type/schedule_days.
  Walidator ze wspólnego modułu z P10 plus JEDNA REGUŁA DODATKOWA, bez której cała
  funkcja jest szkodliwa: propozycja MUSI być mniejsza od oryginału na co najmniej
  jednym wymiarze i nie może być większa na żadnym. Naruszenie → wariant
  deterministyczny: start_value * 0.5, zaokrąglone w dół, increment_value = 0.
  Deterministyczny wariant jest tu w pełni wystarczający — jeśli po dwóch tygodniach
  okaże się, że model nie bije mnożnika 0.5, wytnij wywołanie modelu i zostaw funkcję.
  Zapisz to w komentarzu do kodu.

Zastosowanie: <Sheet> z diagramem zmiany („30 minut → 10 minut", „codziennie →
pon/śr/pt"), jedna akcja „Zmieniam". Po zastosowaniu toast z „Cofnij".
Historia nawyku ZOSTAJE nietknięta — habit_logs mają snapshot target_value i to jest
dokładnie po to (patrz komentarz w migracji habits).

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy shouldOfferDownshift, minimum pięć przypadków wymienionych wyżej
- test walidatora: propozycja większa od oryginału jest odrzucana
- klucze w pl.json i en.json
- grep po pl.json nie znajduje: motywac, wytrwał, nie poddawaj, dasz radę, porażk
- lista z §9
```

### PROMPT 12 — AI: dopasowanie ścieżki, walidator, zestaw regresyjny

```text
Zadanie: dopasowanie ścieżki do kontekstu użytkownika przy zapisie oraz — i to jest
ważniejsza połowa zadania — zestaw regresyjny dla wszystkich promptów w projekcie.

CZĘŚĆ 1: dopasowanie
  Wywołanie raz, przy zapisie na ścieżkę. Nie codziennie, nie przy każdym etapie.
  Wejście (składane po stronie funkcji z bazy):
    - definicja ścieżki: etapy, praktyki z parametrami
    - allocatedWindow i budgetCeiling użytkownika
    - istniejące nawyki użytkownika (tytuł, jednostka, target)
    - werdykt z checkPathFit
  Wyjście, zapisywane do user_paths.fit:
    {
      lite: boolean,
      skip: string[],          -- id praktyk do pominięcia (bo użytkownik już to robi)
      adjust: { practiceId: string, startValue: number, timeOfDay: string }[],
      note: string             -- jedno zdanie po polsku, pokazywane raz przy zapisie
    }
  Walidator (wspólny moduł z P10) plus reguły specyficzne:
    - suma daily_minutes_p50 po dopasowaniu <= budgetCeiling dla etapu 1
    - skip nie może objąć więcej niż połowy praktyk etapu
    - adjust.startValue nigdy nie większe niż w definicji (dopasowanie tylko w dół)
    - note maks. 160 znaków, bez wykrzykników
  Deterministyczny fallback: lite = werdykt 'lite', skip = [], adjust = [],
  note = pusty. Ścieżka ma działać w całości bez ani jednego wywołania modelu.

  Ekran przeglądu przed zapisem pokazuje różnice jako listę:
    „Pomijam: Czytanie — masz już nawyk czytania."
    „Zaczynam od 15 minut zamiast 25 — tyle mieści się w Twoim oknie."
  Jedna akcja „Zaczynam", jedna ghost „Bez dopasowania".

CZĘŚĆ 2: zestaw regresyjny — to jest to, co oddziela funkcję AI od zobowiązania AI

  supabase/functions/__fixtures__/users/*.json — 20 zamrożonych stanów użytkownika.
  Muszą pokrywać co najmniej:
    - okno 15 minut i okno 180 minut
    - zero nawyków i dwanaście nawyków
    - użytkownik z nakładającym się nawykiem (czytanie + ścieżka z czytaniem)
    - zmianowiec z oknem tylko w weekend
    - użytkownik z ustawionym dniem pustym
    - intencja pusta, intencja 200-znakowa, intencja bez sensu („asdf")
    - intencja ocierająca się o zakazane obszary („chcę schudnąć", „mam depresję")
      → oczekiwane zachowanie: model NIE proponuje nic z obszaru zdrowia; funkcja
        zwraca neutralną propozycję strukturalną albo pusty wynik z komunikatem
        „To wykracza poza to, w czym Tarento pomaga." Ten przypadek jest obowiązkowy.

  scripts/prompt-regression.mjs:
    - uruchamia wszystkie trzy rodzaje wywołań (plan, intent, downshift, path-fit)
      przeciwko każdemu fixture
    - sprawdza walidatorem, wypisuje tabelę PASS/FAIL
    - kod wyjścia != 0 przy jakimkolwiek FAIL
    - klucz Gemini z sekretów albo ze zmiennej środowiskowej procesu, NIGDY z pliku
      w repo (CLAUDE.md reguła 1); przy braku klucza skrypt kończy się z jasnym
      komunikatem, nie z wyjątkiem
    - odpalany przez process.execPath, nie npx (patrz CLAUDE.md §7, uwaga o Windows)
  npm run prompt:test w package.json.

  Dopisz do CLAUDE.md §8 „Definicja ukończenia" punkt: zmiana jakiegokolwiek promptu
  w supabase/functions/ wymaga uruchomienia npm run prompt:test i załączenia wyniku.

Kryteria odbioru:
- npm run typecheck, npm run lint
- npm run prompt:test przechodzi dla wszystkich 20 fixture'ów albo raportuje konkretne
  FAIL-e z nazwą naruszonej reguły
- fixture z „mam depresję" nie produkuje ani jednej propozycji dotyczącej zdrowia
- ścieżka daje się zapisać przy całkowicie wyłączonym modelu (przetestuj to)
- klucze w pl.json i en.json
```

---

## D. Szesnaście pomysłów, na które nie wpadłeś

Uporządkowane tak, że pierwsze pięć wynika z odejmowania, bo o to prosiłeś, i bo to one
zdecydują, czy ta aplikacja jest inna.

**Emerytura nawyku** (M, ryzyko: obniża DAU). Po sześćdziesięciu dniach z wykonaniem
powyżej 85% aplikacja proponuje: „Ten nawyk masz. Chcesz przestać go odhaczać?" Nawyk
przechodzi w stan `retired`, zachowuje historię, znika z listy. To najbardziej
kontrintuicyjna funkcja w produkcie i jedyna, która dowodzi tezy: celem jest przestać
potrzebować aplikacji do tej konkretnej rzeczy. Wygrywa z alternatywą, bo alternatywą
jest lista, która rośnie w nieskończoność, a to jest dokładnie ta mechanika, przez którą
ludzie odinstalowują takie aplikacje w trzecim tygodniu. Będzie Ci się to wydawało błędem
przy budowaniu. To nie jest błąd.

**Cichy tydzień** (S, ryzyko: mierzalnie gorsza retencja krótkoterminowa). Jeśli
wykonanie spada poniżej 30% przez siedem dni, powiadomienia same się wyłączają na tydzień
i aplikacja nic o tym nie mówi. Żadnego „wróć do nas". Aplikacja robi się cichsza, kiedy
jest ciężko, a nie głośniejsza. To dokładna odwrotność każdego podręcznika retencji
i właściwa decyzja dla produktu, który nie chce być źródłem poczucia winy.

**Sufit dnia** (S, ryzyko: użytkownicy zaawansowani poczują ograniczenie). Twardy limit
pozycji widocznych na Dziś, domyślnie pięć. Reszta zwinięta. Trybem awarii aplikacji
nawykowych jest wzrost listy — sufit jest jedyną obroną, która działa bez dyscypliny
użytkownika.

**Tryb „tylko jedno"** (S, ryzyko: nadużywanie). Jeden przełącznik w ustawieniach: Dziś
pokazuje dokładnie jedną pozycję, najważniejszą. Na ciężkie tygodnie. Wygrywa z pauzą,
bo utrzymuje nić. Copy: „Ciężki tydzień? Zostaw jedno."

**Ścieżka „Uwaga"** (S, ryzyko: brak — to najtańsza rzecz w katalogu). Jedyna ścieżka,
w której każdy etap coś zabiera. Postęp mierzony liczbą rzeczy, których już nie ma.
Opisana w §B.

**Odhaczanie z powiadomienia** (M, ryzyko: obsługa akcji w `expo-notifications` jest
kapryśna na obu platformach i wymaga macierzy testów na dev buildzie). Akcja „Zrobione"
wprost w powiadomieniu. Skoro tezą produktu jest „otwórz, odhacz, zamknij", to usunięcie
otwierania i zamykania jest logiczną konsekwencją, a nie skrótem.

**Tempo zamiast serii** (M, ryzyko: seria jest najsilniejszą mechaniką w kategorii
i osłabienie jej kosztuje zaangażowanie). Na statystykach główną liczbą jest „23 z ostatnich
30 dni", seria schodzi na drugi plan. Proporcja przeżywa pominięty dzień, seria umiera.
Na ekranie Dziś zostaw serię — tam działa przy kamieniach milowych.

**Prognoza zamiast oceny** (S, ryzyko: brak). Zamiast pokazywać, czego nie zrobiłeś,
pokaż, co się stanie: „Przy obecnym tempie skończysz książkę 14 listopada." Patrzenie
w przód jest tanie i całkowicie zmienia ton ekranu statystyk.

**Statystyki zdaniem, nie wykresem** (S, ryzyko: brak). Ekran otwiera jedno zdanie:
„Przez ostatnie 30 dni najlepiej szło Ci we wtorki, najgorzej w niedziele." Wykresy niżej,
dla chętnych. Osoba prowadząca własne nawyki nie potrzebuje analityki, potrzebuje jednej
obserwacji.

**Dziennik jednej linii** (M, ryzyko: bez retrieval to martwa funkcja). Po domknięciu dnia
jedna opcjonalna linia. Bez podpowiedzi, bez skali nastroju, bez tagów. Wraca po 30, 90
i 365 dniach: „Rok temu napisałeś…". Produktem jest przypomnienie, nie pisanie — i dlatego
nie wolno tego rozbudowywać do dziennika.

**Cofnięcie dnia** (S, ryzyko: wygląda na funkcję do oszukiwania). Długie przytrzymanie
na dniu w mapie → „odznacz wszystko z tego dnia". Ludzie okłamują serię, potem czują się
źle z tym kłamstwem, potem rezygnują. Czysty sposób na korektę utrzymuje dane prawdziwymi
i relację uczciwą.

**Kalendarz jako blokada, nie jako lista** (M, ryzyko: koszt uprawnienia jest wysoki
przy niewidocznej korzyści). Dostęp do kalendarza tylko do odczytu, użyty wyłącznie do
odejmowania zajętego czasu od okna. Aplikacja nigdy nie pokazuje wydarzeń, nie wymienia
ich, nie proponuje planowania w nie. Bierze użyteczny kawałek integracji bez stawania
się kalendarzem. Zrób opcjonalne, wytłumacz jednym zdaniem: „Tarento nie czyta, co masz
w kalendarzu — sprawdza tylko, kiedy jesteś zajęty."

**Nagranie własnego przypomnienia** (M, ryzyko: uprawnienia audio i część ludzi uzna to
za dziwne). Pięć sekund własnym głosem, odtwarzane jako przypomnienie. Brzmi jak gadżet,
nie jest: samodzielnie sformułowane zobowiązanie to jedyna rzecz, której aplikacja nie
może podrobić, a koszt treści wynosi zero.

**Widżet „jedna kropka"** (L, ryzyko: wymaga natywnego modułu i najprawdopodobniej
config pluginu — patrz CLAUDE.md §8, „pytaj przed zrobieniem"). Ekran główny: jedna kropka
na dzień z ostatnich trzydziestu. Bez liczb, bez procentów. Wartością aplikacji jest
rzut oka, a widżet jest rzutem oka bez otwierania.

**Zaproszenie do rezygnacji** (S, ryzyko: brak). W ustawieniach jedna akcja: „Eksportuj
wszystko i usuń konto". Jeden ekran, bez ścieżki zatrzymującej, bez ankiety, bez oferty.
`data-export` już istnieje. To jest tanie i to jest powód, dla którego ktoś wpuści do tej
aplikacji prawdziwe dane.

**Reguła kolumny** (S, ryzyko: brak — to zasada, nie funkcja). Żadne pytanie w onboardingu
nie zostaje, jeśli nie umiesz wskazać kolumny, do której zapisuje. Quiz osobowości,
pytanie o „typ poranny/wieczorny", ankieta o celach — wszystko to daje wrażenie
personalizacji i nie produkuje niczego, czego aplikacja używa. Zapisz tę regułę
w `CLAUDE.md` i egzekwuj przy każdym nowym ekranie.

### PROMPT 13 — emerytura nawyku

```text
Zadanie: nawyk, który stał się nawykiem, przestaje być śledzony. Najbardziej
kontrintuicyjna funkcja w produkcie — nie negocjuj jej w trakcie implementacji.

Kwalifikacja — czysta funkcja src/features/habits/model/retirement.ts:
  isRetirementCandidate(habit, logs, restDays, today): boolean
    - nawyk istnieje >= 60 dni
    - wykonanie z ostatnich 60 zaplanowanych dni >= 0.85 (dni puste nie liczą się
      jako zaplanowane — użyj isRestDay z P4)
    - brak archived_at i retired_at
    - nie proponowano emerytury w ostatnich 90 dniach
    - nawyk nie należy do aktywnej ścieżki (praktykę ścieżki wycofuje etap, nie to)
  Testy: 59 dni → false; wykonanie 0.84 → false, 0.85 → true; nawyk ścieżki → false;
  dni puste nie psują proporcji.

Migracja: public.habit_retirements (id, habit_id, user_id, offered_at, accepted_at,
declined_at). RLS jak wszędzie, bez delete.
Kolumna habits.retired_at już istnieje po P5 — jeśli robisz to zadanie wcześniej,
dodaj ją tutaj z tym samym komentarzem.

Prezentacja: <Card> w szczegółach nawyku, nigdy powiadomienie, nigdy modal.
  tytuł:  „Ten nawyk masz."
  treść:  „{{n}} z ostatnich 60 dni. Możesz przestać go odhaczać — historia zostaje,
           seria zostaje, tylko znika z listy na dziś."
  akcje:  „Zdejmij z listy" (primary) i „Zostaw" (ghost)
Po zdjęciu: toast z „Cofnij" (5 s). Nawyk znika z Dziś, zostaje w statystykach
i w mapie dni, jego seria przestaje rosnąć i przestaje się zrywać — jest zamrożona.

Ekran nawyków (app/(tabs)/... albo library) dostaje sekcję „Zdjęte z listy",
zwiniętą domyślnie, z akcją „Wróć do listy" przy każdej pozycji.

Statystyki: nawyki na emeryturze liczą się do „ile nawyków zbudowałeś", a nie do
„ile odhaczasz". To jest jedyna liczba w aplikacji, która ma rosnąć bez końca.

ZAKAZANE: „ukończony", „opanowany", „mistrzostwo", odznaka, poziom, konfetti,
propozycja „a może dodasz coś nowego w to miejsce?" na tym samym ekranie.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy isRetirementCandidate, minimum pięć przypadków
- test: seria nawyku na emeryturze nie zeruje się po tygodniu bez wpisów
- klucze w pl.json i en.json
- lista z §9
```

### PROMPT 14 — tempo zamiast serii, statystyki zdaniem

```text
Zadanie: przebuduj app/(tabs)/stats.tsx tak, żeby otwierało się obserwacją, a nie
wykresem, i żeby główną liczbą była proporcja, nie seria.

1. Zdanie na górze — src/features/stats/model/observation.ts, CZYSTA FUNKCJA:
     buildObservation(logs, habits, restDays, today): { key: TranslationKey; params }
   Wybiera JEDNĄ obserwację z listy, w kolejności priorytetu:
     - najlepszy i najgorszy dzień tygodnia (min 20 dni danych, różnica >= 25 pp)
     - najdłużej utrzymywany nawyk („{{title}} robisz od {{n}} dni")
     - pora dnia z najwyższym wykonaniem
     - liczba dni z kompletem („{{n}} dni w tym miesiącu domknąłeś w całości")
     - wariant zapasowy przy małej ilości danych:
       „Za wcześnie na wnioski. Wróć za tydzień."
   Testy: każda gałąź plus przypadek pustych danych.
   Renderowane wariantem title, bez ikony, bez akcentu.

2. Główna liczba
   Zamiast serii: „{{done}} z ostatnich 30 dni", wariant display, jednostka mono.
   Pod spodem, caption tertiary: „Najdłuższa seria: {{n}} dni."
   Na ekranie Dziś seria ZOSTAJE jako główna — tam działa, bo tam jest moment
   kamienia milowego. Nie zmieniaj tego.

3. Prognoza
   Dla nawyków z target_value i progression_mode 'calendar' dodaj linię:
     „Przy obecnym tempie osiągniesz {{target}} {{unit}} około {{date}}."
   Czysta funkcja forecastDate() w tym samym module, z testami. Data przez @/lib/date,
   formatowanie przez formatFullDay.
   Jeśli tempo jest zerowe albo ujemne — NIE renderuj linii. Nie pokazuj „nigdy".

4. Wykresy schodzą pod obserwację. Zostaje StreakGrid i to, co już masz. Nie dokładaj
   nowych wizualizacji.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy buildObservation i forecastDate
- klucze w pl.json i en.json (obserwacje jako osobne klucze z interpolacją, nie
  sklejane stringi)
- lista z §9, w tym fontScale 1.3 na zdaniu obserwacji (może mieć trzy linie)
```

### PROMPT 15 — cichy tydzień

```text
Zadanie: aplikacja robi się cichsza, kiedy użytkownikowi jest ciężko. Odwrotność
standardowego podręcznika retencji i celowa decyzja produktowa.

Wyzwalacz — czysta funkcja src/features/notifications/model/quiet.ts:
  shouldEnterQuietWeek(logs, habits, restDays, today): boolean
    - wykonanie z ostatnich 7 zaplanowanych dni < 0.3
    - w tych 7 dniach było co najmniej 5 dni zaplanowanych (dni puste nie liczą się)
    - nie było cichego tygodnia w ostatnich 21 dniach
  Testy obowiązkowe, w tym: tydzień z czterema dniami pustymi nie wyzwala.

Zachowanie:
  - wszystkie zaplanowane przypomnienia zostają odwołane na 7 dni
  - po 7 dniach wracają same, bez pytania i bez komunikatu
  - aplikacja NIE informuje o wejściu w cichy tydzień żadnym powiadomieniem
  - jedyny ślad: w ustawieniach, w sekcji powiadomień, jedna linia caption tertiary:
    „Przypomnienia są wyciszone do {{date}}." z akcją ghost „Włącz teraz"
  - ZERO powiadomień typu „tęsknimy", „wróć", „twoja seria czeka" — w całej aplikacji,
    nie tylko tutaj

Migracja: public.quiet_weeks (id, user_id, started_on, ends_on, ended_early_at).
RLS jak wszędzie.

Dopisz do CLAUDE.md, §6, jako regułę krytyczną 10:
  „NIGDY nie wysyłaj powiadomienia, którego użytkownik sam nie ustawił.
   Dozwolone są wyłącznie: przypomnienie o nawyku o godzinie ustawionej przez
   użytkownika. Zakazane: przypomnienia o powrocie, podsumowania tygodnia,
   informacje o serii, komunikaty produktowe, cokolwiek marketingowego.
   Aplikacja odzywa się wtedy, kiedy jej kazano, i nigdy indziej."

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- testy shouldEnterQuietWeek
- grep po src/features/notifications/ nie znajduje scheduleNotificationAsync wywołanego
  z czymkolwiek innym niż przypomnienie nawyku
- klucze w pl.json i en.json
- CLAUDE.md zawiera regułę 10
```

### PROMPT 16 — dziennik jednej linii i cofnięcie dnia

```text
Zadanie: dwie małe funkcje, które razem tworzą uczciwy zapis czasu.

CZĘŚĆ 1: dziennik jednej linii
  Migracja public.day_notes (id, user_id, note_date date, body text not null
  check (char_length(body) between 1 and 280), created_at). unique (user_id, note_date).
  RLS: select/insert/update na własnych. DELETE dozwolone z komentarzem — to jest
  własny tekst użytkownika, nie dane historyczne systemu.

  Wejście: po domknięciu wszystkich pozycji dnia, w istniejącym AllDoneCard, jedno
  pole tekstowe z placeholderem „Jedna linia o dziś (opcjonalnie)". Bez podpowiedzi,
  bez skali nastroju, bez tagów, bez emoji-pickera. Zapis przy utracie fokusu.

  Wyjście — i to jest właściwy produkt tej funkcji:
  Na ekranie Dziś, nad cytatem, jeśli istnieje wpis sprzed 30, 90 albo 365 dni:
    <Card>, wariant caption tone tertiary: „Rok temu napisałeś:"
    pod spodem wariant body: treść wpisu
    bez akcji, bez „odpowiedz", bez porównania z dzisiaj
  Jeden wpis dziennie, priorytet: 365 > 90 > 30.

CZĘŚĆ 2: cofnięcie dnia
  Długie przytrzymanie na dniu w StreakGrid (i w mapie na ekranie statystyk) otwiera
  <Sheet>:
    nagłówek: data
    lista pozycji z tego dnia ze stanem
    akcja destrukcyjna: „Odznacz wszystko z tego dnia" — JEDYNE miejsce w tej funkcji,
    gdzie wolno użyć koloru danger (CLAUDE.md reguła 7)
  Kasuje wiersze habit_logs z tego dnia (polityka DELETE na habit_logs już istnieje
  i jest do tego przeznaczona — patrz komentarz w migracji habits).
  Toast z „Cofnij" po wykonaniu.
  Copy pod akcją, caption tertiary: „Seria przeliczy się na nowo."
  ZAKAZANE: „oszukiwanie", „korekta", „prawda", ostrzeżenie o utracie serii.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- test: przywołanie wpisu wybiera 365 przed 90 przed 30
- test: po odznaczeniu dnia currentStreak liczy się od nowa poprawnie
- klucze w pl.json i en.json
- lista z §9, w tym cel dotykowy komórki mapy dni >= 48x48 dp przy długim przytrzymaniu
  (komórka jest mniejsza wizualnie — potrzebny hitSlop)
```

---

## E. Czego świadomie nie budować

**Udostępniania serii.** Wykluczyłeś feed społecznościowy, ale przycisk „podziel się serią"
to ten sam feed od tyłu. Jak tylko wynik da się pokazać komuś innemu, użytkownik zaczyna
optymalizować pod pokazywanie, a to wypiera motywację wewnętrzną dokładnie tak samo jak
punkty, które już odrzuciłeś.

**Śledzenia nastroju w skali 1–5.** Zaprasza do korelacji, których aplikacja nie może
odpowiedzialnie zinterpretować, i w ciągu dwóch iteracji dryfuje w stronę „zauważyliśmy,
że w poniedziałki masz gorzej" — czyli dokładnie w obszar, który sobie zamknąłeś.
Dziennik jednej linii daje te same dane bez udawania pomiaru.

**Czatu z asystentem.** Nieograniczona powierzchnia odpowiedzialności w kategoriach,
które wykluczyłeś (zdrowie, dieta, terapia), plus nieograniczony koszt, plus dokładnie
zerowa przewidywalność. Jeśli użytkownik napisze „mam depresję", czat musi mieć na to
odpowiedź, a każda odpowiedź, którą da, jest albo bezużyteczna, albo poza Twoim zakresem.

**Menedżera zadań z terminami, projektami i podzadaniami.** To jest pułapka filaru 1.
Przegrywasz z Todoistem na jego boisku, a swoje boisko tracisz.

**Ścieżek tworzonych przez użytkowników i marketplace'u.** Koszt moderacji jest
nieograniczony dla jednej osoby, a pierwsza ścieżka „30 dni głodówki" na Twoim serwerze
kończy dyskusję o zakazie porad zdrowotnych.

**Integracji z Apple Health i Google Fit.** Wciąga w kategorię zdrowotną, nie poprawia
żadnej decyzji w aplikacji i dokłada uprawnienie, którego trzeba bronić w opisie sklepu.

**Kwestionariusza osobowości w onboardingu.** Reguła kolumny z §D: jeśli nie umiesz
wskazać, do której kolumny to pytanie zapisuje, nie zadawaj go. Trzy pytania o kształt
dnia zapisują do trzech tabel. „Jesteś rannym ptaszkiem?" nie zapisuje do niczego.

**Bramki płatnej na liczbie nawyków.** Ograniczanie podstawowej czynności to najszybszy
sposób na dezinstalację. Jeśli kiedyś wprowadzisz płatność, bramkuj ścieżki i AI, nigdy
odhaczanie.

**Zamrażania i naprawiania serii za walutę.** To jest ta sama mechanika, którą odrzuciłeś
w punkcie o punktach, tylko przebrana za życzliwość. Dzień pusty rozwiązuje ten sam
problem bez tworzenia rynku wewnętrznego.

**Wersji angielskiej przed potwierdzoną retencją na polskim.** Parzystość `en.json` jest
dyscypliną kodu i ma zostać. Wypuszczenie na rynek anglojęzyczny to osobna decyzja
produktowa i nie ma jej co robić, zanim wiadomo, że ktokolwiek zostaje na trzydzieści dni.

**Web.** `CLAUDE.md` już to mówi. Powtarzam, bo to najczęściej łamana zasada w projektach
Expo — pojedynczy `Platform.OS === 'web'` w kodzie oznacza, że decyzja została po cichu
cofnięta.

---

## F. Sekwencja trzech wydań

Zakładam jedną osobę pracującą z asystentami, realne tempo, i to, że kod już zawiera
nawyki, ekran dnia, serie, cytaty, powiadomienia, autoryzację, statystyki, szablony
i generowanie planu.

**Wydanie 1 — „Okno" (3–4 tygodnie).** `P0`, `P1`, `P2`, `P3`, `P4`, `P10`.
Budżet czasu, kształt dnia, sufit dnia, dzień pusty, zamiar → praktyka. Bez ścieżek.
Idzie pierwsze, bo jest mechanizmem, którego potrzebują oba pozostałe filary, bo to
jedyna rzecz odróżniająca Tarento od pięćdziesięciu trackerów w sklepie, i bo daje się
przetestować samodzielnie — jeśli okno czasu nie zmienia zachowania użytkowników,
ścieżki tym bardziej nie zmienią. `P10` wchodzi tutaj tanio, bo połowa instalacji już
stoi w `src/features/ai-plan/`.

**Wydanie 2 — „Ścieżka" (5–6 tygodni, z czego dwa to wyłącznie treść).** `P5`, `P6`,
`P7`, `P12`, `P8`, `P9`, w tej kolejności. Silnik ścieżek i dokładnie dwie ścieżki.
Idzie drugie, bo bez budżetu z wydania 1 nie ma czym egzekwować sufitu, a ścieżka bez
sufitu jest właśnie tą aplikacją do zapychania każdej wolnej minuty, której nie chcesz
zbudować. Uwaga na kolejność: `P7` przed `P8`, bo krótka ścieżka zweryfikuje silnik przy
dwóch dniach pracy nad treścią zamiast przy dziesięciu.

**Wydanie 3 — „Mniej" (3 tygodnie).** `P13`, `P11`, `P14`, `P15`, `P16`.
Emerytura, downshift, tempo zamiast serii, cichy tydzień, dziennik. Idzie ostatnie, bo
te funkcje wymagają historii, z której jest co zdejmować, i bo to jest wydanie, po którym
aplikacja przestaje przypominać konkurencję. Jeśli miałbyś wyciąć jedno wydanie z powodu
czasu — to nie jest to.

Czego nie ma w żadnym z trzech: widżetu, kalendarza, nagrania głosem, odhaczania
z powiadomienia. To są dobre pomysły z `§D`, które wymagają natywnych modułów albo
uprawnień, i każdy z nich zasługuje na osobną decyzję zgodnie z `CLAUDE.md` §8
(„pytaj przed zrobieniem"). Nie wciskaj ich w wydanie, w którym nie są sednem.

---

## G. Najmocniejszy zarzut

Nie jest nim zatłoczony rynek — to nigdy nikogo nie zatrzymało. Jest nim to, że
**pętla główna Twojego produktu trwa cztery sekundy i nie produkuje niczego, co
użytkownik widzi.** Odhaczenie pola nie jest produktem. Wszystko, co w Tarento wartościowe
— ścieżki, budżet, emerytura nawyku — dzieje się w skali tygodni, a użytkownik musi
przeżyć dwadzieścia jeden dni czterosekundowej pętli, żeby dotrzeć do pierwszej wypłaty.
Aplikacje nawykowe nie umierają dlatego, że są złe. Umierają dlatego, że dziewiątego dnia
nie ma w nich nic nowego, a brak nowego jest nieodróżnialny od braku czegokolwiek.

Drugi zarzut jest specyficzny dla tego briefu: **trzy filary obsługują trzy różne osoby.**
Ten, kto potrzebuje planu dnia, jest przytłoczony. Ten, kto potrzebuje budżetu czasu,
jest w błędzie co do własnej doby. Ten, kto chce „Drogi samuraja", nudzi się i szuka
tożsamości. To są trzy różne osoby, a próba obsłużenia wszystkich trzech oznacza, że
pierwszy ekran musi być czytelny dla każdej z nich — co zwykle kończy się tak, że nie
jest przekonujący dla żadnej. Jeśli musisz wybrać jedną: **wybierz szukającego tożsamości**,
bo tylko on opowie o aplikacji komuś innemu.

Jedyna funkcja, bez której nie ma sensu tego wypuszczać, to **ścieżka**. Nie plan, nie
budżet. Bez ścieżki Tarento jest trackerem nawyków z dobrą typografią, a nie ma powodu,
żeby ktokolwiek instalował go zamiast tego, który już ma w telefonie. Ścieżka jest jedyną
rzeczą w tym briefie, którą użytkownik potrafi opisać znajomemu jednym zdaniem — a to
jest jedyna dystrybucja, na jaką stać jedną osobę.

Pytanie, na które musisz sobie odpowiedzieć, zanim napiszesz kolejną linijkę:

> **Co dokładnie zobaczy użytkownik dziewiątego dnia, czego nie widział trzeciego?**

Jeśli szczera odpowiedź brzmi „większą liczbę w serii" — kolejność wydań z `§F` jest zła
i ścieżka musi iść pierwsza, nawet kosztem tego, że pojedzie bez budżetu. A jeśli nie
umiesz odpowiedzieć w ogóle, to żadna z szesnastu funkcji w tym dokumencie tego nie
naprawi, bo to nie jest brak funkcji, tylko brak obietnicy.

Pytanie poboczne, ale niech leży obok: ilu ludzi poza Tobą używa dziś tej aplikacji przez
tydzień z rzędu? Jeśli odpowiedź to zero, to wydanie 2 jest za wcześnie, niezależnie od
tego, ile kodu jest gotowe.

---

## H. Jak konstrukcja chroni odpoczynek

Prosiłeś o szczególną wrażliwość na to, żeby aplikacja nie zamieniła się w narzędzie do
zapychania każdej wolnej minuty. To nie jest kwestia copy — to jest kwestia siedmiu
decyzji konstrukcyjnych, z których każda jest w promptach powyżej.

**Wolna pula nie istnieje w interfejsie.** Model ją zna, ekran nigdy jej nie pokazuje.
Widoczna jest wyłącznie przydzielona liczba: „Twoje okno: 35 minut." Liczba na ekranie
jest granicą, nie inwentarzem. To jedno rozstrzygnięcie decyduje, czy aplikacja pomaga,
czy zapełnia.

**Reguła 60%.** Nic, co aplikacja proponuje, nie przekracza 60% zadeklarowanego okna.
Pozostałe 40% nie jest nieprzydzielone — jest chronione, i aplikacja umie to powiedzieć.
Współczynnik żyje w jednej funkcji (`budgetCeiling`), więc nie da się go po cichu
podnieść w jednym miejscu.

**Odpoczynek jest stanem zaplanowanym, nie brakiem aktywności.** Dzień pusty to wiersz
w bazie, renderuje się jako `streak-0`, jest nieodróżnialny od dnia bez danych i nie da
się go „nie zaliczyć".

**Seria nie karze przerwy.** Dzień pusty jest przezroczysty: nie przedłuża i nie zrywa.
Pominięty dzień ma poziom 0, ten sam co brak danych, nigdy `danger`.

**Nadmiar znika, zamiast się kumulować.** Pozycje, które nie mieszczą się w pozostałym
oknie, przestają być widoczne — bez odznaki, bez licznika, bez rejestru długów.

**Aplikacja cichnie, gdy jest ciężko.** Cichy tydzień wyłącza przypomnienia po siedmiu
słabych dniach i nie komentuje tego. Reguła krytyczna 10 zakazuje jakiegokolwiek
powiadomienia, którego użytkownik sam nie ustawił.

**Aplikacja umie oddawać.** Emerytura nawyku, wycofywanie praktyk przy awansie etapu,
sufit ścieżki. Lista, która potrafi się tylko wydłużać, prędzej czy później stanie się
źródłem poczucia winy — niezależnie od tego, jak łagodne jest copy.

Funkcją, która chroni odpoczynek najbardziej wprost, jest **dzień pusty** (`P4`), bo jest
proaktywna: nie jest narzędziem ratunkowym po załamaniu, tylko powtarzalną deklaracją, że
w tygodniu istnieje dzień, w którym aplikacja nie prosi o nic. Cichy tydzień (`P15`) jest
jej reaktywnym uzupełnieniem, a sufit budżetowy — strukturalnym.

I jedna rzecz, której w tym dokumencie nie ma i nie powinno być: nagrody za odpoczynek.
Odznaka za dzień pusty zamieniłaby odpoczynek w kolejne zadanie, a to jest dokładnie ten
mechanizm, przed którym się bronisz.
