# Historia wersji zachowania

## Zakres

`habit_revisions` jest append-only historią definicji nawyku. Jedna rewizja
opisuje zmianę parametrów, źródło, powód oraz logiczną datę obowiązywania.
Zwykłe odhaczenie, pominięcie lub poprawa `habit_logs` nie jest zmianą
definicji i nie tworzy rewizji.

Snapshot jest celowo ograniczony do pól potrzebnych w czytelnym diffie:
nazwa i opis, wielkość praktyki, progresja, harmonogram, pora, przypomnienie,
proweniencja ścieżki/książki oraz stan active/retired/archived. Nie zawiera
logów wykonania, promptów, notatek dnia ani sekretów.

Migracja tworzy pojedynczy `initial_snapshot` dla nawyków istniejących w chwili
wdrożenia. Nie próbuje odtwarzać historii, której wcześniej nie rejestrowano.

## Atomowość i idempotencja

Trigger na `habits` zapisuje rewizję w tej samej transakcji co trwałą zmianę.
Obejmuje to ręczną edycję, downshift, retirement/restore, archive/unarchive oraz
istniejące wielowierszowe RPC lifecycle ścieżek. Bezpośredni zapis klienta
przechodzi przez `update_habit_with_revision` albo
`set_habit_lifecycle_with_revision`; oba przyjmują źródło, powód, logiczną datę
i klucz idempotencji.

Unikalność `(habit_id, idempotency_key)` chroni retry przed duplikacją. Hash
żądania nie pozwala użyć tego samego klucza dla innej zmiany. Oczekiwane
`updated_at` lub identyfikator ostatniej rewizji wykrywa konflikt dwóch urządzeń
zamiast cicho nadpisywać późniejszą wersję.

Źródła to `user`, `downshift`, `path`, `calibration`, `reentry`, `restore` i
`day_fit`. Kalibracja oraz day-fit korzystają z tego samego kontraktu RPC, gdy
ich mutacja zostanie wywołana; nie istnieje osobna ścieżka zapisu poza historią.

## Przywracanie

Historia w szczegółach nawyku pokazuje domenowy timeline, na przykład
`10 min → 2 min`, zamiast surowego JSON. Wybranie wcześniejszej wersji najpierw
wywołuje `preview_habit_revision_restore`. Preview przelicza minuty względem
aktualnego planu dnia, limit aktywnych nawyków oraz konflikt z aktywną ścieżką.

Przekroczenie budżetu lub dziennego limitu blokuje zapis. Konflikt z aktywną
ścieżką wymaga jawnego potwierdzenia w tym samym preview. Rollback zmienia tylko
parametry definicji; nie przywraca historycznego stanu lifecycle ani nie usuwa
proweniencji. Sam rollback dopisuje nową rewizję `restore/rollback` wskazującą
wersję źródłową i nigdy nie kasuje historii.

Mutacja rollbacku jest persystowana w istniejącej kolejce TanStack Query/MMKV.
Optymistyczny snapshot może przetrwać restart offline, a powrót sieci ponawia
ten sam identyfikator żądania. Konflikt wersji cofa optimistic update i wymaga
nowego preview.

## Prywatność, eksport i usuwanie

RLS pozwala użytkownikowi wyłącznie czytać rewizje należące do jego nawyku.
INSERT/UPDATE/DELETE nie są dostępne z klienta; zapis wykonują kontrolowane RPC
i trigger. Snapshot może zawierać prywatną nazwę nawyku, dlatego rewizje są
częścią eksportu danych w formacie 5. Usunięcie konta lub nawyku usuwa historię
przez klucze obce `on delete cascade`.

W1 nie dodaje obserwacji skuteczności wersji. Takie porównanie wymagałoby
wystarczającej liczby porównywalnych okazji i normalizacji harmonogramu; bez
tego aplikacja nie sugeruje przyczynowości.
