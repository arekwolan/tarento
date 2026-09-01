# CLAUDE.md — Tarento

Instrukcja dla Claude Code pracującego w tym repozytorium. Obowiązuje w całym
projekcie. Jeśli coś tutaj jest sprzeczne z domyślnym nawykiem modelu — wygrywa
ten plik. Jeśli coś tutaj jest sprzeczne z rzeczywistością kodu — zgłoś to,
zamiast po cichu obchodzić.

---

## 1. Produkt

**Tarento** — mobilny asystent rozwoju osobistego na iOS i Androida.

**Dla kogo:** osoby, które chcą zbudować codzienne nawyki i utrzymać regularność,
ale odbijają się od rozbudowanych aplikacji produktywnościowych. Tarento ma być
lekki: otwierasz, widzisz jedną listę na dziś, odhaczasz, zamykasz. Każda funkcja,
która wydłuża tę ścieżkę, wymaga uzasadnienia.

### Stan zaimplementowany

**Ostatnia weryfikacja: 2026-08-31.** Poniższa lista opisuje kod i migracje,
nie pierwotny zakres MVP:

- ekran „Dzisiaj” z trwałym snapshotem planu, budżetem minut,
  `planned`/`overflow`, odpoczynkiem, quiet week, cytatem, notatką dnia,
  listami do przyszłego siebie i jednorazowym przygotowaniem etapu;
- nawyki z przypomnieniami, historią wykonań, seriami, wersjami zachowania,
  mapą tarcia, downshiftem, emeryturą i osobistym eksperymentem A/B;
- statystyki i historia: tempo, obserwacje, prognozy, adherence, mapa dni,
  ukończone oraz świadomie emerytowane praktyki;
- jedna aktywna ścieżka lub protokół: katalog, etapy, czytania, pauza/powrót,
  transfer do życia, zakończenie i prywatne protokoły z notatek;
- Biblioteka uporządkowana jako „Kontynuuj / Zacznij / Narzędzia /
  Do refleksji / Zakończone”;
- pomoc AI wyłącznie po stronie serwera: sugestia nawyku, downshift,
  dopasowanie ścieżki, prywatny draft protokołu oraz semantyczna sugestia
  konfliktu; `/plan` i `generate-daily-plan` pozostają trasą kompatybilności,
  ale nie są głównym wejściem w Bibliotece;
- konto i synchronizacja Supabase, RLS, persystowany cache offline, eksport
  danych, lokalne powiadomienia oraz interfejs PL/EN.

### Kierunek i backlog

Planów nie dopisujemy tutaj jako stanu produktu. Decyzje i starszy plan prac
są w [IDEAS.md](IDEAS.md), a nowszy audyt oraz prompty wdrożeniowe w
[IDEAS_GPT.md](IDEAS_GPT.md). Sam wpis lub prompt w tych plikach nie oznacza,
że funkcja istnieje — stan zawsze potwierdzaj trasą, modułem i migracją.

### Zespół

Jedna osoba. Preferuj rozwiązania proste i utrzymywalne w pojedynkę: mało
zależności, mało warstw abstrakcji, czytelność ponad sprytność. Nie wprowadzaj
wzorca "na zapas" dla wymagania, którego jeszcze nie ma.

### Język

Interfejs domyślnie polski. Architektura od pierwszego dnia przygotowana pod
angielski: wszystkie teksty przez warstwę i18n, zero stringów w komponentach.

---

## Protokół raportowania

Po zakończeniu zadania NIE podsumowuj tego, co zaimplementowałeś.
Nie wypisuj listy zmienionych plików. Nie tłumacz podjętych decyzji.
Nie opisuj działania kodu. Nie proponuj kolejnych kroków. Nie pisz sekcji
typu "Summary", "Co zrobiłem", "Kluczowe zmiany", "Next steps" ani ich
odpowiedników.

Jeśli wszystko wykonano zgodnie z instrukcją, odpowiedz dokładnie tak:

    Gotowe — zgodnie z planem.

Jeśli zadanie miało kryteria weryfikacji (typecheck, testy, lint, build,
migracje), dopisz drugą linię z surowym wynikiem, bez komentarza:

    typecheck: OK | testy: 14/14 | lint: 0 błędów

Wyjaśniaj TYLKO wtedy, gdy zachodzi co najmniej jedno z poniższych:

- czegoś nie dało się zrobić zgodnie z instrukcją
- odstąpiłeś od instrukcji lub zaimplementowałeś coś inaczej
- instrukcja nie rozstrzygała czegoś istotnego i podjąłeś własną decyzję
- zostały błędy, ostrzeżenia albo nieprzechodzące testy
- potrzebujesz mojej decyzji, żeby kontynuować
- zauważyłeś problem, który wpłynie na kolejne zadania

Wtedy napisz zwięźle i wyłącznie o tym, co odbiega od planu: co poszło nie
tak, co zrobiłeś zamiast tego, czego potrzebujesz ode mnie. Nie dołączaj
opisu części, które poszły dobrze.

Jeśli chcę wyjaśnień, poproszę o nie osobno.
Ta zasada obowiązuje w każdej sesji i nie wymaga przypominania.

---

## 2. Stack

| Obszar             | Technologia                                       | Wersja          |
| ------------------ | ------------------------------------------------- | --------------- |
| Platforma          | Expo SDK                                          | 57              |
| Runtime            | React Native                                      | 0.86            |
| UI                 | React                                             | 19.2            |
| Język              | TypeScript (`strict: true`)                       | 6.0.x           |
| Routing            | Expo Router (file-based)                          | zgodna z SDK 57 |
| Stylowanie         | NativeWind                                        | v4              |
| Backend            | Supabase — Postgres, Auth, RLS, Edge Functions    | —               |
| Stan serwerowy     | TanStack Query                                    | v5              |
| Persystencja cache | `react-native-mmkv` (persister do TanStack Query) | —               |
| Formularze         | `react-hook-form` + `zod`                         | —               |
| Powiadomienia      | `expo-notifications` (lokalne)                    | —               |
| Kroje              | `expo-font` + `@expo-google-fonts/*` (statyczne)  | —               |

Docelowo iOS + Android. Web nie jest wspierany — nie dodawaj kodu ani
zależności tylko po to, żeby coś działało na webie.

API Expo zmienia się między wersjami SDK. Zanim napiszesz kod dotykający
Expo Router, Reanimated czy konfiguracji, sprawdź wersjonowaną dokumentację:
https://docs.expo.dev/versions/v57.0.0/ — nie pamięć modelu.

---

## 3. Konwencje kodu

### TypeScript

- `strict: true`, **zero `any`**. Dla nieznanych kształtów `unknown` + zawężenie.
- Dane wchodzące z zewnątrz (Supabase, API, MMKV, deep linki, payload
  powiadomień) walidujemy przez `zod`. Typ pochodzi ze schematu (`z.infer`),
  nie odwrotnie.
- `@ts-ignore` jest zakazane. `@ts-expect-error` tylko z komentarzem
  wyjaśniającym powód i warunek usunięcia.
- Bez asercji `as` na skróty. `as const` i zawężanie typów są w porządku.

### Komponenty i pliki

- Wyłącznie komponenty funkcyjne.
- Nazwy komponentów: `PascalCase`. Nazwy plików: `kebab-case`.
  `src/features/habits/components/habit-row.tsx` eksportuje `HabitRow`.
- Hooki: plik `use-habits.ts`, eksport `useHabits`.
- Wyjątek: pliki tras w `app/` nazywamy według konwencji Expo Router
  (`_layout.tsx`, `+not-found.tsx`, `(tabs)/index.tsx`).
- Każdy feature ma `index.ts` z publicznym API. Import z zewnątrz idzie przez
  `@/features/habits`, nie w głąb jego katalogów.

### Importy

- Wszystko przez alias `@/` (mapowany na `src/`). Żadnych `../../..`.
- Kolejność: pakiety zewnętrzne → `@/` → względne (tylko wewnątrz feature'a).

### Teksty

- **Każdy** tekst widoczny dla użytkownika przechodzi przez i18n: `t('today.empty')`.
  Dotyczy też komunikatów błędów, placeholderów, tytułów ekranów, treści
  powiadomień i etykiet dostępności.
- Klucze żyją w `src/i18n/locales/pl.json` i `en.json`. Oba pliki aktualizujemy
  w tym samym commicie — `en.json` nie może zostać z brakującym kluczem.
- Klucze są typowane: brakujący klucz ma wywalać typecheck, a nie renderować się
  jako surowy string.

### Architektura

- **Logika biznesowa mieszka w `src/features/*/`, nie w komponentach ekranów.**
  Plik w `app/` składa komponenty, woła hooki feature'a i obsługuje nawigację.
  Jeśli w pliku z `app/` pojawia się liczenie serii, mapowanie wierszy
  z Postgresa albo warunek biznesowy — jest w złym miejscu.
- Stan serwerowy: wyłącznie TanStack Query. Bez ręcznego `useEffect` + `useState`
  do pobierania danych. Klucze zapytań w `features/*/api/keys.ts`.
- Zapytania do Supabase tylko w `features/*/api/`. Komponenty nigdy nie dotykają
  klienta Supabase bezpośrednio.
- Formularze: `react-hook-form` + `zodResolver`. Schemat `zod` jest jedynym
  źródłem prawdy o kształcie i walidacji formularza.
- Stylowanie: NativeWind (`className`). `StyleSheet.create` tylko tam, gdzie
  NativeWind nie wystarcza (np. style animowane przez Reanimated).
- Nazewnictwo danych: w Postgresie `snake_case`, w TypeScripcie `camelCase`.
  Mapowanie robi warstwa `api/` feature'a, nie komponent.

---

## 4. Mapa kodu

Mapa odzwierciedla repozytorium zweryfikowane 2026-08-31. Nie jest listą
planowanych plików.

### Trasy Expo Router

| Obszar             | Trasy                                                           |
| ------------------ | --------------------------------------------------------------- |
| Auth               | `/(auth)/welcome`, `/sign-in`, `/sign-up`, `/forgot-password`   |
| Onboarding         | `/(onboarding)/`, `/day-shape`, `/habits`, `/reminders`         |
| Zakładki           | `/` (Dzisiaj), `/stats`, `/library`, `/settings`                |
| Nawyki             | `/habit/new`, `/habit/[id]`                                     |
| Ścieżki            | `/paths`, `/paths/[slug]`, `/paths/[slug]/readings/[readingId]` |
| Prywatne protokoły | `/book-lab`                                                     |
| Pozostałe          | `/privacy`, `/plan` (legacy/kompatybilność)                     |

### Moduły domenowe

`src/features/` zawiera: `ai-plan`, `analytics`, `auth`, `book-lab`,
`conflict-radar`, `data-export`, `day-budget`, `experiments`, `friction`,
`habits`, `journal`, `letters`, `library`, `notifications`, `paths`, `quotes`,
`self-knowledge`, `stats` i `templates`.

Funkcje brzegowe w `supabase/functions/`: `generate-daily-plan`,
`suggest-habit`, `suggest-downshift`, `suggest-path-fit`, `book-lab` oraz
`protocol-conflicts`. Wspólny kod i testowe fixture'y żyją odpowiednio w
`_shared/` i `__fixtures__/`.

Pozostałe stałe miejsca: `src/components/ui/` (współdzielone UI), `src/lib/`
(infrastruktura i czas), `src/i18n/locales/` (PL/EN), `src/theme/` (tokeny),
`src/types/database.ts` (typy bazy), `supabase/migrations/` (schema + RLS) oraz
`supabase/tests/` (pgTAP).

Zasada: **`app/` jest cienkie, `src/features/` jest grube.** Jeśli ekran rośnie,
przenosimy logikę do feature, a nie dzielimy pliku trasy na kolejne pliki tras.

### Utrzymanie dokumentacji

Dodanie, usunięcie lub zmiana nazwy trasy, tabeli albo Edge Function wymaga
w tej samej zmianie aktualizacji mapy w `CLAUDE.md` i skrótu w `README.md`.
Zmiana stanu pomysłu aktualizuje odpowiedni status w `IDEAS.md` lub
`IDEAS_GPT.md`. Nie zapisuj w dokumentacji stałej liczby testów — raportuj
wynik konkretnego uruchomienia.

---

## 5. System designu

Pełna referencja tokenów: [docs/design-system.md](docs/design-system.md).
Brief źródłowy: [docs/design-system-brief.md](docs/design-system-brief.md).
Poniżej to, co musisz mieć w głowie, zanim napiszesz pierwszą linię widoku.

### Kierunek wizualny

Chłodna baza grafitowa i jeden ciepły akcent w kolorze mosiądzu; interfejs jest
prawie monochromatyczny. Kolor pojawia się wyłącznie tam, gdzie niesie
informację o postępie — wykonany nawyk, seria, mapa dni — dzięki czemu jedno
spojrzenie na ekran mówi „ile dziś zrobiłem", bez czytania. Przycisk główny nie
jest kolorowy, tylko maksymalnie kontrastowy, a czerwień istnieje wyłącznie przy
akcjach niszczących. Zero gradientów, zero neonów, zero cieni kolorowych, zero
emoji jako nośnika stanu. Motyw ciemny jest projektowany pierwszy, nie doklejany
— aplikacja jest używana wieczorem.

### Tokeny kolorów

Nazwy są semantyczne. W kodzie widoku nie ma wartości, tylko token: klasa
(`bg-surface`, `text-secondary`, `border-border`) albo `color()` z `useTheme()`
tam, gdzie React Native wymaga wartości (tab bar, `tintColor`, `ActivityIndicator`).

| Token              | Ciemny      | Jasny     | Do czego                                  |
| ------------------ | ----------- | --------- | ----------------------------------------- |
| `background`       | `#131619`   | `#F5F6F7` | tło ekranu                                |
| `surface`          | `#1A1E22`   | `#FFFFFF` | karta, wiersz listy                       |
| `surface-elevated` | `#22272C`   | `#FFFFFF` | karta uniesiona, arkusz, toast            |
| `surface-sunken`   | `#0E1114`   | `#EDEFF1` | tor paska postępu, pasek offline          |
| `border`           | `#2C3238`   | `#E0E3E6` | obrys domyślny                            |
| `border-strong`    | `#3D454C`   | `#C6CBD0` | obrys niosący znaczenie, dziś w mapie dni |
| `text-primary`     | `#ECEFF1`   | `#16181A` | tekst główny                              |
| `text-secondary`   | `#9BA5AD`   | `#575F66` | tekst drugorzędny                         |
| `text-tertiary`    | `#7B858D`   | `#7A838A` | metadane — nigdy akapit (kontrast 3:1)    |
| `accent`           | `#C9922B`   | `#7A5A12` | akcent jako tekst i ikona                 |
| `accent-strong`    | `#DDA63C`   | `#5F450E` | akcent wzmocniony                         |
| `accent-fill`      | `#C9922B`   | `#C9922B` | akcent jako wypełnienie                   |
| `accent-muted`     | `#2E2716`   | `#F5EAD2` | tło pod treścią akcentowaną               |
| `on-accent`        | `#16181A`   | `#16181A` | tekst na wypełnieniu akcentem             |
| `action`           | `#ECEFF1`   | `#16181A` | tło przycisku głównego                    |
| `on-action`        | `#131619`   | `#F5F6F7` | etykieta przycisku głównego               |
| `success`          | `#5E9C76`   | `#2F6B47` | potwierdzenie                             |
| `warning`          | `#C2683A`   | `#9A4E23` | ostrzeżenie                               |
| `danger`           | `#C0524F`   | `#B4322E` | wyłącznie akcja niszcząca                 |
| `scrim`            | `#0E1114`   | `#16181A` | przyciemnienie pod arkuszem               |
| `streak-0`…`4`     | patrz niżej | —         | mapa dni                                  |

Skala serii — jedyne miejsce z pełnym nasyceniem akcentu:

| Poziom | Ciemny    | Jasny     | Znaczenie                     |
| ------ | --------- | --------- | ----------------------------- |
| 0      | `#22272C` | `#E7EAEC` | brak danych / dzień pominięty |
| 1      | `#3A3320` | `#F0E3C2` | do 25% dziennych nawyków      |
| 2      | `#574728` | `#E2C782` | do 50%                        |
| 3      | `#8C6A26` | `#CFA746` | powyżej 50%, ale nie komplet  |
| 4      | `#C9922B` | `#A97D1E` | 100%                          |

W motywie jasnym mosiądz `#C9922B` ma za mały kontrast na tekst: jako tekst
i ikony idzie wyłącznie `accent`, jako wypełnienie — `accent-fill`. Nie
zamieniaj tego miejscami.

### Typografia

Kroje: **IBM Plex Sans** (400/500/600) na wszystko, **Literata** (400) wyłącznie
na cytaty, **IBM Plex Mono** (500) na liczby. Plex ma bezbłędną diakrytykę
i cyfry tabelaryczne; Literata to krój książkowy, a cytaty pochodzą z książek,
więc krój niesie znaczenie, a nie dekorację; mono daje wyrównanie kolumn liczb
za darmo. Wyłącznie statyczne `.ttf` — waga siedzi w nazwie rodziny, bo
`fontWeight` na statycznym kroju daje syntetyczne pogrubienie. Dlatego
`theme.fontWeight` w Tailwindzie jest **wyłączone** i `font-bold` nie istnieje.

| Wariant   | Rozmiar / interlinia | Tracking | Krój         | Zastosowanie                  |
| --------- | -------------------- | -------- | ------------ | ----------------------------- |
| `display` | 34 / 40              | −0.5     | sans 600     | duża liczba na statystykach   |
| `titleLg` | 26 / 32              | −0.3     | sans 600     | tytuł ekranu                  |
| `title`   | 19 / 25              | −0.1     | sans 600     | tytuł sekcji / karty          |
| `bodyLg`  | 17 / 25              | 0        | sans 400     | nazwa nawyku na liście        |
| `body`    | 15 / 22              | 0        | sans 400     | domyślny tekst                |
| `caption` | 13 / 18              | 0        | sans 400     | podpisy, metadane             |
| `label`   | 13 / 16              | +0.2     | sans 500     | przyciski, zakładki, etykiety |
| `quote`   | 22 / 34              | 0        | Literata 400 | wyłącznie cytat               |
| `numLg`   | 28 / 32              | 0        | mono 500     | licznik serii                 |
| `num`     | 13 / 18              | 0        | mono 500     | daty i liczby w zestawieniach |

Lista jest zamknięta. Nowy rozmiar powstaje przez zmianę
`src/theme/typography.ts` **i** `tailwind.config.js` — parzystości pilnuje test.
Zakaz rozmiaru poniżej 13. Zakaz wersalików: polskie słowa są długie,
a diakrytyka w wersalikach czyta się źle. Polskie etykiety są o 15–20% dłuższe
niż angielskie — żadnych przycisków o stałej szerokości, nazwa nawyku może
zawijać się do dwóch linii.

### Odstępy i promienie

Baza 4: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72` (klasa to krok × 4, więc
`p-5` = 20). Poza tą skalą istnieje `12` = 48 dp — minimalny cel dotykowy —
oraz kroki 16–32 zarezerwowane na wymiary szkieletów, nie na odstępy.

- margines poziomy ekranu **20**, ustawia go `<Screen>`, nie ekran,
- odstęp między kartami **12**, między sekcjami **32**.

Promienie: `xs 8` (kwadraty mapy dni, szkielety), `sm 12` (pola, chipy),
`md 18` (przyciski, karty, toast), `lg 28` (bottom sheet, karta uniesiona),
`xl 36` (płaszczyzny pełnoekranowe), `full` — wyłącznie znaczniki i paski,
nigdy karta ani pole.

Każda płaszczyzna z promieniem dostaje `CONTINUOUS_CURVE` z `@/theme/radii`
(krzywizna ciągła, prop iOS-owy — na Androidzie róg zostaje kołowy).
Element wstawiony w płaszczyznę z promieniem nie ustala swojego promienia
sam: `Card` i `Sheet` podają go przez `SurfaceRadiusProvider`, a `Button`,
`TextField` i `Chip` czytają przez `useControlRadius()`. Nowa kontrolka
z własnym promieniem ma robić to samo — inaczej jej róg odkleja się od rogu
karty i widać, że oba kształty nie należą do siebie.

Głębia (`src/theme/elevation.ts`): hierarchia **nie wynika z kresek**.
W ciemnym niesie ją płaszczyzna tonalna plus świetlna krawędź górna (`edge`
przy kryciu 0.06–0.09, sufit 0.12); cień dostaje tam wyłącznie arkusz i toast.
W jasnym niesie ją płaszczyzna plus miękki cień, bo biała krawędź na białym
tle niczego nie rysuje.

Obrys jest wyjątkiem, nie stanem domyślnym. Karta ma go tylko w wariancie
`outlined`, gdzie coś znaczy. Pola, chipy i karty wyboru zachowują obrys —
tam niesie afordancję: w spoczynku `hairline`, w stanie aktywnym
`border-strong`. `hairline` i `border` mają dziś tę samą wartość, ale różne
znaczenie: pierwszy rozdziela, drugi informuje.

### Ruch i haptyka

Czasy: `fast 140ms`, `base 220ms`, `slow 320ms`. Wejścia
`cubic-bezier(0.22, 1, 0.36, 1)`, przesunięcia `cubic-bezier(0.4, 0, 0.2, 1)`.
Wartości są w `src/theme/motion.ts` — nie wpisuj ich lokalnie.

Tylko Reanimated, żadnej innej biblioteki animacji. Sprężyna jest dozwolona
w **jednym** miejscu: potwierdzenie odhaczenia nawyku (`damping 18`,
`stiffness 220`). Każda animacja sprawdza `useReducedMotion()` — przy włączonej
redukcji zostaje wyłącznie zmiana `opacity`, bez transformacji. Stan wciśnięcia
(`opacity 0.9` + `scale 0.98`) bierz z `usePressClass()`, który sam wycina skalę.

Haptyka (`expo-haptics`): odhaczenie → `impactAsync(Light)`, cofnięcie →
`selectionAsync()`, kamień milowy serii (7 / 30 / 100 dni) →
`notificationAsync(Success)` maksymalnie raz na zdarzenie. Nigdy przy
przewijaniu, nigdy przy zwykłej nawigacji.

### Użyteczność

1. Akcje codzienne leżą w dolnych 2/3 ekranu. Odhaczanie nigdy w prawym górnym rogu.
2. Cały wiersz nawyku jest klikalny, nie sam znacznik. Cel dotykowy ≥ 48×48 dp.
3. **Cofnij zamiast potwierdzaj**: akcję odwracalną wykonaj od razu i pokaż
   `useToast()` z akcją „Cofnij" (5 s). `Alert.alert` zostaje wyłącznie dla
   operacji nieodwracalnych (usunięcie konta, wylogowanie gościa).
4. Optimistic UI. Aplikacja ma działać w metrze bez zasięgu.
5. Cztery stany każdego widoku danych: ładowanie (skeleton w kształcie
   docelowej treści, nie spinner), pusto (jedno zdanie + jedno CTA), błąd
   (co się stało + co zrobić), offline (dyskretny pasek, bez blokowania ekranu).
6. Bottom sheet (`<Sheet>`) zamiast pełnoekranowego modala dla akcji na
   jednym–dwóch polach.
7. Jedna akcja główna na ekran. Reszta to `secondary` / `ghost`.
8. Motyw sterowany systemem, z ręcznym nadpisaniem w ustawieniach.

### Strażnicy

`eslint.config.js` blokuje w `app/**`, `src/features/**` i `src/components/**`:
literał koloru, arbitralny kolor w klasie (`bg-[#…]`), klasę z domyślnej palety
Tailwinda, wersaliki oraz import `Text` z `react-native`. Tailwind ma
**nadpisane**, nie rozszerzone skale, więc `text-sm`, `p-7` i `bg-blue-500`
nie istnieją. Jeśli reguła Ci przeszkadza, to zwykle znaczy, że brakuje tokenu —
dodaj token, nie wyjątek.

---

## 6. Reguły krytyczne

Naruszenie którejkolwiek z poniższych to błąd blokujący, nie "drobiazg do
poprawienia później". Jeśli zadanie wydaje się wymagać złamania reguły —
zatrzymaj się i zapytaj.

### 1. NIGDY nie umieszczaj kluczy API w kodzie klienta ani w zmiennych `EXPO_PUBLIC_*`

Bundle aplikacji mobilnej jest w całości odczytywalny — `EXPO_PUBLIC_*` to
publikacja, nie konfiguracja. Sekrety (klucz Gemini API, `service_role` Supabase,
tokeny dostawców) trzymamy w sekretach Supabase Edge Functions i wywołujemy je
z klienta przez funkcję. Klient wysyła intencję, nigdy klucz.

Dozwolone w `EXPO_PUBLIC_*`:

1. URL projektu Supabase i klucz `anon` — wyłącznie dlatego, że dostęp do
   danych pilnuje RLS (reguła 3).
2. Klucze telemetrii **tylko do zapisu**: DSN Sentry i klucz projektowy
   PostHog. Pozwalają wysłać zdarzenie i nic poza tym — nie odczytają
   żadnych danych, więc ich obecność w bundlu nie tworzy powierzchni ataku.

Nic poza tymi dwoma punktami. Jeśli kluczem da się cokolwiek **odczytać**,
nie ma go w kliencie — idzie do sekretów Edge Functions.

### 2. NIGDY nie używaj `new Date()` bezpośrednio do wyznaczania "dzisiaj"

Zawsze `getLogicalToday()` z `@/lib/date`.

"Dzisiaj" w Tarento to doba **logiczna**, nie kalendarzowa: użytkownik
odhaczający nawyk o 1:30 w nocy nadal domyka poprzedni dzień. Do tego dochodzą
strefy czasowe, zmiana czasu i serie, które muszą liczyć się identycznie na
kliencie i na serwerze. `new Date()` rozjeżdża te przypadki po cichu — błąd
ujawnia się dopiero jako zerwana seria u użytkownika.

Cała arytmetyka dat (granice doby, różnice, formatowanie) mieszka w
`@/lib/date`. W kodzie feature i komponentów nie ma bezpośredniego `new Date()`,
`Date.now()` ani ręcznego liczenia na milisekundach.

### 3. Każda tabela w Supabase musi mieć włączone RLS

`alter table <t> enable row level security;` **oraz** komplet polityk trafiają do
tej samej migracji, w której tabela powstaje. Nigdy "polityki dodamy później":
tabela z włączonym RLS bez polityk wygląda na bezpieczną i nie działa, a tabela
bez RLS jest publiczna dla każdego, kto ma klucz `anon`.

Domyślna polityka: użytkownik widzi i modyfikuje wyłącznie własne wiersze
(`auth.uid() = user_id`). Odstępstwo wymaga świadomej decyzji i komentarza
w migracji.

### 4. Nie usuwamy rekordów fizycznie

Zamiast `delete` ustawiamy `archived_at = now()`. Historia napędza serie i
statystyki — skasowany wiersz cofa użytkownikowi przeszłość.

Konsekwencje, o których trzeba pamiętać przy każdym zapytaniu:

- każdy odczyt filtruje `archived_at is null` (chyba że celowo pokazuje archiwum),
- indeksy i ograniczenia unikalności uwzględniają `archived_at`,
- "usuń" w UI oznacza archiwizację i tekst dla użytkownika ma to odzwierciedlać.

### 5. NIGDY nie używaj wartości koloru wprost — tylko tokeny semantyczne

Hex w komponencie żyje własnym życiem: nie zna motywu jasnego, nie zna zmiany
palety i nie da się go znaleźć, gdy trzeba przesunąć odcień. Kolor bierzesz
z klasy (`bg-surface`, `text-secondary`) albo z `color()` z `useTheme()`, gdy
React Native wymaga wartości. Wartości mieszkają w `global.css`
i `src/theme/palette.ts` — nigdzie indziej.

### 6. NIGDY nie importuj `Text` z `react-native` w ekranach i feature'ach

Używaj `<Text>` z `@/components/ui`. Tylko on zna skalę typografii, tokeny
kolorów, rodzinę kroju, cyfry tabelaryczne i `allowFontScaling`. Surowy
`<Text>` renderuje krój systemowy i rozmiar spoza skali, a wygląda przy tym
zupełnie normalnie — dlatego pilnuje tego ESLint, a nie code review.

### 7. NIGDY nie oznaczaj pominiętego dnia ani przerwanej serii kolorem `danger`

Pominięty dzień ma poziom 0 w mapie serii, czyli wygląda tak samo jak dzień bez
danych. Czerwień jest zarezerwowana dla akcji niszczących. Tarento jest
aplikacją rozwojową, nie tresurą: nie ma „Straciłeś serię", jest „Nowa seria
zaczyna się dziś".

### 8. Akcent rezerwujemy dla stanu wykonania i postępu

Mosiądz oznacza: odhaczony nawyk, seria, pasek postępu, mapa dni. Nie oznacza
przycisku, nagłówka, zakładki, ikony dekoracyjnej ani zaznaczonego filtra —
tam hierarchię niesie kontrast (`action` / `border-strong`). Jeśli akcent trafia
na coś, co nie mówi o postępie, ekran przestaje być czytelny jednym spojrzeniem.

### 9. Każdy nowy ekran opakowany w `<Screen>` i obsługujący cztery stany

`<Screen>` daje tło, safe areę, margines 20 i odstęp 12 — ekran ich nie ustawia
sam. Cztery stany to loading (skeleton), empty (jedno zdanie + jedno CTA),
error (co się stało + co zrobić) i offline (dyskretny `<Banner>`). Widok danych
bez któregoś z nich jest niedokończony, a nie „do dopisania później".

### 10. NIGDY nie wysyłaj powiadomienia, którego użytkownik sam nie ustawił

Dozwolone jest wyłącznie jedno: przypomnienie o nawyku o godzinie ustawionej
przez użytkownika. Zakazane są przypomnienia o powrocie, podsumowania
tygodnia, informacje o serii, komunikaty produktowe i cokolwiek
marketingowego. Aplikacja odzywa się wtedy, kiedy jej kazano, i nigdy indziej.

Dotyczy to także ciszy: cichy tydzień wycisza przypomnienia i **nie**
informuje o tym powiadomieniem. Jedyny ślad zostaje w ustawieniach, dla
kogoś, kto sam tam zajrzy.

Praktycznie: `scheduleNotificationAsync` wolno wołać wyłącznie z
`src/features/notifications/api/notifications-api.ts`, wyłącznie dla
`PlannedReminder`. Każde inne wywołanie jest naruszeniem tej reguły.

---

## 7. Komendy

Codzienna praca to jedno polecenie: `npm run dev`. Reszta tabeli jest na
sytuacje szczególne. Instrukcja krok po kroku dla osoby bez doświadczenia
z React Native leży w [URUCHAMIANIE.md](URUCHAMIANIE.md).

| Cel               | Komenda                 | Co uruchamia                                                               |
| ----------------- | ----------------------- | -------------------------------------------------------------------------- |
| Dev               | `npm run dev`           | `scripts/dev.mjs` — wymagania, baza, `.env.local`, migracje, Metro         |
| Dev na Androidzie | `npm run android`       | to samo z flagą `--android`                                                |
| Dev na iOS        | `npm run ios`           | to samo z flagą `--ios` (tylko macOS)                                      |
| Diagnostyka       | `npm run doctor`        | `scripts/doctor.mjs` — tabela OK/BŁĄD + komendy naprawcze                  |
| Dane demo         | `npm run seed:demo`     | `scripts/seed-demo.mjs` — konto testowe z 30 dniami historii               |
| Import cytatów    | `npm run quotes:import` | `scripts/import-quotes.mjs` — `supabase/data/quotes.csv` → tabela `quotes` |
| Lint              | `npm run lint`          | `eslint . --max-warnings=0`                                                |
| Format            | `npm run format`        | `prettier --write .`                                                       |
| Typy              | `npm run typecheck`     | `tsc --noEmit`                                                             |
| Testy             | `npm run test`          | `jest` (preset `jest-expo`)                                                |
| Testy E2E         | `npm run test:e2e`      | `maestro test .maestro`                                                    |
| Regresja promptów | `npm run prompt:test`   | fixture'y dla zarejestrowanych promptów; `-- --dry-run` działa bez modelu  |

Buildy:

| Cel                         | Komenda                     | Co uruchamia                                                    |
| --------------------------- | --------------------------- | --------------------------------------------------------------- |
| Development build lokalnie  | `npm run devbuild:android`  | `expo run:android` — buduje i instaluje na emulatorze/telefonie |
|                             | `npm run devbuild:ios`      | `expo run:ios` (tylko macOS)                                    |
| Development build w chmurze | `npm run build:dev:android` | `eas build --platform android --profile development`            |
|                             | `npm run build:dev:ios`     | `eas build --platform ios --profile development`                |
| Produkcja                   | `npm run build:ios`         | `eas build --platform ios --profile production`                 |
|                             | `npm run build:android`     | `eas build --platform android --profile production`             |

Baza (Supabase CLI, wymaga działającego Dockera):

| Cel                 | Komenda            | Co uruchamia                                                    |
| ------------------- | ------------------ | --------------------------------------------------------------- |
| Start lokalnej bazy | `npm run db:start` | `supabase start`                                                |
| Stop                | `npm run db:stop`  | `supabase stop`                                                 |
| Reset + migracje    | `npm run db:reset` | `supabase db reset`                                             |
| Typy z bazy         | `npm run db:types` | `supabase gen types typescript --local > src/types/database.ts` |

Flagi `npm run dev` (po podwójnym myślniku, inaczej npm zatrzyma je dla siebie):

| Flaga       | Działanie                                                          |
| ----------- | ------------------------------------------------------------------ |
| `--android` | otwiera emulator albo podłączony telefon z Androidem               |
| `--ios`     | otwiera symulator iOS; na Windowsie przerywa z wyjaśnieniem        |
| `--device`  | wymusza adres LAN komputera, nawet gdy widać emulator              |
| `--host=IP` | ręcznie podany adres komputera, gdy wykrywanie się myli            |
| `--reset`   | `supabase db reset` + seed, po potwierdzeniu wpisanym z klawiatury |

### Czego skrypty pilnują za Ciebie

`dev.mjs` odczytuje adres i klucz `anon` z `supabase status` i zapisuje je do
`.env.local` przy każdym uruchomieniu. Kluczy nie przepisujemy ręcznie i nie
trzymamy ich w repo. Pliku `.env` celowo nie ma: Expo czyta `.env.local` jako
ważniejszy, więc wartości z `.env` byłyby po cichu ignorowane — a to najgorszy
rodzaj błędu konfiguracji.

Adres bazy zależy od tego, gdzie działa aplikacja: `127.0.0.1` dla symulatora
iOS, `10.0.2.2` dla emulatora Androida, adres LAN komputera dla fizycznego
telefonu. Skrypt rozpoznaje cel i wpisuje właściwy adres sam.

`seed-demo.mjs` i `import-quotes.mjs` sięgają po klucz `service_role` z
`supabase status` i trzymają go wyłącznie w pamięci procesu — nigdy w pliku
(reguła krytyczna 1). Oba są idempotentne.

Skrypty odpalają Supabase CLI, Expo i `tsc` przez `process.execPath`, nie przez
`npx` — na Windowsie spawn na plikach `.cmd` wymaga shella i wykłada się na
ścieżkach ze spacjami.

### Rzeczy, które zaskakują

Porty lokalnego stacka są przesunięte z domyślnych `543xx` na `553xx` — na
Windowsie zakres 54313–54412 bywa zarezerwowany przez Hyper-V i Docker nie może
się do niego podbić. Wartości siedzą w `supabase/config.toml`.

`db:types` celuje w bazę lokalną. Po podpięciu projektu zdalnego przełącz na
`--linked`, żeby typy szły ze schematu produkcyjnego.

Expo Go nie uruchomi tego projektu: `react-native-mmkv`, `expo-notifications`
i Sentry to moduły natywne spoza Expo Go. Potrzebny jest development build —
stąd `expo-dev-client` w zależnościach i flaga `--dev-client`, którą `dev.mjs`
dokłada sam.

`expo-env.d.ts` i `.expo/types/` są generowane przez `expo start` i nie trafiają
do repo. Po świeżym klonie uruchom `npm run dev` raz, zanim odpalisz `typecheck`.

---

## 8. Definicja ukończenia

Zanim uznasz zadanie za zrobione:

1. `npm run typecheck` przechodzi — bez wyjątków i bez wyciszeń.
2. `npm run lint` przechodzi.
3. Nowe teksty UI mają klucze w `pl.json` **i** `en.json`.
4. Nowa tabela ma migrację z włączonym RLS i politykami.
5. Czysta logika domenowa (serie, granice doby) ma test; reszta testów wg potrzeby.
6. Jeśli zadanie dotykało interfejsu — lista z §9 przechodzi w całości.
7. Zmiana jakiegokolwiek promptu w `supabase/functions/` wymaga uruchomienia
   `npm run prompt:test` i załączenia wyniku. Dotyczy to instrukcji systemowych,
   funkcji budujących wiadomość użytkownika, schematów odpowiedzi i reguł
   walidatora — czyli wszystkiego, co zmienia to, co model dostaje albo co
   wolno mu oddać. Bez tego zmiana jednego zdania jest zmianą, której skutków
   nikt nie widzi aż do zgłoszenia użytkownika.

Raportuj stan zgodnie z prawdą: jeśli test nie przechodzi albo krok został
pominięty, napisz to wprost razem z outputem.

### Reguła kolumny

Żadne pytanie w onboardingu nie zostaje, jeśli nie umiesz wskazać kolumny,
do której zapisuje. Quiz osobowości, pytanie o „typ poranny/wieczorny",
ankieta o celach — wszystko to daje wrażenie personalizacji i nie produkuje
niczego, czego aplikacja używa. Trzy pytania o kształt dnia zapisują do
trzech tabel; „Jesteś rannym ptaszkiem?" nie zapisuje do niczego.

Reguła obowiązuje przy każdym nowym ekranie, nie tylko w onboardingu:
pole, którego nikt nie odczyta, jest kosztem dla użytkownika i długiem
dla Ciebie.

### Pytaj przed zrobieniem

- dodanie nowej zależności do `package.json`,
- zmiana `app.config.ts`, uprawnień natywnych lub konfiguracji EAS,
- migracja uruchamiana na zdalnym projekcie Supabase,
- zmiana kształtu istniejącej tabeli, na której opierają się serie.

---

## 9. Definition of done dla UI

Przejdź tę listę przed zamknięciem każdego zadania dotykającego interfejsu.

```
[ ] tylko tokeny semantyczne, zero hexów i surowych rozmiarów
[ ] sprawdzone w motywie ciemnym i jasnym
[ ] layout nie łamie się przy fontScale 1.3
[ ] cele dotykowe >= 48x48 dp
[ ] stany: loading (skeleton) / empty / error / offline
[ ] teksty w pl.json i en.json, zero stringów w JSX
[ ] Reduce Motion obsłużone
[ ] czerwień tylko przy akcji niszczącej
[ ] akcja odwracalna przez "Cofnij", nie przez dialog potwierdzenia
[ ] npm run lint i npm run typecheck bez błędów
```
