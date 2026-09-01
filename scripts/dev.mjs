/**
 * `npm run dev` — jedno polecenie, które doprowadza projekt do stanu
 * „aplikacja działa na ekranie".
 *
 * Kolejność kroków nie jest przypadkowa: każdy następny zakłada, że poprzedni
 * się udał. Dlatego pierwszy nieudany krok zatrzymuje skrypt i mówi, co zrobić,
 * zamiast lecieć dalej i wywalić się później w mniej zrozumiałym miejscu.
 *
 * Flagi:
 *   --reset     kasuje lokalną bazę, zakłada ją od nowa i wgrywa dane startowe
 *   --ios       otwiera symulator iOS (tylko macOS)
 *   --android   otwiera emulator albo podłączony telefon z Androidem
 *   --device    wymusza adres LAN (fizyczny telefon), nawet gdy widać emulator
 *   --host=IP   ręcznie podany adres komputera, gdy wykrywanie się myli
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

import {
  ENV_LOCAL_PATH,
  conflictingDotEnv,
  detectTarget,
  listAdbDevices,
  resolveApiUrl,
  supabaseStatus,
  writeEnvLocal,
} from './lib/local-supabase.mjs';
import { REPO_ROOT, captureNodeCli, inherit, inheritNodeCli } from './lib/run.mjs';
import {
  checkDocker,
  checkNode,
  checkSupabaseCli,
  installHint,
  listAvds,
  startEmulator,
  waitForAndroidBoot,
} from './lib/tools.mjs';
import {
  blank,
  command,
  fail,
  failUnexpected,
  info,
  note,
  ok,
  step,
  title,
  warn,
} from './lib/ui.mjs';

const TOTAL_STEPS = 7;

const TARGET_LABEL = {
  'ios-simulator': 'cel: symulator iOS na tym komputerze',
  'android-emulator': 'cel: emulator Androida na tym komputerze',
  device: 'cel: fizyczny telefon w tej samej sieci Wi-Fi',
};

const flags = parseFlags(process.argv.slice(2));

try {
  await main();
} catch (error) {
  failUnexpected(error);
}

async function main() {
  title('Tarento — uruchamianie środowiska');

  checkRequirements();
  await ensureDependencies();
  await ensureDatabaseRunning();

  const status = readStatus();
  const target = await configureEnv(status);

  await applyMigrations();
  await startExpo(target);
}

// 1. Wymagania ----------------------------------------------------------------

function checkRequirements() {
  step(1, TOTAL_STEPS, 'Sprawdzam wymagania');

  const node = checkNode();
  if (!node.ok) {
    fail({
      what: `masz za starą wersję Node.js (${node.detail})`,
      why: 'Expo 57 i Supabase CLI nie działają na Node starszym niż 20.\nNa starszej wersji część poleceń kończy się błędem składni.',
      fix: ['Zainstaluj Node.js w wersji LTS:', '', ...installHint('node')],
    });
  }
  ok(`Node.js ${node.detail}`);

  const docker = checkDocker();
  if (!docker.installed) {
    fail({
      what: 'nie znalazłem Dockera',
      why: 'Lokalna baza danych (Supabase) działa w kontenerach Dockera.\nBez Dockera nie ma bazy, a bez bazy aplikacja nie ma czego pokazać.',
      fix: ['Zainstaluj Docker Desktop:', '', ...installHint('docker')],
    });
  }
  if (!docker.running) {
    fail({
      what: 'Docker jest zainstalowany, ale nie działa',
      why: 'Docker Desktop musi być uruchomiony, zanim wystartuje baza.\nSam fakt instalacji nie wystarczy — to aplikacja, którą trzeba włączyć.',
      fix: [
        'Windows: uruchom Docker Desktop z menu Start i poczekaj, aż w lewym',
        '  dolnym rogu okna pojawi się zielony napis "Engine running".',
        'macOS: uruchom Docker z katalogu Programy i poczekaj, aż ikona',
        '  wieloryba na górnym pasku przestanie się animować.',
        '',
        'Potem uruchom ponownie:',
        '$ npm run dev',
      ],
      raw: docker.raw,
    });
  }
  ok(`Docker ${docker.detail}`);

  const cli = checkSupabaseCli();
  if (!cli.ok) {
    fail({
      what: 'nie znalazłem Supabase CLI',
      why: 'CLI jest zależnością projektu i powinno się zainstalować razem z resztą.\nJego brak zwykle znaczy, że instalacja zależności nie doszła do końca.',
      fix: ['Zainstaluj zależności projektu:', '', ...installHint('supabase')],
    });
  }
  ok(`Supabase CLI ${cli.detail}`);
  blank();
}

// 2. Zależności ---------------------------------------------------------------

async function ensureDependencies() {
  step(2, TOTAL_STEPS, 'Sprawdzam zależności projektu');

  if (existsSync(path.join(REPO_ROOT, 'node_modules', 'expo'))) {
    ok('node_modules na miejscu');
    blank();
    return;
  }

  warn('brak node_modules — instaluję zależności');
  note('Pierwsza instalacja trwa kilka minut. To normalne.');
  blank();

  const code = await inherit('npm', ['install'], { shell: true });
  if (code !== 0) {
    fail({
      what: 'instalacja zależności się nie powiodła',
      why: 'npm nie zdołał pobrać albo rozpakować pakietów.\nNajczęstsza przyczyna to zerwane połączenie z internetem\nalbo uszkodzony katalog node_modules z poprzedniej próby.',
      fix: [
        'Sprawdź połączenie z internetem, a potem wyczyść i zainstaluj od nowa:',
        '$ npm cache clean --force',
        '$ npm install',
      ],
    });
  }

  ok('zależności zainstalowane');
  blank();
}

// 3. Baza ---------------------------------------------------------------------

async function ensureDatabaseRunning() {
  step(3, TOTAL_STEPS, 'Sprawdzam lokalną bazę danych');

  if (supabaseStatus() !== null) {
    ok('baza już działa');
  } else {
    warn('baza nie działa — uruchamiam ją');
    note('Przy pierwszym uruchomieniu Docker musi pobrać obrazy kontenerów.');
    note('Potrwa to kilka minut i wygląda, jakby nic się nie działo. To normalne.');
    note('Każde kolejne uruchomienie zajmuje kilkanaście sekund.');
    blank();

    const code = await inheritNodeCli('supabase', ['start']);
    if (code !== 0) {
      fail({
        what: 'nie udało się uruchomić lokalnej bazy',
        why: 'Supabase nie podniósł kontenerów. Najczęstsze przyczyny to zajęty port\n(inny projekt Supabase działa w tle) albo Docker bez wolnego miejsca na dysku.',
        fix: [
          'Zatrzymaj inne stacki Supabase i spróbuj ponownie:',
          '$ npx supabase stop --all',
          '$ npm run dev',
          '',
          'Jeśli to nie pomoże, zwolnij miejsce po starych obrazach Dockera:',
          '$ docker system prune -a',
        ],
      });
    }

    ok('baza uruchomiona');
  }

  if (flags.reset) await resetDatabase();
  blank();
}

async function resetDatabase() {
  blank();
  warn('Flaga --reset: zaraz skasuję całą zawartość lokalnej bazy.');
  note('Znikną: konta testowe, nawyki, historia odhaczeń i ulubione cytaty.');
  note('Wrócą: tabele z migracji i dane startowe z supabase/seed.sql.');
  note('Nie dotyczy to bazy w chmurze — tylko tej na Twoim komputerze.');
  blank();

  if (!process.stdin.isTTY) {
    fail({
      what: 'nie mogę zapytać o potwierdzenie',
      why: 'Skrypt został uruchomiony bez konsoli interaktywnej, a --reset kasuje dane.\nNie robię tego bez wyraźnej zgody.',
      fix: ['Uruchom polecenie bezpośrednio w terminalu:', '$ npm run dev -- --reset'],
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    '   Czy na pewno skasować lokalną bazę? Wpisz "tak": ',
  );
  rl.close();

  if (answer.trim().toLowerCase() !== 'tak') {
    info('Anulowane — baza została nietknięta.');
    blank();
    return;
  }

  blank();
  const code = await inheritNodeCli('supabase', ['db', 'reset']);
  if (code !== 0) {
    fail({
      what: 'reset bazy się nie powiódł',
      why: 'Supabase nie zdołał odtworzyć bazy od zera. Zwykle znaczy to,\nże jedna z migracji w supabase/migrations zawiera błąd SQL.',
      fix: [
        'Zobacz, która migracja się wywaliła (komunikat wyżej), a potem:',
        '$ npx supabase db reset --debug',
      ],
    });
  }

  ok('baza odtworzona razem z danymi startowymi');
}

// 4. Klucze -------------------------------------------------------------------

function readStatus() {
  step(4, TOTAL_STEPS, 'Odczytuję adres i klucz bazy');

  const status = supabaseStatus();
  if (status === null) {
    fail({
      what: 'baza działa, ale nie oddaje swoich danych dostępowych',
      why: '`supabase status` nie zwrócił poprawnej odpowiedzi. Zwykle znaczy to,\nże część kontenerów wstała, a część nie.',
      fix: [
        'Zatrzymaj i uruchom bazę jeszcze raz:',
        '$ npx supabase stop',
        '$ npm run dev',
      ],
    });
  }

  ok('klucze odczytane z uruchomionej bazy');
  note('Nie musisz ich nigdzie przepisywać — skrypt zapisze je sam.');
  blank();

  return status;
}

// 5. Adres pod urządzenie -----------------------------------------------------

async function configureEnv(status) {
  step(5, TOTAL_STEPS, 'Dobieram adres bazy pod urządzenie');

  // Emulator musi wstać przed wyborem adresu: to od niego zależy, czy celem
  // jest 10.0.2.2, czy adres LAN komputera.
  if (flags.android) await ensureAndroidDevice();

  const target =
    flags.ios || flags.android || flags.device ? forcedTarget() : detectTarget(flags);

  if (flags.ios && process.platform !== 'darwin') {
    fail({
      what: 'symulator iOS działa tylko na macOS',
      why: 'Symulator iPhone’a jest częścią Xcode, a Xcode istnieje wyłącznie na Maca.\nNa Windowsie nie da się go uruchomić w żaden sposób.',
      fix: [
        'Uruchom aplikację na Androidzie:',
        '$ npm run dev -- --android',
        '',
        'Szczegóły i inne ścieżki opisuje URUCHAMIANIE.md.',
      ],
    });
  }

  const resolved =
    flags.host === null
      ? await resolveApiUrl(status.apiUrl, target)
      : { url: replaceHost(status.apiUrl, flags.host), host: flags.host };

  if (target === 'device' && resolved.host === null) {
    fail({
      what: 'nie potrafię ustalić adresu tego komputera w sieci',
      why: 'Telefon łączy się z bazą po adresie komputera w sieci Wi-Fi.\nBez niego aplikacja wystartuje, ale nie zaloguje się i nie pobierze danych.',
      fix: [
        'Sprawdź adres komputera i podaj go ręcznie:',
        'Windows:  ipconfig   (szukaj "Adres IPv4" przy karcie Wi-Fi)',
        'macOS:    ipconfig getifaddr en0',
        '',
        'Potem uruchom:',
        '$ npm run dev -- --host=192.168.1.20',
      ],
    });
  }

  ok(`aplikacja połączy się z bazą pod adresem ${resolved.url}`);
  info(TARGET_LABEL[target]);

  const conflicting = conflictingDotEnv();
  if (conflicting !== null) {
    warn('w repo leży plik .env z tymi samymi zmiennymi co .env.local');
    note(`Kolidujące zmienne: ${conflicting.join(', ')}`);
    note('Expo czyta .env.local jako ważniejszy, więc .env jest ignorowany —');
    note('a to znaczy, że zmiany wpisane do .env nie zadziałają. Skasuj go:');
    command(process.platform === 'win32' ? 'del .env' : 'rm .env');
  }

  const written = writeEnvLocal({ url: resolved.url, anonKey: status.anonKey });
  ok(`zapisane w ${path.relative(REPO_ROOT, ENV_LOCAL_PATH)}`);
  if (written.kept.length > 0) {
    note(`Zachowane zmienne dopisane ręcznie: ${written.kept.join(', ')}`);
  }
  blank();

  return { name: target, host: resolved.host, envChanged: written.changed };
}

/**
 * Przy `--android` sam podnosi emulator, jeśli nic nie jest podłączone.
 *
 * Bez tego trzeba pamiętać pełną ścieżkę do `emulator.exe` — Google dokłada do
 * PATH tylko platform-tools, więc `adb` działa, a `emulator` nie. To jeden
 * z tych kroków, o których nie da się wiedzieć, dopóki się na niego nie wpadnie.
 */
async function ensureAndroidDevice() {
  if (listAdbDevices().length > 0) {
    ok('urządzenie z Androidem jest podłączone');
    return;
  }

  const avds = listAvds();

  if (avds.length === 0) {
    warn('nie widzę emulatora ani podłączonego telefonu');
    note('Utwórz emulator w Android Studio (Device Manager → Create device)');
    note('albo z wiersza poleceń — patrz URUCHAMIANIE.md, sekcja 1.');
    note('Metro i tak wystartuje; aplikację otworzysz, gdy urządzenie się pojawi.');
    return;
  }

  const [name] = avds;
  warn(`nie widzę urządzenia — uruchamiam emulator ${name}`);
  note('Pierwsze uruchomienie systemu w emulatorze trwa 1–2 minuty.');

  if (!startEmulator(name)) {
    warn('nie udało się uruchomić emulatora');
    return;
  }

  const booted = await waitForAndroidBoot(240_000);
  if (booted) {
    ok('emulator gotowy');
    return;
  }

  warn('emulator nie zdążył wstać w 4 minuty — lecę dalej');
  note('Gdy system w emulatorze się załaduje, otwórz aplikację ręcznie.');
}

function forcedTarget() {
  if (flags.device) return 'device';
  if (flags.ios) return 'ios-simulator';

  // --android bez podłączonego telefonu znaczy emulator.
  return listAdbDevices().some((entry) => entry.physical) ? 'device' : 'android-emulator';
}

function replaceHost(apiUrl, host) {
  const url = new URL(apiUrl);
  url.hostname = host;
  return url.toString().replace(/\/$/, '');
}

// 6. Migracje -----------------------------------------------------------------

async function applyMigrations() {
  step(6, TOTAL_STEPS, 'Sprawdzam migracje bazy');

  if (flags.reset) {
    ok('pominięte — --reset wgrał już wszystkie migracje');
    blank();
    return;
  }

  const result = captureNodeCli('supabase', ['migration', 'up', '--local'], {
    timeout: 300_000,
  });

  if (result.code !== 0) {
    fail({
      what: 'nie udało się wgrać migracji do bazy',
      why: 'Migracje to pliki SQL, które budują tabele. Jedna z nich nie przeszła —\nalbo zawiera błąd, albo kłóci się ze stanem, w którym jest teraz baza.',
      fix: [
        'Najprostsze rozwiązanie to zbudowanie bazy od zera (skasuje lokalne dane):',
        '$ npm run dev -- --reset',
      ],
      raw: result.output,
    });
  }

  const applied = (result.output.match(/Applying migration/g) ?? []).length;
  if (applied > 0) {
    ok(`wgrane nowe migracje: ${applied}`);
  } else {
    ok('baza jest aktualna');
  }
  blank();
}

// 7. Expo ---------------------------------------------------------------------

async function startExpo(target) {
  step(7, TOTAL_STEPS, 'Uruchamiam serwer aplikacji (Metro)');

  const args = ['start', '--dev-client'];
  if (flags.ios) args.push('--ios');
  if (flags.android) args.push('--android');

  // Zmiana adresu bazy nie przebije się przez cache Metro — trzeba go wyczyścić.
  if (target.envChanged) {
    args.push('--clear');
    info('adres bazy się zmienił — czyszczę cache Metro');
  }

  info('Zatrzymanie serwera: Ctrl+C');
  if (target.name === 'device') {
    info('Na telefonie otwórz aplikację Tarento (development build) i zeskanuj kod QR.');
  }
  blank();

  // Na fizycznym telefonie Metro musi ogłosić adres LAN, a nie adres wirtualnej
  // karty Dockera czy WSL — inaczej telefon nie pobierze paczki z kodem.
  const env =
    target.name === 'device' && target.host !== null
      ? { REACT_NATIVE_PACKAGER_HOSTNAME: target.host }
      : {};

  const code = await inheritNodeCli('expo', args, { env });

  // Ctrl+C to normalne zakończenie pracy, nie błąd.
  if (code !== 0 && code !== 130 && code !== null) {
    fail({
      what: 'serwer aplikacji zakończył się błędem',
      why: 'Metro (serwer, który podaje kod do aplikacji) nie wystartował.\nNajczęstsza przyczyna to zajęty port 8081 przez poprzednie uruchomienie.',
      fix: [
        'Zamknij poprzednie okno z `npm run dev`, a jeśli go nie ma:',
        'Windows:  npx kill-port 8081',
        'macOS:    lsof -ti:8081 | xargs kill',
        '',
        'Potem uruchom ponownie:',
        '$ npm run dev',
      ],
    });
  }
}

// Flagi -----------------------------------------------------------------------

function parseFlags(argv) {
  const hostArg = argv.find((arg) => arg.startsWith('--host='));

  const unknown = argv.filter(
    (arg) =>
      !['--reset', '--ios', '--android', '--device'].includes(arg) &&
      !arg.startsWith('--host='),
  );

  if (unknown.length > 0) {
    fail({
      what: `nie znam opcji ${unknown.join(', ')}`,
      why: 'Skrypt przyjmuje tylko kilka flag.',
      fix: [
        'Dostępne opcje:',
        '  npm run dev                     zwykłe uruchomienie',
        '  npm run dev -- --android        otwórz na Androidzie',
        '  npm run dev -- --ios            otwórz na symulatorze iOS (tylko macOS)',
        '  npm run dev -- --device         wymuś adres LAN dla telefonu',
        '  npm run dev -- --host=192.168.1.20   podaj adres komputera ręcznie',
        '  npm run dev -- --reset          zbuduj bazę od zera (kasuje dane)',
      ],
    });
  }

  return {
    reset: argv.includes('--reset'),
    ios: argv.includes('--ios'),
    android: argv.includes('--android'),
    device: argv.includes('--device'),
    host: hostArg === undefined ? null : hostArg.slice('--host='.length),
  };
}
