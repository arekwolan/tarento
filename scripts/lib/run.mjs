/**
 * Uruchamianie zewnętrznych narzędzi.
 *
 * Wszystkie trzy CLI, których potrzebujemy (supabase, expo, tsc), są zwykłymi
 * skryptami Node w node_modules. Odpalamy je przez `process.execPath`, a nie
 * przez `npx` ani przez pliki .cmd — na Windowsie spawn na .cmd wymaga
 * shella i psuje się na ścieżkach ze spacjami, a `npx` przy okazji sprawdza
 * rejestr npm i potrafi wisieć bez sieci.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Korzeń repozytorium — skrypty bywają wołane z innego katalogu. */
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const NODE_CLI = {
  supabase: 'node_modules/supabase/dist/supabase.js',
  expo: 'node_modules/expo/bin/cli',
  tsc: 'node_modules/typescript/bin/tsc',
};

/** Ścieżka do CLI zainstalowanego w node_modules, albo null gdy go nie ma. */
export function nodeCliPath(name) {
  const relative = NODE_CLI[name];
  if (relative === undefined) throw new Error(`Nieznane CLI: ${name}`);

  const absolute = path.join(REPO_ROOT, relative);
  return existsSync(absolute) ? absolute : null;
}

/**
 * Uruchamia i czeka na wynik, zbierając wyjście.
 *
 * @returns {{ code: number, stdout: string, stderr: string, output: string }}
 */
export function capture(command, args, options = {}) {
  const useShell = options.shell === true;

  // Przy shell: true Node ostrzega, jeśli argumenty przekazać osobną tablicą —
  // sam ich nie escape'uje, tylko skleja. Sklejamy więc jawnie i z cudzysłowami.
  const result = spawnSync(
    useShell ? shellLine(command, args) : command,
    useShell ? [] : args,
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      // Windows: pliki .cmd/.bat da się odpalić tylko przez shell.
      shell: useShell,
      timeout: options.timeout,
      env: { ...process.env, ...options.env },
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return {
    code: result.error !== undefined ? -1 : (result.status ?? -1),
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
    error: result.error,
  };
}

/** Komenda dla shella: jeden ciąg, z cudzysłowami wokół argumentów ze spacjami. */
function shellLine(command, args) {
  const quote = (value) => (/^[\w.\-/\\:=]+$/.test(value) ? value : `"${value}"`);
  return [command, ...args].map(quote).join(' ');
}

/** To samo, ale dla CLI z node_modules. */
export function captureNodeCli(name, args, options = {}) {
  const cli = nodeCliPath(name);
  if (cli === null) {
    return {
      code: -1,
      stdout: '',
      stderr: `Brak ${name} w node_modules`,
      output: '',
      missing: true,
    };
  }

  return capture(process.execPath, [cli, ...args], options);
}

/** Sprawdza, czy komenda w ogóle istnieje w PATH. */
export function commandExists(command, versionArgs = ['--version']) {
  const result = capture(command, versionArgs, { shell: true, timeout: 60_000 });
  return { exists: result.code === 0, output: result.output.trim() };
}

/**
 * Uruchamia proces i oddaje mu terminal (stdio: inherit).
 * Używane dla długo żyjących komend — `supabase start`, `expo start`.
 *
 * @returns {Promise<number>} kod wyjścia
 */
export function inherit(command, args, options = {}) {
  return new Promise((resolve) => {
    const useShell = options.shell === true;

    const child = spawn(
      useShell ? shellLine(command, args) : command,
      useShell ? [] : args,
      {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: useShell,
        env: { ...process.env, ...options.env },
      },
    );

    // Ctrl+C ma zatrzymać dziecko, nie zostawić osieroconego Metro.
    const forward = () => child.kill('SIGINT');
    process.on('SIGINT', forward);

    child.on('error', () => resolve(-1));
    child.on('close', (code) => {
      process.off('SIGINT', forward);
      resolve(code ?? 0);
    });
  });
}

/** inherit() dla CLI z node_modules. */
export function inheritNodeCli(name, args, options = {}) {
  const cli = nodeCliPath(name);
  if (cli === null) return Promise.resolve(-1);

  return inherit(process.execPath, [cli, ...args], options);
}

/**
 * Uruchamia proces i natychmiast o nim zapomina.
 *
 * Emulator Androida ma przeżyć zakończenie skryptu — inaczej zgasłby razem
 * z `npm run dev`, a to jest dokładnie odwrotność tego, po co go włączamy.
 */
export function spawnDetached(command, args) {
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
  return child;
}
