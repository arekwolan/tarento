# System designu Tarento — referencja

Zrzut tokenów dla człowieka. Źródłem prawdy jest kod, nie ta strona:

| Co                  | Gdzie                                                         |
| ------------------- | ------------------------------------------------------------- |
| Kolory (klasy)      | `global.css`                                                  |
| Kolory (runtime JS) | `src/theme/palette.ts` — parzystość pilnuje test              |
| Typografia          | `src/theme/typography.ts` + `tailwind.config.js`              |
| Kroje               | `src/theme/font-families.ts`, ładowanie `src/theme/fonts.tsx` |
| Odstępy / promienie | `src/theme/spacing.ts`, `src/theme/radii.ts`                  |
| Ruch                | `src/theme/motion.ts`                                         |
| Głębia              | `src/theme/elevation.ts`                                      |
| Komponenty          | `src/components/ui/`                                          |
| Brief źródłowy      | `docs/design-system-brief.md`                                 |

Zasady obowiązujące przy pisaniu kodu są w [CLAUDE.md](../CLAUDE.md), sekcja
„System designu". Ta strona ich nie powtarza — podaje wartości.

---

## Kierunek

Chłodna baza grafitowa, jeden ciepły akcent w kolorze mosiądzu. Interfejs jest
prawie monochromatyczny: kolor pojawia się wyłącznie tam, gdzie niesie
informację o postępie. Sygnaturą jest **mapa dni** — jedyny element z pełnym
nasyceniem akcentu. Motyw ciemny projektowany pierwszy.

---

## Kolory

### Motyw ciemny (kierunek podstawowy)

| Token              | Hex       | Do czego                                  |
| ------------------ | --------- | ----------------------------------------- |
| `background`       | `#131619` | tło ekranu                                |
| `surface`          | `#1A1E22` | karta, wiersz listy                       |
| `surface-elevated` | `#22272C` | karta uniesiona, arkusz, toast            |
| `surface-sunken`   | `#0E1114` | tor paska postępu, pasek offline          |
| `border`           | `#2C3238` | obrys domyślny                            |
| `border-strong`    | `#3D454C` | obrys niosący znaczenie, dziś w mapie dni |
| `text-primary`     | `#ECEFF1` | tekst główny                              |
| `text-secondary`   | `#9BA5AD` | tekst drugorzędny                         |
| `text-tertiary`    | `#7B858D` | metadane, nigdy akapit                    |
| `accent`           | `#C9922B` | akcent jako tekst i ikona                 |
| `accent-strong`    | `#DDA63C` | akcent wzmocniony                         |
| `accent-fill`      | `#C9922B` | akcent jako wypełnienie                   |
| `accent-muted`     | `#2E2716` | tło pod treścią akcentowaną               |
| `on-accent`        | `#16181A` | tekst na wypełnieniu akcentem             |
| `action`           | `#ECEFF1` | tło przycisku głównego                    |
| `on-action`        | `#131619` | etykieta przycisku głównego               |
| `success`          | `#5E9C76` | potwierdzenie                             |
| `warning`          | `#C2683A` | ostrzeżenie                               |
| `danger`           | `#C0524F` | wyłącznie akcja niszcząca                 |
| `scrim`            | `#0E1114` | przyciemnienie pod arkuszem               |

### Motyw jasny

| Token              | Hex                |
| ------------------ | ------------------ |
| `background`       | `#F5F6F7`          |
| `surface`          | `#FFFFFF`          |
| `surface-elevated` | `#FFFFFF` (+ cień) |
| `surface-sunken`   | `#EDEFF1`          |
| `border`           | `#E0E3E6`          |
| `border-strong`    | `#C6CBD0`          |
| `text-primary`     | `#16181A`          |
| `text-secondary`   | `#575F66`          |
| `text-tertiary`    | `#7A838A`          |
| `accent`           | `#7A5A12`          |
| `accent-strong`    | `#5F450E`          |
| `accent-fill`      | `#C9922B`          |
| `accent-muted`     | `#F5EAD2`          |
| `on-accent`        | `#16181A`          |
| `action`           | `#16181A`          |
| `on-action`        | `#F5F6F7`          |
| `success`          | `#2F6B47`          |
| `warning`          | `#9A4E23`          |
| `danger`           | `#B4322E`          |
| `scrim`            | `#16181A`          |

> **Uwaga krytyczna.** W motywie jasnym mosiądz `#C9922B` ma za mały kontrast na
> tekst. Jako tekst i ikony wolno użyć wyłącznie `accent` (`#7A5A12`);
> `accent-fill` służy tylko jako wypełnienie pod ciemnym tekstem.
> Nie zamieniaj tego miejscami.

### Skala serii — jedyne miejsce z pełnym nasyceniem

| Poziom | Ciemny    | Jasny     | Znaczenie                     |
| ------ | --------- | --------- | ----------------------------- |
| 0      | `#22272C` | `#E7EAEC` | brak danych / dzień pominięty |
| 1      | `#3A3320` | `#F0E3C2` | do 25% dziennych nawyków      |
| 2      | `#574728` | `#E2C782` | do 50%                        |
| 3      | `#8C6A26` | `#CFA746` | powyżej 50%, ale nie komplet  |
| 4      | `#C9922B` | `#A97D1E` | 100%                          |

Dzień pominięty wygląda tak samo jak dzień bez danych — nie karzemy wizualnie.
Dzień dzisiejszy, jeszcze niedomknięty: obrys `border-strong` 1px zamiast
wypełnienia.

### Progi kontrastu, które egzekwuje test

`src/theme/__tests__/contrast.test.ts`:

- **4.5:1** — `text-primary`, `text-secondary`, `accent` na wszystkich
  płaszczyznach; `on-action` na `action`; `on-accent` na `accent-fill`.
- **3:1** — `text-tertiary`, `success`, `warning`, `danger`. Te tokeny niosą
  krótkie etykiety i ikony, zawsze obok tej samej informacji podanej inaczej.
  W palecie z briefu nie sięgają 4.5:1 w żadnym motywie — dlatego **nie wolno
  ich użyć do akapitu**.

---

## Typografia

Kroje: **IBM Plex Sans** (400/500/600), **IBM Plex Mono** (500),
**Literata** (400, 400 italic). Wszystkie statyczne `.ttf`, komplet polskiej
diakrytyki weryfikuje `src/theme/__tests__/fonts.test.ts` (czyta tablicę `cmap`).

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

Waga jest zaszyta w rodzinie (`font-sans-semibold`), nie w `fontWeight` —
`theme.fontWeight` jest w Tailwindzie **wyłączone**, bo `font-bold` na
statycznym kroju 400 dałoby syntetyczne pogrubienie.

Warianty `numLg` i `num` dostają `fontVariant: ['tabular-nums']` automatycznie.

Zakaz rozmiaru poniżej 13. Zakaz wersalików — pilnuje ESLint.

---

## Odstępy, promienie, głębia, ruch

**Odstępy** (baza 4): `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.
Klasy Tailwinda to krok × 4 (`p-5` = 20). Poza skalą z briefu istnieją jeszcze
`12` (48 dp — minimalny cel dotykowy) oraz `16`–`32`, zarezerwowane na wymiary
szkieletów, nie na odstępy.

- margines poziomy ekranu: **20** (`px-5`, ustawia `<Screen>`)
- odstęp między kartami: **12** (`gap-3`)
- odstęp między sekcjami: **32** (`gap-8`)

**Promienie** (`src/theme/radii.ts` + `tailwind.config.js`, parzystości pilnuje
`src/theme/__tests__/radii.test.ts`):

| Token  | dp   | Do czego                                          |
| ------ | ---- | ------------------------------------------------- |
| `xs`   | 8    | komórka mapy dni, szkielet, drobny znacznik       |
| `sm`   | 12   | pola formularza, chipy                            |
| `md`   | 18   | przycisk, karta domyślna, toast                   |
| `lg`   | 28   | bottom sheet, karta uniesiona                     |
| `xl`   | 36   | płaszczyzny pełnoekranowe i pływające             |
| `full` | 9999 | wyłącznie znaczniki i paski, nigdy karty ani pola |

**Krzywizna ciągła.** Każda płaszczyzna z promieniem dostaje
`CONTINUOUS_CURVE` z `src/theme/radii.ts` (`borderCurve: 'continuous'`).
To prop iOS-owy; na Androidzie róg zostaje wycinkiem koła i nie udajemy, że
jest inaczej. Różnica jest ledwie widoczna przy 8 dp i wyraźna przy 28 dp.

**Promienie koncentryczne.** Element wstawiony w płaszczyznę z promieniem nie
ustala swojego promienia sam — bierze go z `concentricRadius(outer, inset)`,
czyli `outer − inset` z podłogą na `xs`. Podłoga jest świadoma: karta 18 dp
z paddingiem 16 dałaby wewnątrz 2 dp, a taki róg czyta się jak usterka.
W praktyce ustawiają to `Card` i `Sheet` przez `SurfaceRadiusProvider`,
a czytają `Button`, `TextField` i `Chip` przez `useControlRadius()` — dzięki
temu przycisk sam na ekranie ma `md`, a ten sam przycisk w karcie `xs`.

**Głębia** (`src/theme/elevation.ts`): hierarchia nie wynika z kresek.

Trzy poziomy: `card` (karta domyślna), `raised` (karta uniesiona),
`sheet` (bottom sheet, toast).

- **Ciemny motyw** — płaszczyzna tonalna (`surface` → `surface-elevated`) plus
  świetlna krawędź górna: `edge` przy kryciu `card 0.06`, `raised 0.09`,
  `sheet 0.09`. Sufit krycia to **0.12** — powyżej krawędź przestaje być
  światłem i zaczyna być obrysem. Cień dostaje wyłącznie arkusz i toast
  (`0 −4 20`, krycie 0.45, tylko iOS — na Androidzie `elevation` zostaje na
  zerze, bo dokłada jasną poświatę). Karta w ciemnym cienia nie ma.
- **Jasny motyw** — płaszczyzna plus cień: `card 0 2 8 / 0.06`,
  `raised 0 4 14 / 0.08`, `sheet 0 8 24 / 0.10`. Świetlna krawędź jest tam
  biel na bieli, więc `edgeHighlight()` zwraca pusty styl zamiast udawać
  efekt.

Sama płaszczyzna daje w obu motywach około 1.08 kontrastu wobec tła i to jest
zamierzone: karta ma się wyłaniać, a nie odcinać. Resztę robi krawędź albo
cień — pilnuje tego `src/theme/__tests__/contrast.test.ts`.

**Obrys jest wyjątkiem.** Karta ma go wyłącznie w wariancie `outlined`, gdzie
niesie znaczenie (stan zaznaczenia, kolor domkniętego dnia). Pola formularza,
chipy i karty wyboru zachowują obrys, bo tam niesie afordancję — w spoczynku
`hairline`, w stanie aktywnym `border-strong`.

**Ruch** (`src/theme/motion.ts`): `fast 140ms`, `base 220ms`, `slow 320ms`.
Wejścia `cubic-bezier(0.22, 1, 0.36, 1)`, przesunięcia `cubic-bezier(0.4, 0, 0.2, 1)`.
Tylko Reanimated. Jedyna sprężyna: potwierdzenie odhaczenia nawyku
(`damping 18`, `stiffness 220`). Każda animacja respektuje `useReducedMotion()`.

Stan wciśnięcia: `opacity 0.9` + `scale 0.98`, skala znika przy redukcji ruchu.
Podaje go hook `usePressClass()`.

**Haptyka** (`expo-haptics`):

| Zdarzenie                      | Reakcja                           |
| ------------------------------ | --------------------------------- |
| odhaczenie                     | `impactAsync(Light)`              |
| cofnięcie                      | `selectionAsync()`                |
| kamień milowy serii (7/30/100) | `notificationAsync(Success)`, raz |

Nigdy przy przewijaniu, nigdy przy zwykłej nawigacji.

---

## Komponenty

`src/components/ui/` — jedyne źródło elementów interfejsu.

| Komponent     | Uwagi                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `Text`        | warianty ze skali; jedyne dozwolone renderowanie tekstu                     |
| `Button`      | `primary` (maksymalny kontrast) / `secondary` / `ghost` / `destructive`     |
| `Card`        | `variant`: `default` / `raised` (głębia) / `outlined` (obrys ze znaczeniem) |
| `Screen`      | tło, safe area, margines 20, odstęp 12                                      |
| `Divider`     | 1px `hairline` — separator, nie obrys                                       |
| `EmptyState`  | jedno zdanie + jedno CTA                                                    |
| `Skeleton`    | puls; przy redukcji ruchu stoi                                              |
| `Toast`       | `ToastProvider` + `useToast()`, akcja „Cofnij", 5 s                         |
| `Sheet`       | bottom sheet; przy redukcji ruchu wchodzi kryciem                           |
| `StreakGrid`  | mapa dni; każda komórka ma etykietę dostępności                             |
| `Banner`      | `danger` / `success` / `info` (także offline)                               |
| `Chip`        | zaznaczenie kontrastem, nie kolorem                                         |
| `OptionCard`  | wybór z opisem                                                              |
| `ProgressBar` | wypełnienie `accent-fill` — to postęp                                       |
| `TextField`   | + `ControlledTextField` pod `react-hook-form`                               |

Komponenty domenowe (`HabitRow` = `TaskRow`, `QuoteCard` = `DailyQuoteCard`,
`Heatmap`) mieszkają w swoich feature'ach i składają się z powyższych —
`src/components/` zostaje bezstanowe, zgodnie z §4 CLAUDE.md.

---

## Strażnicy

`eslint.config.js` wywala build, gdy w `app/**`, `src/features/**` albo
`src/components/**` pojawi się:

- literał koloru (`#RRGGBB`),
- arbitralny kolor w klasie (`bg-[#123456]`),
- klasa z domyślnej palety Tailwinda (`bg-blue-500`),
- `textTransform: 'uppercase'` albo klasa `uppercase`,
- import `Text` z `react-native`.

Wyjątki: `src/components/ui/text.tsx` (opakowanie `<Text>`) i
`src/components/route-error-boundary.tsx` (ekran awaryjny działający bez
kontekstu aplikacji). `src/theme/**` jest poza zakresem — to tam mieszkają
wartości.

Tailwind ma **nadpisane**, nie rozszerzone skale, więc `text-sm`, `p-7`,
`rounded-2xl` i `bg-blue-500` po prostu nie istnieją.
