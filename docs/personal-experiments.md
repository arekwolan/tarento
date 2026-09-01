# Osobisty eksperyment A/B

## Zakres

Eksperyment dotyczy jednego istniejącego nawyku i jednej cechy: `time_of_day`
albo `start_value`. Blok A zawsze poprzedza blok B. Nie ma codziennej
randomizacji, istotności statystycznej ani języka przyczynowego. Wynik mówi
wyłącznie, który wariant w tym krótkim okresie pasował częściej.

Każdy blok zbiera siedem porównywalnych okazji. Okazją jest wyłącznie pozycja
`planned` w trwałym `day_plan`. Rest, quiet week i overflow są neutralne;
wykonany overflow również nie podnosi wyniku eksperymentu. Dla zamkniętego dnia
sprzed wdrożenia snapshotów działa ten sam jawny fallback harmonogramowy co w
statystykach. Granice bloków są datami logicznymi, więc zmiana DST nie skraca
ani nie wydłuża bloku.

## Stan i rewizje

`personal_experiments` przechowuje stany `draft`, `active`, `paused`,
`completed` i `cancelled`, pełny snapshot konfiguracji sprzed startu oraz dwa
wąskie patche wariantów. Unikalny indeks pozwala mieć jedną otwartą pracę:
draft, aktywny eksperyment, pauzę albo ukończony wynik czekający na decyzję.

Start, przejście A→B, pauza, wznowienie, anulowanie i końcowy wybór zmieniają
nawyk przez istniejący trigger `habit_revisions`. Historia pozostaje append-only.
Pauza i anulowanie przywracają tylko badaną cechę, nie nadpisują równoległych
edycji pozostałych pól. Decyzja A, B albo wcześniejsze ustawienie jest kolejną
normalną rewizją.

## Przypomnienia i bezpieczeństwo planu

Zmiana pory domyślnie nie dotyka przypomnienia. Użytkownik może jawnie zgodzić
się na dopasowanie już istniejącego przypomnienia do 08:00, 14:00 albo 20:00.
Brak przypomnienia nie jest zgodą na jego włączenie i RPC odrzuca taki zapis.

Draft nie powstaje podczas quiet week, bez czternastu przyszłych okazji w
horyzoncie 90 dni ani wtedy, gdy aktywna ścieżka ma przed końcem planu domknąć
reentry lub osiągnąć sufit bieżącego etapu dla tego samego nawyku. Forecast
wyklucza znany przyszły overflow; rzeczywisty wynik zawsze korzysta z finalnego
snapshotu dnia.

## Offline i idempotencja

Utworzenie draftu ma unikalny `create_idempotency_key`. Każda późniejsza akcja
zapisuje klucz i fingerprint w `personal_experiment_commands`. Ten sam klucz z
tym samym żądaniem zwraca bieżący stan, a użyty do innej treści jest odrzucany.
Mutacje akcji są persystowane w TanStack Query/MMKV, optymistycznie aktualizują
eksperyment i nawyk, a po powrocie sieci ponawiają ten sam identyfikator.

RLS obu tabel udostępnia użytkownikowi wyłącznie `SELECT` własnych rekordów.
INSERT i UPDATE przechodzą przez atomowe RPC; DELETE nie jest dostępny.
