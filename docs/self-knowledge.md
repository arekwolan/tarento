# W3 — prywatna Instrukcja obsługi siebie

Instrukcja przechowuje hipotezy zaakceptowane przez użytkownika na podstawie jego
własnych, kanonicznych okazji wykonania. Nie jest profilem osobowości, diagnozą ani
źródłem automatycznych zmian planu.

## Zamknięty katalog wzorców

Wersja `self-rules-v1` obsługuje wyłącznie: porę dnia, rozmiar celu, typ dnia,
powtarzalne tarcie, wersję minimalną oraz wynik przed/po rewizji. Silnik nie czyta
notatek dnia, listów, nazw nawyków, opisów ani tekstowego dowodu transferu. Nazwa
nawyku jest dołączana dopiero w prywatnym widoku z tabeli `habits`.

## Ograniczenia statystyczne

- Porównanie wymaga co najmniej 6 kanonicznych okazji w każdej grupie i różnicy
  co najmniej 0,20 pomiędzy udziałami wykonań. Interfejs zawsze pokazuje surowe
  liczniki `x/n`, także przy małym N — nie eksponuje procentu sugerującego
  fałszywą precyzję.
- Powtarzalne tarcie wymaga co najmniej 3 zdarzeń tego samego enumu.
- Okno analizy ma 120 zakończonych dni. Bieżący dzień nie wchodzi do wyniku.
- Pora dnia jest porównywana tylko przy tym samym harmonogramie. Typ dnia tylko
  wewnątrz jednej rewizji. Starszy `day_plan` bez snapshotu `day_kind` jest
  pomijany; migracja nie rekonstruuje historii z aktualnej rotacji.
- Przed/po rewizji używa liczby oczekiwanych okazji, a nie liczby dni. Dzięki temu
  nie porównuje surowych okresów o różnej gęstości harmonogramu.
- Wynik jest opisowy. Nie dowodzi przyczynowości i może odzwierciedlać inne zmiany
  warunków. Dlatego każda reguła zawiera zakres dat, liczność, wersję algorytmu i
  datę ponownej oceny.

## Lifecycle, prywatność i plan

Kandydat nie wpływa na plan. Dopiero ręczna akceptacja pozwala wyświetlić regułę
jako jawny, wyłączalny kontekst w preview nowego nawyku albo protokołu. Kontekst
sam nie zmienia pól ani nie omija budżetu/path-fit.

Nowe dane sprzeczne z zaakceptowaną regułą ustawiają `review_required_at` i dodają
zdarzenie z nowym snapshotem. Pierwotny dowód nie jest nadpisywany. Decyzje są
append-only w `self_rule_events`; sama reguła ma jeden z statusów `candidate`,
`accepted`, `rejected`, `expired`.

Obie tabele mają RLS po właścicielu i rodzicu. Soft delete ustawia `archived_at`.
Eksport obejmuje tylko aktywne reguły i ich audyt. Usunięcie konta usuwa dane przez
FK `ON DELETE CASCADE`. Analityka otrzymuje wyłącznie typ reguły i enum akcji — bez
wartości, liczników i nazw nawyków.
