# Mapa tarcia

## Granica produktu

Mapa tarcia nie zmienia znaczenia `habit_logs.status = 'skipped'`. Pominięcie
zapisuje się natychmiast, domyka decyzję dnia, nie przedłuża serii i nie wymaga
odpowiedzi na dodatkowe pytanie. Arkusz przyczyny jest opcjonalny; zamknięcie
go niczego nie zapisuje i nie cofa pominięcia.

Powód jest jednym z sześciu enumów: `forgot`, `no_time`, `too_big`,
`wrong_time`, `environment`, `not_today`. Nie istnieje pole free text ani enum
oceniający użytkownika. Zdarzenia nie trafiają do `day_notes`, statystyk
wykonania ani algorytmów serii.

## Dane, RLS i offline

`habit_friction_events` przechowuje najwyżej jeden aktywny powód per nawyk i
dzień logiczny. Zmiana powodu archiwizuje poprzedni rekord. Usunięcie również
ustawia `archived_at`; cofnięcie jest stanową, idempotentną mutacją i odrzuca
stary rollback, jeśli w międzyczasie zapisano nowszy powód.

`save_habit_friction_event` sprawdza właściciela, zamknięty enum, dzień logiczny
oraz idempotency key z fingerprintem. Siedmiodniowy margines daty pozwala
dokończyć żądanie z kolejki offline po zmianie doby, ale nie otwiera dowolnego
backfillu. Mutacje są persystowane przez istniejącą kolejkę TanStack Query/MMKV.

`habit_friction_responses` jest append-only śladem `acted` albo `dismissed`.
Obie tabele mają RLS i klient ma do nich tylko SELECT. Zapisy przechodzą przez
RPC. Aktywne zdarzenia oraz odpowiedzi wchodzą do eksportu danych w formacie 6;
soft-deleted powody są z niego wyłączone. Usunięcie konta obejmuje obie tabele
przez `on delete cascade`.

## Deterministyczna sugestia

Stałe domenowe to próg 3 zdarzeń, okno 42 dni i suppression 30 dni. Silnik
grupuje aktywne zdarzenia po nawyku i enumie, a następnie zwraca najwyżej jedną
kartę. Wygrywa większy licznik, nowsze wystąpienie i stała kolejność enumów.
Nie ma score, diagnozy ani AI.

Routing jest zamknięty:

- `no_time` i `too_big` otwierają istniejący preview downshiftu;
- `wrong_time` otwiera preview pasma i zapisuje zmianę jako rewizję
  `calibration/time_calibration`;
- `forgot` otwiera formularz preview godziny. Przypomnienie nie zapisuje się
  ani nie prosi o uprawnienie bez jawnego potwierdzenia użytkownika;
- `environment` pokazuje jeden krok przygotowania i zapisuje tylko jednorazową
  odpowiedź, bez tworzenia stałego trackera;
- `not_today` prowadzi do istniejącej decyzji o dniu pustym.

Po `acted` potrzeba trzech nowych zdarzeń po dacie decyzji. `dismissed` ukrywa
kartę na 30 dni. Podczas quiet week karta sugestii jest niewidoczna, bez banera
i bez ujawniania stanu ciszy na ekranie Dzisiaj.

## Analityka

Do telemetrii mogą trafić wyłącznie `reason` oraz odpowiedź `acted/dismissed`.
Identyfikator i tytuł nawyku, dzień, notatka, strefa i jakikolwiek tekst
użytkownika nie są właściwościami zdarzeń analitycznych.
