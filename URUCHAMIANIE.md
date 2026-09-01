# Jak uruchomić Tarento

Instrukcja dla osoby, która nie pracowała wcześniej z React Native. Zakłada
tylko to, że umiesz otworzyć terminal i wkleić do niego polecenie.

Jeśli coś nie działa, zacznij od:

```
npm run doctor
```

To polecenie niczego nie zmienia — sprawdza po kolei wszystkie elementy
środowiska i przy każdym błędzie pisze, co wpisać, żeby go naprawić.

---

## Spis treści

1. [Co zainstalować raz](#1-co-zainstalować-raz)
2. [Dlaczego Expo Go tu nie zadziała](#2-dlaczego-expo-go-tu-nie-zadziała)
3. [Codzienna praca](#3-codzienna-praca)
4. [Typowe błędy](#4-typowe-błędy)
5. [Kiedy używać `--reset`](#5-kiedy-używać---reset)
6. [Kiedy przebudować aplikację, a kiedy wystarczy restart](#6-kiedy-przebudować-aplikację-a-kiedy-wystarczy-restart)
7. [Dane demonstracyjne](#7-dane-demonstracyjne)
8. [Dodawanie cytatów](#8-dodawanie-cytatów)

---

## 1. Co zainstalować raz

Cztery rzeczy. Instalujesz je jeden raz na komputerze, nie przy każdym
uruchomieniu projektu.

### Windows

| Co                   | Polecenie                                      | Po co                                          |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Node.js (wersja 20+) | `winget install OpenJS.NodeJS.LTS`             | uruchamia cały projekt                         |
| Docker Desktop       | `winget install Docker.DockerDesktop`          | w nim działa baza danych                       |
| Android Studio       | pobierz z https://developer.android.com/studio | emulator telefonu i narzędzia do budowania     |
| Zależności projektu  | `npm install`                                  | biblioteki, z których zbudowana jest aplikacja |

Po instalacji Docker Desktop **uruchom go** i poczekaj, aż w lewym dolnym rogu
okna pojawi się zielony napis „Engine running". Docker musi działać w tle za
każdym razem, gdy pracujesz nad projektem.

### macOS

| Co                   | Polecenie                    | Po co                                           |
| -------------------- | ---------------------------- | ----------------------------------------------- |
| Node.js (wersja 20+) | `brew install node`          | uruchamia cały projekt                          |
| Docker Desktop       | `brew install --cask docker` | w nim działa baza danych                        |
| Xcode                | App Store → szukaj „Xcode"   | symulator iPhone'a i narzędzia do budowania iOS |
| Zależności projektu  | `npm install`                | biblioteki, z których zbudowana jest aplikacja  |

Po instalacji Xcode uruchom raz:

```
sudo xcodebuild -runFirstLaunch
```

Docker po instalacji trzeba uruchomić z katalogu Programy i poczekać, aż ikona
wieloryba na górnym pasku przestanie się animować.

### Czego NIE musisz instalować

Supabase CLI i EAS CLI instalują się razem z projektem przez `npm install`.
Kluczy do bazy nie przepisujesz ręcznie nigdy — `npm run dev` odczytuje je
z uruchomionej bazy i sam zapisuje do pliku `.env.local`.

### Emulator Androida bez Android Studio

Android Studio to duży program, a z całego jego wnętrza potrzebne są tylko
narzędzia wiersza poleceń. Jeśli masz już katalog Android SDK (zmienna
`ANDROID_HOME`), emulator da się dołożyć bez instalowania całego IDE:

```
sdkmanager "emulator" "system-images;android-36;google_apis;x86_64"
avdmanager create avd -n Tarento_API36 -k "system-images;android-36;google_apis;x86_64" -d pixel_7
```

`sdkmanager` i `avdmanager` leżą w `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin`
(Windows) albo `~/Library/Android/sdk/cmdline-tools/latest/bin` (macOS).

Uruchomienie emulatora:

```
emulator -avd Tarento_API36
```

Emulator musi chodzić, zanim odpalisz `npm run dev -- --android`.

---

## 2. Dlaczego Expo Go tu nie zadziała

**Expo Go** to gotowa aplikacja ze sklepu, w której można podglądać projekty
Expo bez budowania czegokolwiek. Bardzo wygodna — ale tylko dopóki projekt
używa wyłącznie tego, co Expo Go ma w środku.

Tarento używa bibliotek z kodem natywnym, których w Expo Go nie ma:

- `react-native-mmkv` — szybki magazyn danych na urządzeniu (trzyma sesję
  logowania i pamięć podręczną),
- `expo-notifications` w trybie lokalnych przypomnień,
- `@sentry/react-native`.

Expo Go nie umie doładować kodu natywnego w locie. Próba otwarcia projektu
w Expo Go kończy się błędem o brakującym module, a nie ekranem aplikacji.

### Czym jest development build

**Development build** to Twoja własna wersja Expo Go: aplikacja zbudowana
dokładnie z tych bibliotek natywnych, których używa Tarento. Instalujesz ją raz
na emulatorze albo telefonie, a potem działa dokładnie tak samo wygodnie —
uruchamiasz `npm run dev`, a kod aplikacji doładowuje się do niej po sieci.

W praktyce:

- **kod natywny** (biblioteki, uprawnienia, nazwa aplikacji, ikona) siedzi
  w zainstalowanej aplikacji — jego zmiana wymaga przebudowania,
- **kod aplikacji** (ekrany, logika, teksty) doładowuje się z Twojego komputera
  za każdym razem — jego zmiana widoczna jest natychmiast.

Rozgraniczenie, kiedy potrzebne jest jedno, a kiedy drugie, opisuje
[sekcja 6](#6-kiedy-przebudować-aplikację-a-kiedy-wystarczy-restart).

---

## 3. Codzienna praca

Jedno polecenie:

```
npm run dev
```

Robi po kolei siedem rzeczy i przy każdej pisze, co się dzieje:

1. sprawdza Node, Dockera i Supabase CLI,
2. instaluje zależności, jeśli ich nie ma,
3. uruchamia bazę danych, jeśli nie działa,
4. odczytuje adres i klucz bazy,
5. dobiera adres pod urządzenie, na którym chcesz zobaczyć aplikację,
6. wgrywa nowe migracje bazy,
7. uruchamia serwer, z którego aplikacja pobiera kod.

Pierwsze uruchomienie trwa kilka minut, bo Docker musi pobrać obrazy
kontenerów. Kolejne — kilkanaście sekund.

Zatrzymanie: `Ctrl+C` w oknie terminala.

### Wersje polecenia

| Polecenie                            | Kiedy                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| `npm run dev`                        | zwykła praca                                                    |
| `npm run dev -- --android`           | otwórz od razu na emulatorze albo telefonie z Androidem         |
| `npm run dev -- --ios`               | otwórz od razu na symulatorze iPhone'a (tylko macOS)            |
| `npm run dev -- --device`            | wymuś adres komputera w sieci Wi-Fi (fizyczny telefon)          |
| `npm run dev -- --host=192.168.1.20` | podaj adres komputera ręcznie, gdy wykrywanie się myli          |
| `npm run dev -- --reset`             | zbuduj bazę od zera — patrz [sekcja 5](#5-kiedy-używać---reset) |

Podwójny myślnik przed flagą jest konieczny: bez niego npm zatrzyma flagę dla
siebie, zamiast przekazać ją dalej.

### Skąd aplikacja wie, gdzie jest baza

Adres `127.0.0.1` znaczy „ten sam sprzęt, na którym działam". Dla telefonu to
sam telefon, a nie Twój komputer — dlatego jeden adres nie wystarcza:

| Gdzie działa aplikacja | Adres bazy                              |
| ---------------------- | --------------------------------------- |
| symulator iPhone'a     | `127.0.0.1`                             |
| emulator Androida      | `10.0.2.2`                              |
| fizyczny telefon       | adres LAN komputera, np. `192.168.1.20` |

`npm run dev` rozpoznaje to sam i wpisuje właściwy adres do `.env.local`.
W kroku 5 wypisuje, który adres wybrał — warto na to zerknąć, jeśli aplikacja
nie widzi danych.

### Pomocne adresy przy uruchomionej bazie

| Co                                              | Adres                  |
| ----------------------------------------------- | ---------------------- |
| Supabase Studio (podgląd i edycja danych)       | http://127.0.0.1:55323 |
| Skrzynka na maile testowe (linki z rejestracji) | http://127.0.0.1:55324 |

---

## 4. Typowe błędy

| Objaw                                                                             | Przyczyna                                                                                                                              | Rozwiązanie                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` zatrzymuje się na „Docker jest zainstalowany, ale nie działa"       | Docker Desktop jest zamknięty. Sama instalacja nie wystarcza — to aplikacja, która musi chodzić w tle.                                 | Uruchom Docker Desktop i poczekaj na napis „Engine running". Potem `npm run dev`.                                                                                                                                           |
| „nie udało się uruchomić lokalnej bazy", w logu port zajęty                       | Inny projekt Supabase trzyma te same porty, albo poprzedni stack nie zgasł.                                                            | `npx supabase stop --all`, potem `npm run dev`.                                                                                                                                                                             |
| Metro nie startuje, w logu port 8081                                              | Poprzednie okno `npm run dev` nadal działa.                                                                                            | Zamknij tamto okno. Jeśli go nie widać: Windows `npx kill-port 8081`, macOS `lsof -ti:8081 \| xargs kill`.                                                                                                                  |
| Telefon pokazuje „Could not connect to development server"                        | Telefon nie widzi Twojego komputera: inna sieć Wi-Fi albo firewall.                                                                    | Upewnij się, że telefon i komputer są w tej samej sieci. Wyłącz sieć „dla gości". Potem `npm run dev -- --device`. Gdy dalej nie działa: sprawdź adres (`ipconfig`) i podaj go ręcznie: `npm run dev -- --host=TWÓJ_ADRES`. |
| Aplikacja działa, ale nie loguje się i nie widzi danych                           | Aplikacja dostała adres bazy `127.0.0.1`, a działa na telefonie.                                                                       | `npm run dev -- --device`. Sprawdź w kroku 5, jaki adres został wybrany.                                                                                                                                                    |
| `Unable to resolve module ...`                                                    | Doszła nowa biblioteka, a serwer trzyma starą listę plików w pamięci podręcznej.                                                       | Zatrzymaj (`Ctrl+C`), uruchom `npm install`, potem `npx expo start --dev-client --clear`. Jeśli nie pomoże — przebuduj aplikację (patrz [sekcja 6](#6-kiedy-przebudować-aplikację-a-kiedy-wystarczy-restart)).              |
| „baza odrzuciła zapis", „column does not exist"                                   | Baza nie ma najnowszych tabel — brakuje migracji.                                                                                      | `npx supabase migration up --local`. Jeśli migracja nie chce wejść: `npm run dev -- --reset`.                                                                                                                               |
| Aplikacja wyrzuca do ekranu logowania po każdym uruchomieniu                      | Sesja wygasła albo baza została zbudowana od zera i konta już nie ma.                                                                  | Zaloguj się ponownie. Jeśli konta nie ma: `npm run seed:demo` i zaloguj się na `demo@tarento.app` / `demo1234`.                                                                                                             |
| Wszystko „wygląda dobrze", a aplikacja pusta                                      | Baza stoi, ale nie ma w niej danych.                                                                                                   | `npm run doctor` — pokaże, ile rekordów jest w tabelach. Potem `npm run seed:demo`.                                                                                                                                         |
| Budowanie aplikacji kończy się `Could not download ...` / `No such host is known` | Sieć urwała się w trakcie budowania. Gradle musi pobrać kilkaset megabajtów bibliotek i każde zerwanie połączenia przerywa cały build. | To nie jest błąd w projekcie. Sprawdź internet i uruchom budowanie jeszcze raz — Gradle zachowuje to, co już pobrał, więc druga próba jest dużo krótsza.                                                                    |
| Budowanie kończy się `SDK location not found`                                     | Brakuje zmiennej `ANDROID_HOME` wskazującej katalog Android SDK.                                                                       | Windows: `setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"`, potem otwórz nowy terminal. macOS: dopisz `export ANDROID_HOME=$HOME/Library/Android/sdk` do `~/.zshrc`.                                                         |

Na końcu nieudanego `npm run dev` pojawiają się linie zaczynające się od
`npm error`. To tylko informacja, że polecenie się zatrzymało — właściwy
komunikat jest w ramce nad nimi.

---

## 5. Kiedy używać `--reset`

```
npm run dev -- --reset
```

Buduje lokalną bazę **od zera**. Przed skasowaniem czegokolwiek pyta
o potwierdzenie — trzeba wpisać `tak`.

**Kasuje:**

- wszystkie konta założone lokalnie (razem z kontem demo),
- wszystkie nawyki i całą historię odhaczeń,
- ulubione cytaty i historię cytatów dnia.

**Odtwarza:**

- wszystkie tabele z plików w `supabase/migrations`,
- dane startowe z `supabase/seed.sql` (cytaty i szablony nawyków).

**Nie dotyczy** bazy w chmurze — działa wyłącznie na bazie na Twoim komputerze.

Sięgaj po `--reset`, gdy:

- migracja nie chce się wgrać i baza jest w połowicznym stanie,
- tabele nie zgadzają się z aplikacją („column does not exist"),
- chcesz zacząć testy od czystej sytuacji.

Po resecie warto od razu:

```
npm run seed:demo
```

---

## 6. Kiedy przebudować aplikację, a kiedy wystarczy restart

Aplikacja składa się z dwóch warstw. Zmiana w każdej z nich znaczy co innego.

### Wystarczy zapisanie pliku

Zmiany widać od razu, bez żadnej komendy:

- treść ekranów, układ, kolory, teksty,
- logika aplikacji, zapytania do bazy,
- tłumaczenia w `src/i18n/locales/`.

### Wystarczy restart Metro (`Ctrl+C`, potem `npm run dev`)

- zmiana adresu bazy albo zawartości `.env.local`,
- dziwne błędy o brakującym module po `npm install`
  (dodaj `--clear`: `npx expo start --dev-client --clear`).

### Trzeba przebudować development build

Przebudowanie znaczy: `npm run devbuild:android` albo `npm run devbuild:ios`
(a przy budowaniu w chmurze — `npm run build:dev:android`), a potem ponowna
instalacja aplikacji na urządzeniu.

Potrzebne, gdy zmieniło się cokolwiek natywnego:

- doszła biblioteka z kodem natywnym (np. `expo-notifications`, `react-native-mmkv`),
- zmienił się `app.config.ts`: nazwa, ikona, ekran startowy, uprawnienia,
  identyfikator aplikacji, schemat linków,
- zmieniła się wersja Expo SDK,
- doszła albo zniknęła wtyczka w sekcji `plugins`.

Prosta zasada: jeśli zmiana dotyczy tego, **czym aplikacja jest** — przebuduj.
Jeśli tego, **co aplikacja pokazuje** — wystarczy zapisać plik.

---

## 7. Dane demonstracyjne

```
npm run seed:demo
```

Zakłada konto testowe i wypełnia je historią, żeby było widać działającą
aplikację, a nie pusty ekran powitalny.

| Dane logowania |                    |
| -------------- | ------------------ |
| e-mail         | `demo@tarento.app` |
| hasło          | `demo1234`         |

Konto dostaje cztery nawyki o różnych jednostkach (minuty, strony,
powtórzenia, samo odhaczenie) i trzydzieści dni historii ze skutecznością
około 75% oraz dwiema przerwami — dzięki temu serie i heatmapa mają co pokazać.

Skrypt można uruchamiać wielokrotnie: nadpisuje te same dane, nie dubluje ich.

---

## 8. Dodawanie cytatów

Cytaty siedzą w bazie, nie w kodzie. Możesz je dodawać na dwa sposoby.

### Sposób 1: plik CSV (dobry na wiele cytatów naraz)

Otwórz `supabase/data/quotes.csv` — w Excelu, w Arkuszach Google albo
w zwykłym notatniku. Dopisz wiersz i uruchom:

```
npm run quotes:import
```

Kolumny:

| Kolumna            | Wymagana | Co wpisać                                                    |
| ------------------ | -------- | ------------------------------------------------------------ |
| `content`          | tak      | treść cytatu                                                 |
| `author`           | tak      | autor                                                        |
| `source_book`      | nie      | tytuł dzieła, np. `Rozmyślania`                              |
| `language`         | nie      | `pl` albo `en`; puste = `pl`                                 |
| `tags`             | nie      | etykiety rozdzielone pionową kreską, np. `stoicyzm\|poranek` |
| `is_public_domain` | nie      | `tak` albo `nie`; puste = `nie`                              |

Zasady, o których warto pamiętać:

- Jeśli w treści cytatu jest **przecinek**, całą treść otocz cudzysłowem:
  `"Kropla drąży skałę nie siłą, lecz częstym padaniem."`
- Tagi rozdzielaj **pionową kreską** `|`, nie przecinkiem — przecinek rozdziela
  kolumny.
- Import **pomija duplikaty**: cytat, którego treść jest już w bazie, nie
  zostanie dodany drugi raz. Skrypt można więc uruchamiać ile razy chcesz.
- Jeśli plik ma błąd (np. brak autora), skrypt **nic nie wgra** i wypisze numery
  wierszy do poprawy. Lepiej to niż połowiczny import.

Przykładowy wiersz:

```
"Podróż licząca tysiąc mil zaczyna się od jednego kroku.",Lao Tzu,Tao Te King,pl,początek|wytrwałość,tak
```

### Sposób 2: Supabase Studio (dobry na jeden cytat i na poprawki)

Przy uruchomionej bazie otwórz w przeglądarce:

```
http://127.0.0.1:55323
```

Potem:

1. W menu po lewej wybierz **Table Editor**.
2. Z listy tabel wybierz **quotes**.
3. Zielony przycisk **Insert → Insert row** dodaje nowy cytat.
4. Kliknięcie w komórkę pozwala poprawić istniejący.

Kolumna `is_active` decyduje, czy cytat może się pojawić w aplikacji.
Zamiast kasować cytat, przestaw `is_active` na `false` — historia „cytatu dnia"
zostanie nienaruszona.

Uwaga: Studio pokazuje bazę **na Twoim komputerze**. Zmiany zrobione tutaj
znikną po `npm run dev -- --reset`. Cytaty, które mają przetrwać reset, wpisuj
do pliku CSV.
