# FRONTEND.md — kierunek wizualny 2026/2027

Plan modernizacji warstwy wizualnej Tarento, w formie promptów wdrożeniowych
dla Claude Code. Obowiązuje razem z [CLAUDE.md](CLAUDE.md) — nie zamiast niego.
Gdy cokolwiek tutaj jest sprzeczne z regułami krytycznymi z §6 CLAUDE.md,
wygrywa CLAUDE.md, a sprzeczność jest błędem tego dokumentu i trzeba ją zgłosić.

Punkt wyjścia jest dobry i nie zaczynamy od zera: tokeny semantyczne, testy
parzystości palety i skali, test kontrastu, strażnicy w ESLincie. To rzadkość
i tego nie ruszamy. Modernizacja polega na wymianie **języka form i ruchu**,
nie na wymianie systemu.

---

## Diagnoza: co dziś czyta się jako 2022

Konkretnie, z odniesieniem do plików.

**1. Hierarchia zbudowana na obrysach.** Prawie każda płaszczyzna ma obrys 1px
(`Card`, `OptionCard`, `TextField`, `Chip`, `Button` w wariancie secondary).
To język płaskiego designu z okolic 2018–2021. Obie platformy odeszły od niego
w 2025 na rzecz warstw tonalnych i przezroczystości: iOS 26 (Liquid Glass)
i Material 3 Expressive. Interfejs oparty na obrysach czyta się jak makieta
z kolorem, a nie jak gotowy produkt.
Pliki: `src/components/ui/card.tsx`, `global.css`, `src/theme/elevation.ts`.

**2. Promienie okrągłe i płaskie.** `xs 6, sm 10, md 14, lg 20`, wszystkie jako
zwykłe `borderRadius`, bez krzywizny ciągłej i bez zasady koncentryczności.
Superelipsa jest w iOS od dekady, a w iOS 26 stała się regułą projektową
(promień wewnętrzny wynika z zewnętrznego). React Native ma na to
`borderCurve: 'continuous'` i nic nie kosztuje.
Pliki: `src/theme/radii.ts`, `tailwind.config.js`.

**3. Ruch oparty na czasie, z jedną dozwoloną sprężyną.** `motion.ts` daje
`fast/base/slow` plus dwie krzywe Béziera, a sprężyna jest wyjątkiem
zarezerwowanym dla odhaczenia. W 2025 Material 3 Expressive zrobił ze sprężyn
**domyślny** język ruchu, a Reanimated 4 obsługuje `withSpring` z parametrami
`duration` i `dampingRatio`, więc sprężyna jest dziś równie przewidywalna co
timing. Animacja na krzywej `cubic-bezier` czyta się teraz jak animacja z CSS-a
sprzed pięciu lat.
Pliki: `src/theme/motion.ts`, `src/components/ui/press.ts`.

**4. Za mały kontrast typograficzny.** Największy rozmiar to 34, najmniejszy 13
— stosunek 2,6. Aplikacja, której cały sens polega na tym, że „jedno spojrzenie
mówi, ile dziś zrobiłem", ma zbyt cichą liczbę główną. Do tego tracking jest
prawie stały (−0.5 przy 34, −0.1 przy 19), zamiast skalować się optycznie
z rozmiarem.
Pliki: `src/theme/typography.ts`, `tailwind.config.js`.

**5. Tab bar prosto z pudełka.** Pełna szerokość, obrys górny, etykiety pod
ikonami. Obie platformy poszły w pływający, przezroczysty pasek, który reaguje
na przewijanie. Do tego Android wymusza edge-to-edge, więc pasek i tak trzeba
tknąć.
Plik: `app/(tabs)/_layout.tsx`.

**6. Ikony bez jednego charakteru.** Ionicons miesza metafory i grubości kresek
(`today-outline`, `stats-chart-outline`, `ellipsis-horizontal`,
`checkmark-done`, `sparkles-outline`, `leaf-outline`). Zestaw o jednej,
stałej grubości kreski to dziś najtańsza rzecz, która podnosi wrażenie
dopracowania.
Pliki: `app/(tabs)/_layout.tsx` i kilkanaście komponentów.

**7. Mapa dni — sygnatura, która nie wygląda na sygnaturę.** Kwadraciki 16 dp
z promieniem 6, bez ruchu wejścia, dzisiaj oznaczone samym obrysem. To wciąż
GitHub 2015. A to jest jedyny element, po którym ktoś rozpozna tę aplikację
na zrzucie ekranu.
Plik: `src/components/ui/streak-grid.tsx`.

**8. Karta w karcie.** Ekran „Dziś" i „Postępy" to stos kart, a wewnątrz kart
bywają kolejne obrysowane elementy. Zmęczenie kartami jest realne — 2026 idzie
w stronę pogrupowanych list z włosowymi separatorami i kart zarezerwowanych
dla treści naprawdę odrębnej.
Pliki: `app/(tabs)/index.tsx`, `app/(tabs)/stats.tsx`.

**9. Liczby zmieniają się skokiem.** Cyfry tabelaryczne już są, więc animowany
licznik kosztuje kilkanaście linii i daje dokładnie ten rodzaj dopracowania,
którego nie da się podrobić copy.

**10. Zero ciągłości między ekranami.** Wejście w szczegóły nawyku to cięcie.
Brak wspólnych elementów i brak animacji układu przy zmianie listy.

---

## Czego świadomie nie robimy

Największym ryzykiem tej pracy nie jest to, że aplikacja zostanie stara.
Jest nim to, że w pogoni za modą zgubi jedyną rzecz, która ją wyróżnia:
ciszę. Poniższe rzeczy są w 2026 modne i **nie wchodzą**.

**Szkło wszędzie.** Rozmycie ma sens pod paskiem zakładek i pod arkuszem, bo
tam pod spodem faktycznie coś przesuwa się i prześwituje. Rozmyta karta na
statycznym tle to koszt GPU za efekt, którego nikt nie zauważy.

**Gradienty, aurory, poświaty.** Reguła z briefu zostaje: zero gradientów, zero
neonów, zero cieni kolorowych. `expo-linear-gradient` siedzi w zależnościach
i ma tam zostać nieużywany w warstwie produktu.

**Kolor dynamiczny z tapety (Material You).** Cały sens palety polega na tym,
że mosiądz znaczy „postęp" i nic więcej. Paleta sterowana tapetą znaczy
przypadek.

**Bento grid.** Wygląda dobrze na Dribbble i rozwala się przy fontScale 1.3
oraz przy polskich etykietach dłuższych o 20%.

**Fioletowy „shimmer AI".** Podpowiedzi modelu są w tej aplikacji celowo ciche
i oznaczone tekstem, nie kolorem. Nie robimy z nich atrakcji.

**Grywalizacja wizualna.** Konfetti, odznaki, poziomy, paski XP. Wprost
zakazane przez brief i przez P13.

**Krój zmienny.** Kuszące (animowana waga, optical sizing), ale
`src/theme/font-families.ts` zawiera świadomą decyzję o statycznych `.ttf`
z powodu zawodności na Androidzie. Nie odwracamy jej przy okazji liftingu.
Jeśli kiedyś — to osobną decyzją, z testem na fizycznym Androidzie.

---

## Kolejność wdrożenia

**Etap 1 — fundament (bez nowych zależności).** `F1`, `F2`, `F3`, `F4`.
Tokeny i język form. Po tym etapie aplikacja wygląda inaczej, mimo że nie
zmienił się ani jeden ekran.

**Etap 2 — komponenty i ekrany.** `F7`, `F8`, `F9`, `F10`.
Sygnatura, gęstość, mikrointerakcje.

**Etap 3 — wymaga Twojej zgody.** `F5`, `F6` (nowe zależności), `F11`
(`app.config.ts` i zasoby). CLAUDE.md §8, „Pytaj przed zrobieniem".

**Na koniec, zawsze.** `F12` — ekran przeglądu systemu i rozszerzone testy.
Bez niego nie da się sprawdzić dwóch motywów × dwóch skal czcionki inaczej niż
klikaniem.

---

## PROMPT F1 — krzywizna ciągła i promienie koncentryczne

```text
Zadanie: wymiana języka form. Promienie rosną, dostają krzywiznę ciągłą
i zasadę koncentryczności. To jest zmiana czysto strukturalna — żaden kolor
ani rozmiar tekstu się nie rusza.

Nowa skala w src/theme/radii.ts i tailwind.config.js (obie naraz, parzystość
pilnuje nowy test):
  xs   8   (komórka mapy dni, drobne znaczniki)
  sm  12   (pola formularza, chipy)
  md  18   (przyciski, domyślna karta)
  lg  28   (karta uniesiona, arkusz)
  xl  36   (elementy pełnoekranowe, pływający tab bar)
  full

Krzywizna ciągła:
  Dodaj do src/theme/radii.ts stałą CONTINUOUS_CURVE = { borderCurve: 'continuous' }
  typowaną jako ViewStyle i użyj jej w każdym komponencie z src/components/ui/,
  który ma promień: Card, Button, Chip, TextField, OptionCard, Sheet, Banner,
  Skeleton, ProgressBar, StreakGrid.
  W komentarzu napisz wprost, że to prop iOS-owy i że na Androidzie zostaje
  zwykła krzywizna kołowa — nie udajemy, że działa wszędzie.

Promienie koncentryczne:
  export function concentricRadius(outer: Radius, inset: number): number
  Zwraca max(radii.xs, radii[outer] - inset). Element wstawiony w kartę
  o promieniu md i paddingu 16 dostaje promień z tej funkcji, a nie z oka.
  Zastosuj wszędzie, gdzie dziś element z promieniem siedzi w innym elemencie
  z promieniem: przycisk w karcie, pole w arkuszu, znacznik w wierszu.

Weryfikacja rozmiarów po zmianie: przyciski i pola przy promieniu 12–18 nie
mogą stracić minimalnej wysokości 48 dp ani zacząć wyglądać na pigułki —
`rounded-full` zostaje wyłącznie dla znaczników i awatarów.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- nowy test src/theme/__tests__/radii.test.ts: parzystość radii.ts
  z tailwind.config.js, tak jak robi to test typografii
- test concentricRadius: nigdy nie schodzi poniżej xs, zawsze mniejszy
  od zewnętrznego przy niezerowym insecie
- grep po src/ i app/ nie znajduje `borderRadius:` wpisanego liczbą poza
  src/theme/
- docs/design-system.md zaktualizowany w sekcji „Odstępy, promienie…"
- lista z §9 CLAUDE.md
```

---

## PROMPT F2 — warstwy zamiast obrysów

```text
Zadanie: hierarchia przestaje wynikać z kresek. W motywie ciemnym niosą ją
płaszczyzny tonalne plus jedna świetlna krawędź; w jasnym płaszczyzna plus
miękki cień. Obrys zostaje wyjątkiem, a nie domyślnym stanem.

Nowe tokeny w global.css i src/theme/palette.ts (obie naraz):
  --color-edge          krawędź świetlna górna
                        ciemny: 255 255 255   (używana wyłącznie z alfą)
                        jasny:  255 255 255
  --color-hairline      separator w liście
                        ciemny: 44 50 56
                        jasny:  224 227 230

Zmiana w komponentach:
  Card domyślnie: bez obrysu. W ciemnym `bg-surface` plus
    `border-t border-edge/[0.06]`; w jasnym `bg-surface` plus cień `card`
    z elevation.ts. Wariant `elevated`: `bg-surface-elevated`, krawędź
    `border-edge/[0.09]`, w jasnym cień mocniejszy.
  Card dostaje nowy wariant `outlined` — dla przypadków, w których obrys
    naprawdę coś znaczy (karta wyboru, stan zaznaczenia). To ma być decyzja,
    a nie domyślka.
  TextField, Chip, OptionCard: obrys zostaje, bo tam niesie afordancję pola
    i stanu zaznaczenia. Zmienia się tylko na `border-hairline` w stanie
    spoczynku i `border-border-strong` w stanie aktywnym.
  Divider: `bg-hairline`.

elevation.ts:
  Motyw ciemny przestaje zwracać pusty obiekt dla poziomu `sheet` — arkusz
  dostaje cień na kolorze `scrim` z niskim kryciem, bo unosi się nad treścią
  i bez tego jego krawędź ginie. Karta w ciemnym nadal bez cienia.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- test parzystości palety przechodzi z nowymi tokenami
- src/theme/__tests__/contrast.test.ts rozszerzony: tekst na każdej z trzech
  płaszczyzn (surface, surface-elevated, surface-sunken) w obu motywach
  spełnia dotychczasowe progi
- na zrzutach obu motywów krawędzie kart są widoczne bez obrysu — jeśli nie są,
  zgłoś to zamiast podnosić alfę powyżej 0.12
- docs/design-system.md: sekcja „Głębia" opisuje warstwy, nie obrysy
- lista z §9 CLAUDE.md
```

---

## PROMPT F3 — sprężyna jako domyślny język ruchu

```text
Zadanie: przepisanie src/theme/motion.ts z czasów i krzywych na sprężyny.
To jest zmiana języka, nie kosmetyka: po niej każde wejście, przesunięcie
i reakcja na dotyk mają tę samą fizykę.

Nowe tokeny (Reanimated 4, withSpring z duration i dampingRatio — sprężyna
jest dziś tak samo przewidywalna co timing, a wygląda żywiej):
  spring.snap    { duration: 260, dampingRatio: 0.9 }   reakcja na dotyk, chip, przełącznik
  spring.settle  { duration: 420, dampingRatio: 0.82 }  wejście elementu, zmiana układu
  spring.sheet   { duration: 520, dampingRatio: 0.88 }  arkusz, toast, duże przesunięcia
  spring.check   { duration: 360, dampingRatio: 0.55 }  potwierdzenie odhaczenia (jedyne z odbiciem)

Timing zostaje wyłącznie dla krycia — zmiana opacity na sprężynie wygląda
źle. Zostawiam `duration.fast/base/slow` i easeEnter dla przypadków czysto
opacity, resztę usuwam.

API:
  export function motionSpring(key: SpringToken, reduced: boolean)
  Przy redukcji ruchu zwraca konfigurację natychmiastową (duration 0), żeby
  komponenty nie rozgałęziały się same.

Stan wciśnięcia (src/components/ui/press.ts):
  Dziś to `active:opacity-90 active:scale-98` na klasach. Zamień na
  usePressAnimation() z Reanimated: skala na spring.snap plus zmiana
  płaszczyzny (surface → surface-elevated) zamiast samego przygaszenia.
  Przy redukcji ruchu zostaje wyłącznie zmiana płaszczyzny, bez skali.
  Zachowaj dotychczasową nazwę usePressClass jako cienką nakładkę tam, gdzie
  animacja jest nieopłacalna (elementy w długich listach) — i napisz w
  komentarzu, kiedy której używać.

CLAUDE.md, §5 „Ruch i haptyka": przepisz akapit. Zdanie „Sprężyna jest
dozwolona w jednym miejscu" przestaje obowiązywać i musi zniknąć — zastąp je
regułą, że ruch bierze się wyłącznie z tokenów motion.ts i że każda animacja
sprawdza useReducedMotion().

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- nowy test src/theme/__tests__/motion.test.ts: motionSpring przy reduced=true
  daje ruch natychmiastowy dla każdego tokenu
- grep po app/ i src/features/ nie znajduje withSpring ani withTiming
  z wartościami wpisanymi wprost — wszystko przez tokeny
- CLAUDE.md §5 nie zawiera już zdania o jednej dozwolonej sprężynie
- lista z §9 CLAUDE.md
```

---

## PROMPT F4 — skala typograficzna z prawdziwym display

```text
Zadanie: podniesienie kontrastu typograficznego i wprowadzenie trackingu
optycznego. Aplikacja, w której jedno spojrzenie ma powiedzieć „ile dziś
zrobiłem", potrzebuje liczby, która naprawdę dominuje ekran.

Nowe warianty (src/theme/typography.ts + tailwind.config.js, parzystości
pilnuje istniejący test):
  displayLg  44 / 48  tracking −1.2  sans-semibold   liczba główna statystyk
  numXl      44 / 48  tracking −1.0  mono            licznik serii, duże liczby

Tracking optyczny — przelicz istniejące warianty według tabeli, zamiast
zostawiać wartości ustalone osobno:
  >= 40px  →  −1.2
  32–39    →  −0.8   (display 34: było −0.5)
  24–31    →  −0.4   (titleLg 26: było −0.3)
  18–23    →  −0.2   (title 19: było −0.1)
  15–17    →   0
  <= 14    →   0 dla body/caption, +0.2 dla label (bez zmian)
  quote (Literata 22) zostaje na 0 — szeryfowy krój w tym rozmiarze nie chce
  ujemnego trackingu i to jest wyjątek świadomy, nie przeoczenie.

Zastosowanie:
  app/(tabs)/stats.tsx — PaceCard: liczba główna na displayLg zamiast display.
  Ekran „Dziś" — licznik serii przy kamieniu milowym na numXl.
  Nigdzie indziej. Dwa nowe rozmiary mają być rzadkie; jeśli pojawią się na
  trzecim ekranie, znaczy, że przestały cokolwiek znaczyć.

Zakaz bez zmian: żadnych wersalików, żadnego fontWeight, minimum 13px.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- test typografii przechodzi z nowymi wariantami i nowym trackingiem
- layout nie łamie się przy fontScale 1.3 na ekranie statystyk — displayLg
  przy 1.3 to 57px, sprawdź, czy liczba trzycyfrowa się mieści
- docs/design-system.md: tabela wariantów zaktualizowana razem z tabelą
  trackingu optycznego
- lista z §9 CLAUDE.md
```

---

## PROMPT F7 — mapa dni jako sygnatura

```text
Zadanie: mapa dni to jedyny element, po którym ktoś rozpozna tę aplikację
na zrzucie ekranu. Dziś wygląda jak wykres aktywności z GitHuba z 2015 roku.

Zmiany w src/components/ui/streak-grid.tsx:
  Komórka rośnie z 16 do 18 dp, odstęp z 4 do 5 dp, promień z xs na
  concentricRadius — kwadrat 18 dp z promieniem 8 to kształt, nie kratka.
  Krzywizna ciągła (F1).
  Poziom 0 przestaje być wypełnieniem: dostaje `bg-surface-sunken` plus
  krawędź `border-hairline`. Dzień bez danych ma wyglądać na brak, a nie na
  szary klocek — i nadal identycznie jak dzień pominięty (reguła krytyczna 7).
  Dzisiaj: pierścień z border-strong o grubości 1.5 dp z odstępem od
  wypełnienia, zamiast obrysu na samej komórce.

Ruch wejścia:
  Kolumny pojawiają się kaskadą od lewej, spring.settle z opóźnieniem
  20 ms na kolumnę, sufit łącznego opóźnienia 240 ms. Przy useReducedMotion
  cała mapa pojawia się naraz, samym kryciem.
  Animacja odpala się raz, przy pierwszym pojawieniu komponentu — nie przy
  każdym przewinięciu ekranu i nie przy każdym odświeżeniu danych.

Zmiana poziomu:
  Gdy komórka zmienia poziom (odhaczenie dzisiaj), przejście koloru na
  spring.snap. Bez skoku.

Nie ruszamy: hitSlop i długiego przytrzymania z P16, etykiet dostępności,
skali serii ani jej znaczenia.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- cel dotykowy komórki nadal >= 48 dp z hitSlop
- przy włączonej redukcji ruchu nie ma ani jednej transformacji
- mapa 12 tygodni mieści się w marginesie ekranu 20 dp na najwęższym
  urządzeniu z macierzy testów — jeśli nie, zmniejsz odstęp, nie komórkę
- lista z §9 CLAUDE.md
```

---

## PROMPT F8 — „Dziś" bez kart: lista pogrupowana

```text
Zadanie: usunięcie zmęczenia kartami z głównego ekranu. Lista nawyków
przestaje być stosem obrysowanych prostokątów, a staje się jedną
płaszczyzną z włosowymi separatorami.

Ekran „Dziś" (app/(tabs)/index.tsx + src/features/habits/components/):
  TaskGroupList renderuje grupę pory dnia jako jedną płaszczyznę `surface`
  z promieniem md i krzywizną ciągłą. Wiersze wewnątrz nie mają własnego tła
  ani obrysu — rozdziela je `Divider` na `bg-hairline`, wcięty o szerokość
  znacznika, żeby separator nie ciął ikony.
  Pierwszy i ostatni wiersz w grupie dostają promień koncentryczny, żeby
  wypełnienie stanu wciśnięcia nie wystawało poza narożnik płaszczyzny.
  Nagłówek grupy (pora dnia) zostaje na wariancie label, poza płaszczyzną.

Stan wciśnięcia wiersza: zmiana płaszczyzny na surface-elevated przez
usePressAnimation z F3, bez skali — skala pojedynczego wiersza w długiej
liście wygląda na usterkę, nie na reakcję.

Znacznik wykonania (CheckIndicator):
  Dziś skala 1.18 → sprężyna. Zamień na morfing kształtu: pusty znacznik to
  okrąg z obrysem, wykonany to kwadrat z promieniem xs wypełniony akcentem,
  przejście na spring.check. Zmiana kształtu niesie stan lepiej niż zmiana
  rozmiaru i jest czytelna także przy redukcji ruchu — przy niej zostaje sama
  zmiana wypełnienia i kształtu, bez odbicia.
  Haptyka bez zmian: impactAsync(Light) przy odhaczeniu.

Karty zostają tam, gdzie treść jest naprawdę odrębna: AllDoneCard,
DailyQuoteCard, RecallCard, LetterCard, karty propozycji z P11 i P13.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- cały wiersz nadal klikalny, cel dotykowy >= 48 dp
- swipe „pomiń" działa bez zmian
- przy fontScale 1.3 nazwa nawyku zawija się do dwóch linii, a separator
  nie rozjeżdża się z wcięciem
- lista z §9 CLAUDE.md
```

---

## PROMPT F9 — liczby, które się zmieniają

```text
Zadanie: animowany licznik dla wariantów monospace. Cyfry tabelaryczne już
mamy, więc szerokość nie skacze — brakuje tylko przejścia.

Nowy komponent src/components/ui/animated-number.tsx:
  export type AnimatedNumberProps = {
    value: number;
    variant?: 'numXl' | 'numLg' | 'num' | 'display' | 'displayLg';
    tone?: TextTone;
    /** Gotowa etykieta dostępności — czytnik ekranu dostaje wartość docelową,
        nie kolejne klatki. */
    accessibilityLabel: string;
  };

  Wartość dochodzi do docelowej na spring.settle. Przy useReducedMotion
  zmienia się natychmiast. Liczba jest zawsze całkowita — animowanie części
  dziesiętnych daje migotanie, nie efekt.
  Implementacja przez useDerivedValue + useAnimatedProps na Text, bez
  setState w pętli.

Zastosowanie:
  PaceCard (liczba główna statystyk), licznik serii na ekranie „Dziś",
  DayProgress. Nigdzie indziej.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- test: przy reduced motion komponent renderuje wartość docelową w pierwszej
  klatce
- czytnik ekranu ogłasza wartość docelową raz, a nie każdą klatkę
- lista z §9 CLAUDE.md
```

---

## PROMPT F10 — ciągłość między ekranami

```text
Zadanie: przejścia, które łączą ekrany zamiast je ciąć. Sprawdź wersjonowaną
dokumentację Expo SDK 57 przed napisaniem pierwszej linii — API nawigacji
zmienia się między wydaniami (CLAUDE.md §2).

1. Przejścia ekranów
   app/_layout.tsx i app/habit/_layout.tsx: przejście poziome zastąp
   przejściem z jednoczesnym przesunięciem i skalowaniem tła (efekt „karta
   wychodzi z listy"), jeśli Expo Router w SDK 57 to udostępnia bez natywnego
   modułu. Jeśli nie — zostaw domyślne i zapisz w komentarzu, dlaczego.

2. Animacja układu listy
   Lista na „Dziś" przy zmianie zawartości (odhaczenie wypycha pozycję poza
   sufit dnia, pojawia się nadmiar po „Pokaż wszystko") animuje układ przez
   LayoutAnimationConfig i itemLayoutAnimation z Reanimated, na spring.settle.
   Przy redukcji ruchu bez animacji układu.

3. Arkusz przeciągany
   src/components/ui/sheet.tsx: gest przeciągnięcia w dół zamyka arkusz,
   z progiem 25% wysokości albo prędkością powyżej 800 dp/s. Uchwyt
   (4×36 dp, bg-border-strong, rounded-full) na górze arkusza — dziś nie ma
   nic, co mówiłoby, że arkusz da się zamknąć gestem.
   Zamknięcie gestem woła to samo onClose co dotknięcie tła.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- przy włączonej redukcji ruchu żadne z trzech nie wykonuje transformacji
- gest zamykania arkusza nie blokuje przewijania treści wewnątrz arkusza
- cofnięcie gestem nie gubi stanu formularza w arkuszu
- lista z §9 CLAUDE.md
```

---

## PROMPT F5 — pływający tab bar i edge-to-edge

> **Wymaga decyzji.** Wariant z rozmyciem dokłada zależność `expo-blur`.
> CLAUDE.md §8: pytaj przed dodaniem zależności. Wariant bez rozmycia jest
> opisany niżej i nie wymaga niczego.

```text
Zadanie: pasek zakładek przestaje być belką przyklejoną do dołu ekranu.

Wariant A (z zależnością expo-blur — wymaga zgody):
  Pływający pasek: margines poziomy 20 dp, dolny margines równy safe area
  plus 8 dp, promień xl, krzywizna ciągła. Tło: BlurView z intensywnością 40
  i tintem zgodnym z motywem, plus warstwa `surface/70` pod spodem, bo samo
  rozmycie na ciemnym tle daje za mały kontrast dla etykiet.
  Górna krawędź świetlna `border-edge/[0.08]` zamiast borderTop.

Wariant B (bez nowych zależności):
  Ten sam kształt i to samo pływanie, ale tło pełne: `surface-elevated`
  plus cień `sheet` z elevation.ts w obu motywach. Wygląda o włos gorzej
  i nie kosztuje ani jednego kilobajta.

Wspólne dla obu:
  Wskaźnik aktywnej zakładki: pigułka `surface-sunken` pod ikoną i etykietą,
  przesuwana na spring.snap. Kolor aktywnej zakładki to nadal kontrast
  (text-primary), nigdy akcent — reguła krytyczna 8.
  Haptyka przy zmianie zakładki: selectionAsync(). Nigdy przy przewijaniu.
  Edge-to-edge: sprawdź w dokumentacji SDK 57, czy projekt ma już włączone
  edge-to-edge; jeśli nie, włącz i popraw <Screen> tak, żeby dolny inset
  liczył wysokość pływającego paska, a nie wysokość systemowego.
  Treść przewijana musi kończyć się nad paskiem, nie pod nim.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- ostatnia pozycja każdej listy jest w całości widoczna nad paskiem
- pasek nie zasłania toasta ani przycisku głównego arkusza
- cele dotykowe zakładek >= 48 dp mimo mniejszej wysokości paska
- sprawdzone w obu motywach i przy fontScale 1.3 (etykiety mogą zniknąć na
  rzecz samych ikon — jeśli tak zdecydujesz, dodaj accessibilityLabel)
- lista z §9 CLAUDE.md
```

---

## PROMPT F6 — jeden zestaw ikon o stałej grubości kreski

> **Wymaga decyzji.** Dokłada zależność `lucide-react-native` (korzysta
> z `react-native-svg`, które już jest). Wariant bez zależności niżej.

```text
Zadanie: ikony przestają mieszać metafory i grubości kresek.

Wariant A (z zależnością lucide-react-native — wymaga zgody):
  Nowy komponent src/components/ui/icon.tsx, jedyne wejście do ikon w całej
  aplikacji:
    export type IconName = /* zamknięta lista nazw używanych w produkcie */
    export type IconSize = 16 | 20 | 24
    Grubość kreski stała: 1.75 przy 20 i 24, 2 przy 16.
    Kolor wyłącznie z tokenu przez color() z useTheme.
  Przenieś wszystkie użycia Ionicons na <Icon>. Lista do zmapowania:
    today-outline, stats-chart-outline, book-outline, ellipsis-horizontal,
    checkmark-done, checkmark-circle, sparkles-outline, leaf-outline,
    arrow-forward, map-outline i pozostałe — zrób grep przed startem.
  Dodaj regułę do eslint.config.js: import z '@expo/vector-icons' zakazany
  w app/**, src/features/** i src/components/** poza src/components/ui/icon.tsx.
  Zależność @expo/vector-icons zostaje w package.json tylko wtedy, gdy używa
  jej jeszcze coś poza produktem — inaczej usuń.

Wariant B (bez nowych zależności):
  Ten sam komponent <Icon> i ta sama reguła ESLint, ale pod spodem nadal
  Ionicons, zawężone do wariantów `-outline` i do trzech rozmiarów.
  Zysk jest mniejszy, ale zamknięta lista nazw i jedno wejście zostają —
  a migracja na inny zestaw później to wtedy zmiana w jednym pliku.

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- grep po app/ i src/features/ nie znajduje '@expo/vector-icons'
- każda ikona niosąca znaczenie ma accessibilityLabel; dekoracyjne mają
  accessibilityElementsHidden
- lista z §9 CLAUDE.md
```

---

## PROMPT F11 — ikona aplikacji, splash, pierwsze wrażenie

> **Wymaga decyzji.** Dotyka `app.config.ts` i zasobów. CLAUDE.md §8.

```text
Zadanie: pierwsze dwie sekundy kontaktu z aplikacją. Dziś ikona i splash nie
mówią nic o kierunku wizualnym produktu.

Ikona:
  Motyw ciemny jako podstawa: tło grafitowe (#131619), znak w mosiądzu.
  Znakiem powinna być mapa dni sprowadzona do minimum — trzy albo cztery
  kwadraty o różnym nasyceniu akcentu, z krzywizną ciągłą. To jedyny element
  aplikacji, który da się rozpoznać w 60 dp.
  Warianty: ikona monochromatyczna dla iOS (tinted), adaptacyjna dla Androida
  (osobne tło i warstwa znaku), oraz wariant jasny.
  Zero tekstu w ikonie, zero gradientu, zero poświaty.

Splash:
  Tło `background` z motywu systemowego użytkownika, znak wyśrodkowany,
  bez animacji i bez napisu. Splash ma zniknąć zanim ktokolwiek zdąży go
  przeczytać — jeśli trwa dłużej niż 400 ms, problemem jest start aplikacji,
  a nie splash.

Zanim cokolwiek zmienisz w app.config.ts, pokaż mi planowane wartości
i poczekaj na zgodę.

Kryteria odbioru:
- npm run typecheck, npm run lint
- ikona czytelna w 60 dp na jasnym i ciemnym tle systemowym
- eas build --profile development przechodzi na obu platformach
- zasoby w assets/ mają wymiary wymagane przez SDK 57 (sprawdź w dokumentacji
  wersjonowanej, nie z pamięci)
```

---

## PROMPT F12 — ekran przeglądu systemu i testy wizualne

```text
Zadanie: bez tego nie da się sprawdzić dwóch motywów razy dwóch skal czcionki
inaczej niż klikaniem po całej aplikacji. To ma powstać na końcu i ma zostać
na stałe.

Ekran deweloperski app/design.tsx (poza nawigacją, dostępny z ustawień tylko
gdy __DEV__):
  Sekcje: kolory (wszystkie tokeny jako próbki z nazwą), typografia (każdy
  wariant z tekstem polskim zawierającym diakrytykę), promienie, odstępy,
  głębia, ruch (przycisk odpalający każdy token sprężyny), komponenty
  (każdy z src/components/ui/ w każdym wariancie i w każdym stanie:
  spoczynek, wciśnięcie, nieaktywny, ładowanie, błąd).
  Na górze dwa przełączniki: motyw i symulowana skala czcionki (1.0 / 1.3).

Testy do rozszerzenia:
  src/theme/__tests__/contrast.test.ts — dołóż nowe tokeny z F2 i nowe
  warianty typografii z F4.
  src/theme/__tests__/palette.test.ts — bez zmian poza nowymi tokenami.
  Nowy src/theme/__tests__/radii.test.ts — jeśli nie powstał przy F1.

Dopisz do CLAUDE.md §9 („Definition of done dla UI") dwa punkty:
  [ ] nowy komponent widoczny na ekranie /design we wszystkich stanach
  [ ] zmiana tokenu sprawdzona na /design w obu motywach i przy fontScale 1.3

Kryteria odbioru:
- npm run typecheck, npm run lint, npm run test
- ekran /design nie trafia do buildu produkcyjnego (sprawdź, że gałąź jest
  wycinana przez __DEV__, a nie tylko ukrywana)
- CLAUDE.md §9 zawiera oba nowe punkty
```

---

## Definicja ukończenia dla zmian wizualnych

Poza listą z §9 CLAUDE.md, każdy prompt z tego pliku kończy się dopiero, gdy:

1. Nowa wartość istnieje jako **token**, nie jako klasa w komponencie.
   Jeśli po zmianie da się ją znaleźć tylko greppując po `src/components/`,
   zmiana jest niedokończona.
2. Test parzystości dla tej rodziny tokenów przechodzi (paleta, typografia,
   promienie, ruch).
3. `docs/design-system.md` opisuje stan po zmianie, a nie przed.
4. Zmiana jest sprawdzona w obu motywach i przy `fontScale` 1.3 — po F12
   na ekranie `/design`, wcześniej ręcznie.
5. Przy włączonej redukcji ruchu nie zostaje ani jedna transformacja.

I jedna rzecz, której żaden z tych promptów nie ma prawa zmienić: **akcent
nadal znaczy wyłącznie postęp, a czerwień wyłącznie akcję niszczącą.**
Modernizacja formy nie jest pretekstem do rozluźnienia reguł krytycznych 7 i 8.
