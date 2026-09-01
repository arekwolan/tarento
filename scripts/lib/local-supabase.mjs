/**
 * Rozmowa z lokalnym stackiem Supabase i przygotowanie .env.local.
 *
 * Klucze czytamy zawsze z `supabase status`, nigdy z pliku. Dzięki temu nie ma
 * czego przepisywać ręcznie i nie da się zostawić w repo klucza z cudzej maszyny.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, capture, captureNodeCli } from './run.mjs';

export const ENV_LOCAL_PATH = path.join(REPO_ROOT, '.env.local');
export const ENV_PATH = path.join(REPO_ROOT, '.env');

/** Klucze, którymi zarządza `npm run dev` — reszta pliku zostaje nietknięta. */
export const MANAGED_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const ENV_HEADER = [
  '# Plik generowany przez `npm run dev`. Nie edytuj dwóch pierwszych zmiennych —',
  '# przy każdym uruchomieniu i tak zostaną nadpisane wartościami z',
  '# `supabase status`. Resztę zmiennych możesz tu dopisywać swobodnie.',
  '#',
  '# Adres bazy zależy od tego, gdzie działa aplikacja:',
  '#   127.0.0.1  — symulator iOS (dzieli sieć z komputerem)',
  '#   10.0.2.2   — emulator Androida (tak widzi komputer, na którym stoi)',
  '#   192.168.*  — fizyczny telefon w tej samej sieci Wi-Fi',
  '',
];

// Status stacka ---------------------------------------------------------------

/**
 * Zwraca dane lokalnego stacka albo null, gdy stack nie działa.
 *
 * `supabase status -o json` kończy się błędem, gdy kontenery są zatrzymane —
 * i to jest nasz sposób na sprawdzenie, czy w ogóle trzeba je podnosić.
 */
export function supabaseStatus() {
  const result = captureNodeCli('supabase', ['status', '-o', 'json'], {
    timeout: 120_000,
  });
  if (result.code !== 0) return null;

  // CLI potrafi dopisać przed JSON-em linijkę ostrzeżenia o nowszej wersji.
  const start = result.stdout.indexOf('{');
  if (start < 0) return null;

  let parsed;
  try {
    parsed = JSON.parse(result.stdout.slice(start));
  } catch {
    return null;
  }

  // Nazwy kluczy zmieniały się między wersjami CLI (ANON_KEY → PUBLISHABLE_KEY).
  const apiUrl = parsed.API_URL ?? null;
  const anonKey = parsed.ANON_KEY ?? parsed.PUBLISHABLE_KEY ?? null;
  const serviceKey = parsed.SERVICE_ROLE_KEY ?? parsed.SECRET_KEY ?? null;

  if (apiUrl === null || anonKey === null) return null;

  return {
    apiUrl,
    anonKey,
    serviceKey,
    dbUrl: parsed.DB_URL ?? null,
    studioUrl: parsed.STUDIO_URL ?? null,
    mailboxUrl: parsed.INBUCKET_URL ?? parsed.MAILPIT_URL ?? null,
  };
}

export function isStackRunning() {
  return supabaseStatus() !== null;
}

// Adres, pod którym urządzenie zobaczy bazę --------------------------------------

/**
 * Adres IP komputera w sieci lokalnej.
 *
 * Sztuczka z UDP: „połączenie" bezpołączeniowego gniazda nie wysyła żadnego
 * pakietu, ale każe systemowi wybrać interfejs, którym poszedłby ruch na
 * zewnątrz. To dokładnie ten interfejs, którym telefon dobije do komputera.
 * Gdy się nie uda (brak sieci), schodzimy do listy interfejsów.
 */
export async function detectLanIp() {
  const { createSocket } = await import('node:dgram');

  const viaRoute = await new Promise((resolve) => {
    const socket = createSocket('udp4');
    const finish = (value) => {
      try {
        socket.close();
      } catch {
        // gniazdo mogło się już zamknąć — nieistotne
      }
      resolve(value);
    };

    socket.on('error', () => finish(null));
    try {
      socket.connect(53, '8.8.8.8', () => {
        try {
          finish(socket.address().address);
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }

    setTimeout(() => finish(null), 1500);
  });

  if (isUsableLanIp(viaRoute)) return viaRoute;

  const { networkInterfaces } = await import('node:os');
  const candidates = [];

  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    // Adaptery wirtualne (Docker, WSL, Hyper-V, VirtualBox) mają adresy, pod
    // które telefon się nie dostanie.
    if (/vethernet|virtualbox|vmware|docker|wsl|loopback|bluetooth/i.test(name)) continue;

    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (!isUsableLanIp(address.address)) continue;
      candidates.push(address.address);
    }
  }

  // 192.168.* to typowa sieć domowa — stawiamy ją przed 10.* i 172.*.
  candidates.sort((a, b) => rankLanIp(a) - rankLanIp(b));
  return candidates[0] ?? null;
}

function isUsableLanIp(address) {
  if (typeof address !== 'string' || address.length === 0) return false;
  if (address.startsWith('127.') || address.startsWith('169.254.')) return false;
  return /^\d+\.\d+\.\d+\.\d+$/.test(address);
}

function rankLanIp(address) {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  return 2;
}

/**
 * Do czego podłączy się aplikacja.
 *
 * - symulator iOS dzieli sieć z komputerem, więc widzi 127.0.0.1,
 * - emulator Androida ma własną sieć i komputer widzi pod 10.0.2.2,
 * - fizyczny telefon musi dostać adres LAN komputera.
 */
export async function resolveApiUrl(apiUrl, target) {
  const url = new URL(apiUrl);

  if (target === 'ios-simulator') {
    url.hostname = '127.0.0.1';
    return { url: url.toString().replace(/\/$/, ''), host: '127.0.0.1' };
  }

  if (target === 'android-emulator') {
    url.hostname = '10.0.2.2';
    return { url: url.toString().replace(/\/$/, ''), host: '10.0.2.2' };
  }

  const lanIp = await detectLanIp();
  if (lanIp === null) return { url: apiUrl.replace(/\/$/, ''), host: null };

  url.hostname = lanIp;
  return { url: url.toString().replace(/\/$/, ''), host: lanIp };
}

/**
 * Zgaduje, gdzie użytkownik chce zobaczyć aplikację.
 * Kolejność: jawna flaga → podłączone urządzenia → domyślnie telefon w Wi-Fi.
 */
export function detectTarget({ ios, android, device }) {
  if (device) return 'device';
  if (ios) return 'ios-simulator';

  const attached = listAdbDevices();

  if (android) {
    return attached.some((entry) => entry.physical) ? 'device' : 'android-emulator';
  }

  if (attached.length > 0) {
    return attached.every((entry) => entry.emulator) ? 'android-emulator' : 'device';
  }

  return 'device';
}

/** Urządzenia widziane przez adb. Brak adb = pusta lista, nie błąd. */
export function listAdbDevices() {
  const result = capture('adb', ['devices'], { shell: true, timeout: 30_000 });
  if (result.code !== 0) return [];

  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('device'))
    .map((line) => {
      const serial = line.split(/\s+/)[0];
      const emulator = serial.startsWith('emulator-');
      return { serial, emulator, physical: !emulator };
    });
}

// .env.local ------------------------------------------------------------------

export function readEnvFile(filePath) {
  if (!existsSync(filePath)) return null;

  const values = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;

    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return values;
}

/**
 * Zapisuje URL i klucz anon, zachowując pozostałe zmienne z pliku.
 *
 * @returns {{ changed: boolean, kept: string[] }}
 */
export function writeEnvLocal({ url, anonKey }) {
  const existing = readEnvFile(ENV_LOCAL_PATH) ?? {};
  const kept = Object.keys(existing).filter((key) => !MANAGED_KEYS.includes(key));

  const changed =
    existing.EXPO_PUBLIC_SUPABASE_URL !== url ||
    existing.EXPO_PUBLIC_SUPABASE_ANON_KEY !== anonKey;

  const lines = [
    ...ENV_HEADER,
    `EXPO_PUBLIC_SUPABASE_URL=${url}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
  ];

  if (kept.length > 0) {
    lines.push('', '# Zmienne dopisane ręcznie — skrypt ich nie rusza.');
    for (const key of kept) lines.push(`${key}=${existing[key]}`);
  }

  writeFileSync(ENV_LOCAL_PATH, `${lines.join('\n')}\n`, 'utf8');
  return { changed, kept };
}

// Odpytywanie bazy przez REST --------------------------------------------------

/**
 * Liczba wierszy w tabeli. Idzie przez PostgREST, a nie przez psql — nie
 * wymaga klienta Postgresa na maszynie.
 */
export async function countRows(status, table) {
  const response = await fetch(`${status.apiUrl}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: {
      apikey: status.anonKey,
      Authorization: `Bearer ${status.anonKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} przy odczycie tabeli ${table}`);
  }

  const range = response.headers.get('content-range');
  const total = range === null ? null : Number.parseInt(range.split('/')[1] ?? '', 10);

  return Number.isInteger(total) ? total : 0;
}

/** Ping bazy — czy PostgREST w ogóle odpowiada. */
export async function pingDatabase(status) {
  const response = await fetch(`${status.apiUrl}/rest/v1/`, {
    headers: { apikey: status.anonKey },
    signal: AbortSignal.timeout(15_000),
  });

  return response.ok;
}

/** Nagłówki dla zapytań administracyjnych (seed). Klucz nigdzie nie ląduje. */
export function serviceHeaders(status) {
  if (status.serviceKey === null) {
    throw new Error('Lokalny stack nie zwrócił klucza service_role.');
  }

  return {
    apikey: status.serviceKey,
    Authorization: `Bearer ${status.serviceKey}`,
    'Content-Type': 'application/json',
  };
}

/** Czy w repo leży .env, który przesłoni albo zdubluje .env.local. */
export function conflictingDotEnv() {
  const values = readEnvFile(ENV_PATH);
  if (values === null) return null;

  const overlapping = MANAGED_KEYS.filter((key) => values[key] !== undefined);
  return overlapping.length > 0 ? overlapping : null;
}
