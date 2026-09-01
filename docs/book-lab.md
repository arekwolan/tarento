# Laboratorium książki — dane i AI

Laboratorium nie jest osobnym trackerem książek. Zatwierdzony draft staje się
prywatnym rekordem `paths` (`origin_kind = private`, `owner_id` ustawione,
`is_published = false`) i korzysta bez zmian z `path_stages`,
`path_practices`, `path_readings`, `user_paths` oraz lifecycle etapów.

## Granica danych

- `book_lab_projects` przechowuje prywatny tytuł, autora, jedną pożądaną zmianę,
  wersję promptu, walidowany draft i idempotentny `request_key`.
- `book_lab_notes` przechowuje 3–7 idei użytkownika, każdą do 500 znaków, oraz
  opcjonalny pointer do 80 znaków. Nie ma uploadu ani pola na tekst książki.
- `path_readings` utworzone przez Laboratorium są wyłącznie pointerami. Nie mają
  `body`, `quote_text` ani `quote_source`.
- Numery notatek będące źródłem praktyki, przygotowania i kryterium przejścia są
  zapisane oddzielnie od treści w `source_note_ordinals` i odpowiednich polach
  etapu.
- `ai_generations` zawiera jedynie metadane techniczne generacji. Nie trafiają
  tam tytuł książki, autor, notatki ani tekst draftu. Nie dodano eventów
  analitycznych z prywatnym tekstem.

RLS dla projektów sprawdza `owner_id`, a RLS notatek oraz tabel potomnych
dziedziczy dostęp przez rodzica. Publiczny katalog jawnie wybiera tylko
opublikowane rekordy bez właściciela i bez `archived_at`. Prywatne rekordy są
uwzględnione w eksporcie użytkownika. Usunięcie szkicu jest miękkie; usunięcie
konta fizycznie usuwa je przez kaskadę z profilu i czyści lokalny szkic tego
użytkownika z urządzenia.

## Kontrakt generowania

Edge Function `book-lab` wymaga sesji i przyjmuje wyłącznie:

- idempotentny identyfikator żądania;
- prywatne metadane książki, które nie są przekazywane modelowi;
- jedną zmianę zachowania;
- 3–7 krótkich notatek użytkownika;
- locale i opcjonalny identyfikator poprzedniej prywatnej wersji.

Serwer dodaje tylko strukturalny kontekst: budżet, zajęte minuty i pasma,
anonimowe kategorie/minuty istniejących nawyków oraz informację o aktywnej
ścieżce. Nie wysyła nazw nawyków, dziennika, listów, tytułu ani autora książki.

Notatki są serializowane jako niezaufane dane JSON. Prompt zabrania wykonywania
instrukcji znalezionych w notatkach, odtwarzania książki i tworzenia porad
medycznych, terapeutycznych, dietetycznych, prawnych lub finansowych. Odpowiedź
przechodzi ścisły walidator: 1–3 etapy, jedna praktyka na etap, najwyżej jedno
przygotowanie środowiska, referencje do istniejących notatek i limit każdego
etapu wynoszący 60% aktualnie wolnego budżetu. Baza ponownie sprawdza schemat,
referencje i budżet podczas zapisu, a start prywatnego protokołu jeszcze raz
sprawdza aktualny path-fit. Walidator odrzuca również odpowiedź kopiującą
z notatki frazę dłuższą niż 11 słów.

AI nigdy nie zapisuje ani nie aktywuje ścieżki. Użytkownik najpierw edytuje diff
`DODA / ZASTĄPI / NIE ZMIEŚCI SIĘ`, może odrzucić każdy etap lub przygotowanie,
a dopiero potem wywołuje idempotentny `save_book_lab_protocol`. Edycja zapisanej
treści tworzy nową wersję z `version_parent_id`; aktywny `user_path` pozostaje
przypięty do wersji, z którą wystartował.

## Sieć, retry i regresje

Formularz jest zapisywany lokalnie per użytkownik, więc może przetrwać brak
sieci. Generowanie uczciwie wymaga połączenia. Identyczny `request_key` zwraca
ten sam projekt, a zatwierdzenie zapisanego projektu zwraca ten sam `path_id`.
Funkcja ma limit pięciu prób na dobę, timeout i jedną naprawczą próbę modelu po
odrzuceniu wyniku przez walidator.

Walidator i prompt mają testy jednostkowe. `npm run prompt:test` obejmuje
Laboratorium w zestawie 20 stanów użytkownika; bez klucza modelu można uruchomić
`npm run prompt:test -- --dry-run`. Testy pgTAP obejmują RLS, 60% budżetu,
idempotencję zapisu, lifecycle, provenance, wersjonowanie, soft delete i delete
konta.
