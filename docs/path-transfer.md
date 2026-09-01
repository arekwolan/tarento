# Sprawdzian transferu i potwierdzenie wdrożenia

## Zakres

Sprawdzian pojawia się wyłącznie, gdy etap spełni istniejące kryterium
`min_days + completion_threshold` albo osiągnie `max_days`. Użytkownik sam
otwiera kartę. Zamknięcie arkusza niczego nie zapisuje i nie przesuwa etapu.
To nie jest quiz z treści książki ani pozycja na liście dnia.

Odpowiedzi `yes`, `not_yet` i `no_opportunity` opisują deklarowany transfer.
Nie są oceną, nie zmieniają serii i nie są używane przez statystyki wykonania.
Opcjonalny przykład ma limit 280 znaków.

## Dane i lifecycle

`path_transfer_responses` jest historią append-only. Klient ma wyłącznie
odczyt; zapis przechodzi przez idempotentne `submit_path_transfer`. Wspólny RPC
zapisuje odpowiedź i dopiero dla decyzji `advance` wywołuje istniejące
`advance_path_stage`. `client_request_id` sprawia, że retry po utracie sieci nie
duplikuje odpowiedzi ani przejścia.

`stay`, `downshift` i `no_opportunity` ustawiają siedmiodniowe odłożenie bez
zmiany logów lub dat serii. Podczas `reentry_until` sprawdzian jest wyciszony.
Downshift otwiera istniejący przepływ zmniejszenia nawyku; B3 nie ma drugiego
silnika parametrów praktyki.

Po `end_path(..., 'completed', ...)` powstaje jeden rekord
`path_implementation_confirmations`. Snapshot zawiera źródło, ukończone etapy
oraz praktyki zachowane/wycofane z licznikami wykonania. Odpowiedzi transferu
nie są kopiowane do snapshotu i są czytane osobno. UI zawsze mówi, że wykonanie
i deklarowany transfer to odrębne fakty i nie dowodzą przyczynowości.

## Prywatność, RLS i usuwanie

Obie tabele mają RLS dziedziczące właściciela przez `user_paths`. Nie ma polityk
bezpośredniego zapisu. `archive_path_transfer_data` działa tylko dla właściciela,
archiwizuje odpowiedzi, usuwa prywatne przykłady i czyści zdanie z potwierdzenia.
Aktywne odpowiedzi oraz potwierdzenia wchodzą do eksportu w formacie 4. Usunięcie
konta obejmuje dane przez klucze obce `on delete cascade`.

Analityka `path_transfer_answered` może zawierać wyłącznie enum `response` oraz
`protocol_type`. Prywatny przykład, tytuł źródła i tytuł praktyki nigdy nie są
częścią zdarzenia.

## Offline

Mutacja transferu używa tej samej persystowanej kolejki TanStack Query/MMKV co
logi i zapis na ścieżkę. Optymistyczna odpowiedź zamyka duplikat karty, ale
zakończenie ostatniego etapu nie jest dostępne, dopóki serwer nie potwierdzi
zapisu. Po powrocie sieci ten sam request jest bezpiecznie ponawiany.
