/**
 * Sprawdzanie narzędzi, bez których nic nie ruszy, plus instrukcje instalacji.
 *
 * Instrukcje podajemy dla macOS i Windows osobno — nie zakładamy, że to samo
 * repo stoi zawsze na tej samej maszynie.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { capture, captureNodeCli, commandExists, spawnDetached } from './run.mjs';

export const MIN_NODE_MAJOR = 20;

export const IS_MACOS = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';

/** Instrukcje instalacji dla obu systemów. */
const INSTALL = {
  node: {
    macos: ['$ brew install node', 'albo pobierz instalator LTS z https://nodejs.org'],
    windows: [
      '$ winget install OpenJS.NodeJS.LTS',
      'albo pobierz instalator LTS z https://nodejs.org',
    ],
  },
  docker: {
    macos: [
      '$ brew install --cask docker',
      'Potem uruchom aplikację Docker z katalogu Programy i poczekaj,',
      'aż ikona wieloryba na górnym pasku przestanie się animować.',
    ],
    windows: [
      '$ winget install Docker.DockerDesktop',
      'Potem uruchom Docker Desktop z menu Start i poczekaj, aż w lewym dolnym',
      'rogu okna pojawi się zielony napis "Engine running".',
    ],
  },
  supabase: {
    macos: [
      '$ npm install',
      'CLI jest zależnością projektu — instaluje się razem z resztą.',
    ],
    windows: [
      '$ npm install',
      'CLI jest zależnością projektu — instaluje się razem z resztą.',
    ],
  },
  eas: {
    macos: ['$ npm install -g eas-cli'],
    windows: ['$ npm install -g eas-cli'],
  },
};

/**
 * Instrukcja instalacji dla obu systemów, z zaznaczeniem tego, na którym
 * skrypt właśnie działa.
 */
export function installHint(tool) {
  const entry = INSTALL[tool];
  const here = IS_MACOS ? 'macos' : 'windows';
  const lines = [];

  for (const system of ['macos', 'windows']) {
    const label = system === 'macos' ? 'macOS' : 'Windows';
    const marker = system === here ? ' (Twój system)' : '';
    lines.push(`${label}${marker}:`);
    for (const line of entry[system]) lines.push(`  ${line}`);
    lines.push('');
  }

  return lines;
}

// Poszczególne narzędzia ------------------------------------------------------

export function checkNode() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  const okVersion = Number.isInteger(major) && major >= MIN_NODE_MAJOR;

  return {
    ok: okVersion,
    version: process.versions.node,
    detail: okVersion
      ? `v${process.versions.node}`
      : `v${process.versions.node} — wymagane co najmniej v${MIN_NODE_MAJOR}`,
  };
}

/**
 * Docker musi być zainstalowany ORAZ uruchomiony. To dwa różne błędy
 * z dwoma różnymi rozwiązaniami, więc rozróżniamy je tutaj, a nie w wywołaniu.
 */
export function checkDocker() {
  const version = capture('docker', ['--version'], { shell: true, timeout: 60_000 });
  if (version.code !== 0) {
    return {
      ok: false,
      installed: false,
      running: false,
      detail: 'nie znaleziono polecenia docker',
    };
  }

  // `docker info` odpytuje demona — samo `docker --version` czyta tylko plik.
  const info = capture('docker', ['info', '--format', '{{.ServerVersion}}'], {
    shell: true,
    timeout: 120_000,
  });

  if (info.code !== 0) {
    return {
      ok: false,
      installed: true,
      running: false,
      detail: 'zainstalowany, ale nie uruchomiony',
      raw: info.output,
    };
  }

  return {
    ok: true,
    installed: true,
    running: true,
    detail: `działa (silnik ${info.stdout.trim()})`,
  };
}

export function checkSupabaseCli() {
  const result = captureNodeCli('supabase', ['--version'], { timeout: 120_000 });
  if (result.code !== 0) {
    return {
      ok: false,
      detail: result.missing === true ? 'brak w node_modules' : 'nie odpowiada',
    };
  }

  return { ok: true, version: result.stdout.trim(), detail: `v${result.stdout.trim()}` };
}

export function checkEasCli() {
  const result = commandExists('eas');
  if (!result.exists) return { ok: false, detail: 'nie zainstalowane' };

  const version = result.output.split('\n')[0].trim();
  return { ok: true, detail: version };
}

/** Xcode — tylko na macOS, tylko do buildów iOS. */
export function checkXcode() {
  const result = capture('xcodebuild', ['-version'], { shell: true, timeout: 120_000 });
  if (result.code !== 0) {
    return { ok: false, detail: 'nie znaleziono (potrzebny do buildów iOS)' };
  }

  return { ok: true, detail: result.stdout.split('\n')[0].trim() };
}

/**
 * Android SDK — odpowiednik Xcode po stronie Androida. Nie jest wymagany,
 * gdy build robi EAS w chmurze, więc brak zgłaszamy jako UWAGA, nie BŁĄD.
 */
export function checkAndroidSdk() {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? null;
  if (home === null) {
    return {
      ok: false,
      detail: 'brak zmiennej ANDROID_HOME (build lokalny nie zadziała)',
    };
  }

  const adb = capture('adb', ['version'], { shell: true, timeout: 60_000 });
  const adbNote = adb.code === 0 ? '' : ', ale adb nie odpowiada';

  return { ok: adb.code === 0, detail: `${home}${adbNote}` };
}

// Emulator Androida -----------------------------------------------------------

/**
 * Ścieżka do emulatora. Nie ma go w PATH nawet przy poprawnie ustawionym
 * ANDROID_HOME — Google dokłada do PATH tylko platform-tools.
 */
export function androidEmulatorBinary() {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? null;
  if (home === null) return null;

  const binary = path.join(home, 'emulator', IS_WINDOWS ? 'emulator.exe' : 'emulator');
  return existsSync(binary) ? binary : null;
}

/** Nazwy skonfigurowanych urządzeń wirtualnych. */
export function listAvds() {
  const binary = androidEmulatorBinary();
  if (binary === null) return [];

  const result = capture(binary, ['-list-avds'], { timeout: 60_000 });
  if (result.code !== 0) return [];

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes(' '));
}

export function startEmulator(name) {
  const binary = androidEmulatorBinary();
  if (binary === null) return false;

  spawnDetached(binary, ['-avd', name, '-no-boot-anim']);
  return true;
}

/**
 * Czeka, aż system w emulatorze skończy się uruchamiać.
 *
 * Samo pojawienie się urządzenia w `adb devices` nie wystarcza: instalacja
 * aplikacji na wciąż bootującym systemie kończy się błędem.
 */
export async function waitForAndroidBoot(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = capture('adb', ['shell', 'getprop', 'sys.boot_completed'], {
      shell: true,
      timeout: 30_000,
    });

    if (result.stdout.trim() === '1') return true;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return false;
}
