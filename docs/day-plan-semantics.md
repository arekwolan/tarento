# Semantyka planu dnia

## Źródło prawdy

Każda data logiczna ma co najwyżej jeden `day_plans` i po jednym
`day_plan_items` dla należących do niej nawyków. Wybrano pełny snapshot zamiast
samych wykluczeń, ponieważ poza informacją „nie oczekuj” trzeba zachować cel,
koszt, kolejność oraz warunki dnia. Dzięki temu późniejsza edycja nawyku,
limitu, strefy lub kształtu dnia nie przepisuje historii.

`ensure_day_plan(plan_date)` jest jedyną drogą tworzenia i rekoncyliacji. RPC
czyta właściciela z `auth.uid()`, limit i strefę z profilu, a budżet z day-shape.
Unikalności `(user_id, plan_date)` i `(day_plan_id, habit_id)` czynią retry
idempotentnym. Klient ma do tabel wyłącznie `SELECT`.

## Stany

- `planned` — pozycja była oczekiwana. Brak wykonania obniża podsumowanie;
  ręczne `skipped` zachowuje dotychczasowe znaczenie i nie zrywa serii.
- `overflow` — system nie umieścił pozycji w podstawowym planie. Samo
  „Pokaż wszystko” niczego nie zapisuje i nie tworzy obowiązku.
- `completed` — istniejący log `done` albo `partial`. Wykonane overflow staje
  się pozytywną okazją 1/1, ale jego wcześniejszy stan pozostaje `overflow`.
- `skipped` — wyłącznie ręczny log użytkownika. System nigdy nie zapisuje tego
  statusu podczas ukrywania overflow.
- `rest` / `quiet_week` — wszystkie niewykonane pozycje są neutralnym
  overflow. Dobrowolne wykonanie nadal liczy się pozytywnie.

Kanoniczny zbiór okazji zwraca `get_expected_habit_opportunities(from, to)`.
Korzystają z niego serie, podsumowania dzienne, heatmapa, adherence,
statystyki per nawyk, obserwacje, wykonanie etapów ścieżek, downshift oraz
historyczny krok prognozy.

## Rekoncyliacja limitu

Przy zmianie limitu w tym samym dniu klasyfikacja pozycji z istniejącym logiem
jest przypięta. Dlatego obniżenie 3→2 nie usuwa ani nie anuluje ukończonej
pozycji planned, a podwyższenie 2→4 nie zamienia ukończonego overflow w nowy
obowiązek. Pozostałe pozycje są wybierane stabilnie: koszt, `sort_order`, UUID.
Dzień odpoczynku, quiet week, emerytura, archiwizacja lub zmiana harmonogramu
mogą jedynie przenieść niewykonane pozycje do neutralnego overflow.

## Offline i kompatybilność

Jeśli serwerowy snapshot nie jest jeszcze dostępny, klient zapisuje pod tym
samym persystowanym kluczem deterministyczny snapshot lokalny. Po odzyskaniu
sieci RPC zastępuje go snapshotem bazy. Powtórzone odtworzenie kolejki nie
duplikuje planu ani pozycji; `habit_logs` zachowuje dotychczasowy upsert po
`(habit_id, log_date)`. Mutacja kolejki używa `upsert_habit_log_for_plan`, który
w jednej transakcji najpierw zapewnia plan starej daty logicznej, a potem
zapisuje log; replay nie zależy więc od kolejności odświeżania zapytań.

Dla historycznej daty bez `day_plans` obowiązuje jawny fallback: dotychczasowy
harmonogram, `started_on` i data emerytury. Rest oraz aktywna część quiet week
są neutralne. Istniejące `done/partial` poza obowiązkiem jest pozytywną okazją,
a brak takiego wpisu nie tworzy długu.

Przyszłe dni nie mają jeszcze snapshotu. Prognoza używa snapshotów/fallbacku
dla przeszłości, a dla przyszłych okazji harmonogramu, dopóki właściwy plan dnia
nie zostanie utworzony.
