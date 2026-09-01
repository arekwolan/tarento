/**
 * `npm run doctor` — diagnostyka bez uruchamiania aplikacji.
 *
 * Odpowiada na jedno pytanie: „czego brakuje, żeby `npm run dev` zadziałał".
 * Nie naprawia niczego sam — przy każdym błędzie podaje komendę do wpisania.
 *
 * Skrypt zawsze kończy się kodem 0, także przy błędach. Tabela poniżej jest
 * całym wynikiem, a kod wyjścia różny od zera dokładałby do niej tylko
 * hałas od npm.
 */

import path from 'node:path';
import process from 'node:process';

import {
  ENV_LOCAL_PATH,
  MANAGED_KEYS,
  conflictingDotEnv,
  countRows,
  pingDatabase,
  readEnvFile,
  supabaseStatus,
} from './lib/local-supabase.mjs';
import { REPO_ROOT, captureNodeCli } from './lib/run.mjs';
import {
  IS_MACOS,
  checkAndroidSdk,
  checkDocker,
  checkEasCli,
  checkNode,
  checkSupabaseCli,
  checkXcode,
  installHint,
} from './lib/tools.mjs';
import { blank, color, failUnexpected, note, statusTable, title } from './lib/ui.mjs';

const rows = [];
const fixes = [];

/**
 * @param {string} name
 * @param {'ok' | 'bad' | 'warn'} status
 * @param {string} detail
 * @param {string[]} [fix] Kroki naprawcze; '$ ' na początku linii = komenda.
 */
function record(name, status, detail, fix = []) {
  rows.push({ name, status, detail });
  if (status !== 'ok' && fix.length > 0) fixes.push({ name, status, fix });
}

try {
  await main();
} catch (error) {
  failUnexpected(error);
}

async function main() {
  title('Tarento — diagnostyka środowiska');

  checkTooling();
  const status = checkDatabaseStack();
  checkEnvFile(status);
  await checkDatabaseContent(status);
  checkMigrations(status);
  checkTypes();
  checkPlatformToolchain();

  statusTable(rows);
  printFixes();
  printVerdict();
}

// Narzędzia -------------------------------------------------------------------

function checkTooling() {
  const node = checkNode();
  record('Node.js', node.ok ? 'ok' : 'bad', node.detail, [
    'Zainstaluj Node.js LTS:',
    '',
    ...installHint('node'),
  ]);

  const docker = checkDocker();
  if (docker.ok) {
    record('Docker', 'ok', docker.detail);
  } else if (docker.installed) {
    record('Docker', 'bad', docker.detail, [
      'Windows: uruchom Docker Desktop z menu Start i poczekaj na napis',
      '  "Engine running" w lewym dolnym rogu okna.',
      'macOS: uruchom Docker z katalogu Programy i poczekaj, aż ikona',
      '  wieloryba przestanie się animować.',
    ]);
  } else {
    record('Docker', 'bad', docker.detail, [
      'Zainstaluj Docker Desktop:',
      '',
      ...installHint('docker'),
    ]);
  }

  const cli = checkSupabaseCli();
  record('Supabase CLI', cli.ok ? 'ok' : 'bad', cli.detail, [
    'Zainstaluj zależności projektu:',
    '$ npm install',
  ]);

  // EAS jest potrzebny dopiero do buildów w chmurze — brak to nie awaria.
  const eas = checkEasCli();
  record('EAS CLI', eas.ok ? 'ok' : 'warn', eas.detail, [
    'Potrzebne tylko do budowania aplikacji w chmurze Expo:',
    '',
    ...installHint('eas'),
  ]);
}

// Baza ------------------------------------------------------------------------

function checkDatabaseStack() {
  const status = supabaseStatus();

  if (status === null) {
    record('Lokalna baza', 'bad', 'nie działa', [
      'Uruchom bazę (przy pierwszym razie potrwa kilka minut):',
      '$ npm run db:start',
      '',
      'Albo po prostu odpal całe środowisko — zrobi to za Ciebie:',
      '$ npm run dev',
    ]);
    return null;
  }

  record('Lokalna baza', 'ok', `działa pod ${status.apiUrl}`);
  return status;
}

function checkEnvFile(status) {
  const values = readEnvFile(ENV_LOCAL_PATH);
  const fileName = path.relative(REPO_ROOT, ENV_LOCAL_PATH);

  if (values === null) {
    record('.env.local', 'bad', 'nie istnieje', [
      'Plik tworzy się sam przy uruchomieniu środowiska:',
      '$ npm run dev',
    ]);
    return;
  }

  const missing = MANAGED_KEYS.filter((key) => (values[key] ?? '') === '');
  if (missing.length > 0) {
    record('.env.local', 'bad', `brakuje: ${missing.join(', ')}`, [
      'Uzupełni się sam przy uruchomieniu środowiska:',
      '$ npm run dev',
    ]);
    return;
  }

  // Klucz w pliku musi zgadzać się z tym, co oddaje działająca baza.
  // Rozjazd zdarza się po `supabase stop` + starcie innego projektu.
  if (status !== null && values.EXPO_PUBLIC_SUPABASE_ANON_KEY !== status.anonKey) {
    record('.env.local', 'warn', 'klucz nie zgadza się z uruchomioną bazą', [
      'Przepisz aktualne dane z bazy do pliku:',
      '$ npm run dev',
    ]);
    return;
  }

  const conflicting = conflictingDotEnv();
  if (conflicting !== null) {
    record('.env.local', 'warn', `plik .env dubluje: ${conflicting.join(', ')}`, [
      'Expo czyta .env.local jako ważniejszy, więc .env jest ignorowany.',
      'Zmiany wpisane do .env nic nie dadzą. Skasuj go:',
      process.platform === 'win32' ? '$ del .env' : '$ rm .env',
    ]);
    return;
  }

  record('.env.local', 'ok', `${fileName}, adres ${values.EXPO_PUBLIC_SUPABASE_URL}`);
}

async function checkDatabaseContent(status) {
  if (status === null) {
    record('Połączenie z bazą', 'bad', 'pominięte — baza nie działa');
    record('Tabela quotes', 'bad', 'pominięte — baza nie działa');
    record('Tabela habit_templates', 'bad', 'pominięte — baza nie działa');
    return;
  }

  try {
    const reachable = await pingDatabase(status);
    if (!reachable) throw new Error('brak odpowiedzi');
    record('Połączenie z bazą', 'ok', 'PostgREST odpowiada');
  } catch (error) {
    record('Połączenie z bazą', 'bad', shortMessage(error), [
      'Baza wstała, ale nie odpowiada na zapytania. Uruchom ją od nowa:',
      '$ npm run db:stop',
      '$ npm run db:start',
    ]);
    record('Tabela quotes', 'bad', 'pominięte — brak połączenia');
    record('Tabela habit_templates', 'bad', 'pominięte — brak połączenia');
    return;
  }

  await recordCount(status, 'quotes', 'Tabela quotes', 'cytaty');
  await recordCount(
    status,
    'habit_templates',
    'Tabela habit_templates',
    'szablony nawyków',
  );
}

async function recordCount(status, table, label, what) {
  try {
    const count = await countRows(status, table);

    if (count === 0) {
      record(
        label,
        'warn',
        `0 rekordów — ${what} nie mają się z czego wziąć`,
        [
          'Wgraj dane startowe (skasuje lokalne dane i zbuduje bazę od zera):',
          '$ npm run dev -- --reset',
          table === 'quotes' ? 'Albo dograj same cytaty z pliku CSV:' : '',
          table === 'quotes' ? '$ npm run quotes:import' : '',
        ].filter((line) => line !== ''),
      );
      return;
    }

    record(label, 'ok', `${count} ${count === 1 ? 'rekord' : 'rekordów'}`);
  } catch (error) {
    record(label, 'bad', shortMessage(error), [
      'Tabela nie odpowiada. Zbuduj bazę od zera:',
      '$ npm run dev -- --reset',
    ]);
  }
}

function checkMigrations(status) {
  if (status === null) {
    record('Migracje', 'bad', 'pominięte — baza nie działa');
    return;
  }

  const result = captureNodeCli('supabase', ['migration', 'list', '--local'], {
    timeout: 180_000,
  });
  if (result.code !== 0) {
    record('Migracje', 'bad', 'nie udało się odczytać stanu', [
      'Sprawdź, co odpowiada Supabase:',
      '$ npx supabase migration list --local',
    ]);
    return;
  }

  const pending = pendingMigrations(result.stdout);
  if (pending.length > 0) {
    record('Migracje', 'bad', `niezastosowane: ${pending.length}`, [
      'Wgraj brakujące migracje do bazy:',
      '$ npx supabase migration up --local',
      '',
      'Robi to też zwykłe uruchomienie środowiska:',
      '$ npm run dev',
    ]);
    return;
  }

  record('Migracje', 'ok', 'baza jest aktualna');
}

/**
 * Wiersze `supabase migration list` mają postać `LOCAL │ REMOTE │ TIME`.
 * Pusta druga kolumna znaczy: plik migracji jest, ale w bazie go nie ma.
 */
function pendingMigrations(output) {
  const pending = [];

  for (const line of output.split('\n')) {
    if (!/\d{14}/.test(line)) continue;

    const columns = line.split(/[│|]/).map((cell) => cell.trim());
    if (columns.length < 2) continue;

    const local = columns.find((cell) => /^\d{14}$/.test(cell));
    if (local === undefined) continue;

    const applied = columns.filter((cell) => /^\d{14}$/.test(cell)).length >= 2;
    if (!applied) pending.push(local);
  }

  return pending;
}

// Typy ------------------------------------------------------------------------

function checkTypes() {
  const result = captureNodeCli('tsc', ['--noEmit'], { timeout: 600_000 });

  if (result.code === 0) {
    record('Typy (typecheck)', 'ok', 'bez błędów');
    return;
  }

  const errors = (result.output.match(/error TS\d+/g) ?? []).length;
  record('Typy (typecheck)', 'bad', `${errors > 0 ? errors : 'nieznana liczba'} błędów`, [
    'Zobacz pełną listę błędów:',
    '$ npm run typecheck',
  ]);
}

// Toolchain platformy ---------------------------------------------------------

function checkPlatformToolchain() {
  if (IS_MACOS) {
    const xcode = checkXcode();
    record('Xcode', xcode.ok ? 'ok' : 'warn', xcode.detail, [
      'Potrzebny do uruchomienia symulatora iPhone’a.',
      'Zainstaluj z App Store (szukaj "Xcode"), a potem raz uruchom:',
      '$ sudo xcodebuild -runFirstLaunch',
    ]);
    return;
  }

  const android = checkAndroidSdk();
  record('Android SDK', android.ok ? 'ok' : 'warn', android.detail, [
    'Potrzebny do zbudowania aplikacji na tym komputerze.',
    'Bez niego zostaje build w chmurze Expo:',
    '$ eas build --profile development --platform android',
    '',
    'Instalacja SDK: https://developer.android.com/studio',
  ]);
}

// Podsumowanie ----------------------------------------------------------------

function printFixes() {
  if (fixes.length === 0) return;

  process.stdout.write(`  ${color.bold('Co naprawić')}\n\n`);

  for (const entry of fixes) {
    const marker = entry.status === 'bad' ? color.red('BŁĄD') : color.yellow('UWAGA');
    process.stdout.write(`  ${marker}  ${color.bold(entry.name)}\n`);

    for (const line of entry.fix) {
      if (line.startsWith('$ ')) {
        process.stdout.write(`        ${color.cyan(line.slice(2))}\n`);
      } else {
        process.stdout.write(`        ${line}\n`);
      }
    }
    blank();
  }
}

function printVerdict() {
  const bad = rows.filter((row) => row.status === 'bad').length;
  const warned = rows.filter((row) => row.status === 'warn').length;

  if (bad > 0) {
    process.stdout.write(
      `  ${color.red(`Do naprawienia: ${bad}. Aplikacja na razie nie ruszy.`)}\n`,
    );
  } else if (warned > 0) {
    process.stdout.write(
      `  ${color.yellow(`Wszystko konieczne działa. Uwag do przejrzenia: ${warned}.`)}\n`,
    );
    note('Uwaga nie blokuje pracy — dotyczy rzeczy potrzebnych dopiero później.');
  } else {
    process.stdout.write(
      `  ${color.green('Wszystko gotowe. Możesz uruchomić: npm run dev')}\n`,
    );
  }

  blank();
}

function shortMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0].slice(0, 60);
}
