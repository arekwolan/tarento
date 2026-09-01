# PROMPT DO CLAUDE CODE — system designu + aktualizacja CLAUDE.md

> Sposób użycia: zapisz ten plik w repo jako `docs/design-system-brief.md` i napisz w Claude Code:
> „Włącz plan mode. Przeczytaj `docs/design-system-brief.md` i wykonaj to, co tam opisano."
> Albo po prostu wklej całą treść poniżej. Przed startem: `git commit` obecnego stanu.

---

## Cel

Wprowadź jeden, spójny system designu i **zapisz go w CLAUDE.md**, żeby każda kolejna funkcja
powstawała w tym samym stylu bez przypominania. Kod ma po tym zadaniu wyglądać tak, że dodanie
nowego ekranu bez użycia tokenów jest trudniejsze niż zrobienie tego poprawnie.

To jest zmiana warstwy wizualnej i konwencji. **Nie zmieniaj logiki biznesowej, schematu bazy
ani zapytań.**

---

## Kierunek wizualny (nie negocjuj tego samodzielnie)

**Chłodna, grafitowa baza + jeden ciepły akcent w kolorze mosiądzu.**

Zasada nadrzędna: interfejs jest prawie monochromatyczny. Kolor pojawia się wyłącznie tam, gdzie
**niesie informację o postępie** — wykonany nawyk, seria, mapa dni. Nigdzie indziej. Dzięki temu
jedno spojrzenie na ekran mówi „ile dziś zrobiłem", bez czytania.

Konsekwencje, których trzymamy się bezwyjątkowo:

- Przycisk główny **nie jest** kolorowy — jest maksymalnym kontrastem (ciemny na jasnym motywie,
  jasny na ciemnym). Akcent zostaje zarezerwowany dla stanu wykonania.
- **Czerwień istnieje tylko przy akcjach niszczących** (usuń konto, usuń nawyk). Pominięty dzień
  nigdy nie jest czerwony — jest neutralny.
- Zero gradientów, zero neonów, zero cieni kolorowych, zero emoji jako nośnika stanu.
- Motyw ciemny jest projektowany jako pierwszy, nie doklejany. Aplikacja jest używana wieczorem.

Sygnaturą aplikacji jest **siatka dni** (mapa serii): jedyny element, który dostaje pełne nasycenie
akcentu. Wszystko wokół niej ma być ciche.

---

## 1. Fonty

Wymóg twardy: **pełna obsługa polskich znaków** (ą ć ę ł ń ó ś ź ż, wersaliki Ł Ż Ź). Po instalacji
zweryfikuj renderowanie ciągu `ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż` w każdym kroju i wadze.

| Rola          | Krój              | Wagi            | Gdzie                                       |
| ------------- | ----------------- | --------------- | ------------------------------------------- |
| UI / tekst    | **IBM Plex Sans** | 400, 500, 600   | wszystko domyślnie                          |
| Cytaty        | **Literata**      | 400, 400 italic | wyłącznie karta „cytat dnia" i ekran cytatu |
| Liczby / dane | **IBM Plex Mono** | 500             | licznik serii, statystyki, daty w tabelach  |

Uzasadnienie do zapisania w CLAUDE.md: Plex ma bezbłędną diakrytykę i cyfry tabelaryczne, Literata
to krój książkowy — cytaty pochodzą z książek, więc krój niesie znaczenie, a nie dekorację.
Mono daje wyrównanie kolumn liczb za darmo.

Implementacja:

- `expo-font` + statyczne pliki `.ttf` bundlowane z aplikacją (paczki `@expo-google-fonts/*`;
  **zweryfikuj aktualne nazwy pakietów przed instalacją**, nie zgaduj).
- **Nie używaj krojów zmiennych (variable)** — na Androidzie w RN bywają zawodne. Statyczne wagi.
- Ładowanie fontów blokuje splash: `SplashScreen.preventAutoHideAsync()` do czasu `fontsLoaded`.
- Fallback systemowy zdefiniowany jawnie, gdyby font się nie wczytał.
- Liczby: `fontVariant: ['tabular-nums']` w każdym miejscu, gdzie wartość się zmienia w czasie
  (licznik serii, procenty) — inaczej cyfry „skaczą".

---

## 2. Tokeny kolorów

Nazwy **semantyczne**. Żadnych `gray900`, `gold500` w kodzie komponentów.

### Motyw ciemny (domyślny)

| Token                             | Hex       |
| --------------------------------- | --------- |
| `bg`                              | `#131619` |
| `surface`                         | `#1A1E22` |
| `surface-elevated`                | `#22272C` |
| `surface-sunken`                  | `#0E1114` |
| `border`                          | `#2C3238` |
| `border-strong`                   | `#3D454C` |
| `text-primary`                    | `#ECEFF1` |
| `text-secondary`                  | `#9BA5AD` |
| `text-tertiary`                   | `#7B858D` |
| `accent`                          | `#C9922B` |
| `accent-strong`                   | `#DDA63C` |
| `accent-muted`                    | `#2E2716` |
| `on-accent`                       | `#16181A` |
| `action` (tło przycisku głównego) | `#ECEFF1` |
| `on-action`                       | `#131619` |
| `success`                         | `#5E9C76` |
| `warning`                         | `#C2683A` |
| `danger`                          | `#C0524F` |

### Motyw jasny

| Token                               | Hex                |
| ----------------------------------- | ------------------ |
| `bg`                                | `#F5F6F7`          |
| `surface`                           | `#FFFFFF`          |
| `surface-elevated`                  | `#FFFFFF` (+ cień) |
| `surface-sunken`                    | `#EDEFF1`          |
| `border`                            | `#E0E3E6`          |
| `border-strong`                     | `#C6CBD0`          |
| `text-primary`                      | `#16181A`          |
| `text-secondary`                    | `#575F66`          |
| `text-tertiary`                     | `#7A838A`          |
| `accent` (tekst/ikony)              | `#7A5A12`          |
| `accent-fill` (wypełnienia, postęp) | `#C9922B`          |
| `accent-muted`                      | `#F5EAD2`          |
| `on-accent`                         | `#16181A`          |
| `action`                            | `#16181A`          |
| `on-action`                         | `#F5F6F7`          |
| `success`                           | `#2F6B47`          |
| `warning`                           | `#9A4E23`          |
| `danger`                            | `#B4322E`          |

**Uwaga krytyczna:** w motywie jasnym mosiądz `#C9922B` ma za mały kontrast na tekst. Jako tekst
i ikony używaj wyłącznie `accent` (`#7A5A12`); `accent-fill` służy tylko jako **wypełnienie** pod
ciemnym tekstem. Nie zamieniaj tego miejscami.

### Skala serii (mapa dni) — jedyne miejsce z pełnym nasyceniem

| Poziom | Ciemny    | Jasny     | Znaczenie                     |
| ------ | --------- | --------- | ----------------------------- |
| 0      | `#22272C` | `#E7EAEC` | brak danych / dzień pominięty |
| 1      | `#3A3320` | `#F0E3C2` | ≤25% dziennych nawyków        |
| 2      | `#574728` | `#E2C782` | ≤50%                          |
| 3      | `#8C6A26` | `#CFA746` | ≤75%                          |
| 4      | `#C9922B` | `#A97D1E` | 100%                          |

Dzień pominięty **wygląda tak samo jak dzień bez danych**. Nie karzemy wizualnie.
Dzień dzisiejszy, jeszcze niedomknięty: obrys `border-strong` 1px zamiast wypełnienia.

---

## 3. Typografia — skala

Jedna skala, zamknięta lista. Nowe rozmiary tylko przez zmianę tego pliku.

| Wariant   | Rozmiar / interlinia   | Waga | Krój  | Zastosowanie                  |
| --------- | ---------------------- | ---- | ----- | ----------------------------- |
| `display` | 34 / 40, tracking −0.5 | 600  | sans  | duża liczba na statystykach   |
| `titleLg` | 26 / 32, −0.3          | 600  | sans  | tytuł ekranu                  |
| `title`   | 19 / 25, −0.1          | 600  | sans  | tytuł sekcji / karty          |
| `bodyLg`  | 17 / 25                | 400  | sans  | nazwa nawyku na liście        |
| `body`    | 15 / 22                | 400  | sans  | domyślny tekst                |
| `caption` | 13 / 18                | 400  | sans  | podpisy, metadane             |
| `label`   | 13 / 16, +0.2          | 500  | sans  | przyciski, zakładki           |
| `quote`   | 22 / 34                | 400  | serif | wyłącznie cytat               |
| `numLg`   | 28 / 32                | 500  | mono  | licznik serii                 |
| `num`     | 13 / 18                | 500  | mono  | daty i liczby w zestawieniach |

Zakaz `fontSize` poniżej 13. Zakaz wersalików (`textTransform: 'uppercase'`) dla ciągów dłuższych
niż ~12 znaków — polskie słowa są długie, a wersaliki z diakrytyką czytają się źle.

---

## 4. Odstępy, promienie, głębia, ruch

**Odstępy** — baza 4: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.
Margines poziomy ekranu: **20**. Odstęp między kartami: 12. Między sekcjami: 32.

**Promienie:** `xs 6`, `sm 10`, `md 14` (domyślny dla kart), `lg 20` (bottom sheet), `full 999`.

**Głębia:**

- Ciemny motyw: **bez cieni**. Hierarchię buduje `surface-elevated` + obrys 1px `border`.
- Jasny motyw: karta = `surface` + obrys 1px; uniesiona = cień `0 2 8 rgba(22,24,26,0.06)`;
  bottom sheet = `0 8 24 rgba(22,24,26,0.10)`.

**Ruch** — czasy: `fast 140ms`, `base 220ms`, `slow 320ms`.
Wejścia: `cubic-bezier(0.22, 1, 0.36, 1)`. Przesunięcia: `cubic-bezier(0.4, 0, 0.2, 1)`.
Tylko Reanimated. Sprężyna dozwolona w **jednym** miejscu: potwierdzenie odhaczenia nawyku
(`damping 18`, `stiffness 220`). Każda animacja sprawdza `useReducedMotion()` — przy włączonej
redukcji zostaje tylko zmiana `opacity`, bez transformacji.

**Haptyka** (`expo-haptics`):

- odhaczenie → `impactAsync(Light)`
- cofnięcie → `selectionAsync()`
- kamień milowy serii (7 / 30 / 100 dni) → `notificationAsync(Success)`, maksymalnie raz na zdarzenie
- nigdy przy przewijaniu, nigdy przy zwykłej nawigacji

---

## 5. Reguły użyteczności (część systemu, nie sugestia)

1. **Zasięg kciuka.** Akcje wykonywane codziennie leżą w dolnych 2/3 ekranu. Odhaczanie nigdy
   w prawym górnym rogu.
2. **Cały wiersz nawyku jest klikalny**, nie sam kwadracik. Minimalny cel dotykowy 48×48 dp.
3. **Cofnij zamiast potwierdzaj.** Odhaczenie, cofnięcie, archiwizacja → wykonaj od razu
   - toast z „Cofnij" (5 s). `Alert.alert` tylko przy operacjach nieodwracalnych.
4. **Optimistic UI.** Interfejs reaguje natychmiast, synchronizacja w tle. Aplikacja ma działać
   w metrze bez zasięgu.
5. **Cztery stany każdego widoku danych:** ładowanie (skeleton w kształcie docelowej treści,
   nie spinner), pusto (jedno zdanie + jedno CTA), błąd (co się stało + co zrobić), offline
   (dyskretny pasek, bez blokowania ekranu).
6. **Bottom sheet zamiast pełnoekranowego modala** dla akcji na jednym–dwóch polach.
7. **Jedna akcja główna na ekran.** Reszta to warianty `secondary` / `ghost`.
8. **Motyw sterowany systemem**, z ręcznym nadpisaniem w ustawieniach.

---

## 6. Język interfejsu

- Wszystkie teksty przez i18n (`pl.json`, `en.json`), klucze semantyczne. Zero stringów w JSX.
- Przyciski: tryb rozkazujący, ta sama nazwa przez cały przepływ („Dodaj nawyk" → toast
  „Nawyk dodany").
- **Zero zawstydzania.** Nigdy „Straciłeś serię", „Znowu nie zrobiłeś". Zamiast tego neutralnie:
  „Nowa seria zaczyna się dziś". To aplikacja rozwojowa, a nie tresura.
- Powiadomienia: bez wykrzykników, bez wielkich liter, bez presji czasu.
- Bez porad medycznych, dietetycznych i terapeutycznych — także w mikrocopy.
- Daty przez `date-fns` z locale `pl` (odmiana miesięcy!), liczby przez `Intl.NumberFormat('pl-PL')`.
  Zero ręcznego składania dat ze stringów.
- Polskie etykiety są o ~15–20% dłuższe niż angielskie: żadnych przycisków o stałej szerokości,
  żadnego ucinania nazw nawyków w jednej linii — dozwolone zawijanie do 2 linii.

---

## 7. Dostępność — minimum, które musi przechodzić

- Kontrast: 4.5:1 dla tekstu, 3:1 dla ikon i obrysów niosących znaczenie. Sprawdź w obu motywach.
- `allowFontScaling` włączone wszędzie. Layout musi przetrwać `fontScale = 1.3` — przetestuj.
- `accessibilityRole` + `accessibilityState={{ checked }}` na kontrolce nawyku,
  `accessibilityLabel` po polsku, opisujący czynność, nie wygląd.
- Kolor nigdy nie jest jedynym nośnikiem informacji — siatka dni musi mieć etykiety dostępności.
- Stan wciśnięcia widoczny: `opacity 0.9` + `scale 0.98` (skala wyłączona przy Reduce Motion).

---

## 8. Zakres zmian w kodzie

1. **`src/theme/`** — przepisz na powyższe tokeny:
   `colors.ts` (oba motywy), `typography.ts`, `spacing.ts`, `radii.ts`, `motion.ts`, `index.ts`.
   Jedno źródło prawdy, eksport typowany (`as const`, bez `string`).
2. **`tailwind.config.js`** — tylko semantyczne nazwy klas (`bg-surface`, `text-secondary`,
   `border-border`, `bg-accent`). Usuń dostęp do domyślnej palety Tailwinda, żeby `bg-blue-500`
   przestało działać.
3. **`src/components/ui/`** — `Text` (warianty ze skali), `Button` (primary / secondary / ghost /
   destructive, stany: default, pressed, disabled, loading), `Card`, `Screen`, `Divider`,
   `EmptyState`, `Skeleton`, `Toast` z „Cofnij", `Sheet`, `StreakGrid`, `HabitRow`, `QuoteCard`.
4. **Migracja istniejących ekranów** na tokeny i komponenty `ui/`. Usuń wszystkie hexy,
   surowe `fontSize` i klasy z domyślnej palety.
5. **Strażnicy w ESLint** (bez tego system rozjedzie się w dwa tygodnie):
   - zakaz importu `Text` z `react-native` poza `src/components/ui/text.tsx`
   - zakaz literałów hex w `src/app/**` i `src/features/**`
   - zakaz `className` zawierającego `-[#` oraz nazwy kolorów Tailwinda
   - zakaz `textTransform: 'uppercase'`
     Reguły przez `no-restricted-imports`, `no-restricted-syntax` i prosty custom rule/regex.
6. **`docs/design-system.md`** — jedna strona ze zrzutem tokenów jako referencja dla człowieka.

---

## 9. Aktualizacja CLAUDE.md

Dodaj sekcję **„System designu"** zawierającą: kierunek wizualny (§ kierunek powyżej, skrócony
do 5 zdań), tabelę tokenów kolorów, skalę typografii, skalę odstępów, reguły ruchu i haptyki.

Dopisz do sekcji **„Reguły krytyczne"**:

- NIGDY nie używaj wartości kolorów wprost — tylko tokeny semantyczne z `@/theme`
- NIGDY nie importuj `Text` z `react-native` w ekranach — używaj `@/components/ui/text`
- NIGDY nie oznaczaj pominiętego dnia ani przerwanej serii kolorem `danger`
- Akcent (mosiądz) rezerwujemy dla stanu wykonania i postępu — nie dla przycisków ani nagłówków
- Każdy nowy ekran opakowany w `<Screen>` i obsługujący 4 stany: loading / empty / error / offline

Dodaj na końcu **„Definition of done dla UI"** — Claude Code ma przechodzić tę listę przed
zamknięciem każdego zadania dotykającego interfejsu:

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

---

## Czego nie robić

- Nie dotykaj schematu bazy, zapytań, migracji Supabase ani logiki nawyków i serii.
- Nie dodawaj bibliotek komponentów (NativeBase, Tamagui, gluestack, RN Paper). Budujemy własne
  na NativeWind.
- Nie dodawaj bibliotek animacji poza Reanimated.
- Nie wprowadzaj ekranu onboardingu, ekranu powitalnego ani nowych funkcji przy okazji.
- Nie zmieniaj struktury tras.

## Kryteria odbioru

- `npm run typecheck` i `npm run lint` przechodzą bez błędów, nowe reguły ESLint są aktywne
  i wyłapują celowo wstawiony hex (pokaż, że działają).
- Wyszukanie `#` w wartościach kolorów w `src/app/**` i `src/features/**` nie zwraca nic.
- Aplikacja startuje, oba motywy działają, fonty ładują się przed zniknięciem splasha.
- Ciąg `ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż` renderuje się poprawnie w każdym kroju i wadze.
- CLAUDE.md zawiera nowe sekcje; pokaż mi diff CLAUDE.md przed commitem.

Pracuj w plan mode. Pokaż plan i poczekaj na akceptację przed zmianami w plikach.
