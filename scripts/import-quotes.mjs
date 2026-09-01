/**
 * `npm run quotes:import` — wgrywa cytaty z pliku CSV do tabeli `quotes`.
 *
 * Po to, żeby dodanie cytatu nie wymagało dotykania kodu ani pisania SQL-a:
 * dopisujesz wiersz w supabase/data/quotes.csv i uruchamiasz jedno polecenie.
 *
 * Duplikaty pomijamy po treści cytatu (bez względu na wielkość liter i odstępy),
 * więc skrypt można puszczać wielokrotnie — dograją się tylko nowe pozycje.
 *
 * Zapis do `quotes` ma prawo tylko service_role: tabela celowo nie ma polityki
 * INSERT dla zalogowanego użytkownika, bo katalog cytatów jest wspólny dla
 * wszystkich. Klucz bierzemy z `supabase status` i trzymamy tylko w pamięci.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { serviceHeaders, supabaseStatus } from './lib/local-supabase.mjs';
import { REPO_ROOT } from './lib/run.mjs';
import {
  blank,
  color,
  fail,
  failUnexpected,
  info,
  note,
  ok,
  step,
  title,
} from './lib/ui.mjs';

const CSV_PATH = path.join(REPO_ROOT, 'supabase', 'data', 'quotes.csv');

const REQUIRED_COLUMNS = ['content', 'author'];
const KNOWN_COLUMNS = [
  'content',
  'author',
  'source_book',
  'language',
  'tags',
  'is_public_domain',
];

const TOTAL_STEPS = 4;

try {
  await main();
} catch (error) {
  failUnexpected(error);
}

async function main() {
  title('Tarento — import cytatów');

  const status = requireRunningStack();
  const rows = readCsv();
  const existing = await fetchExistingContents(status);
  await insertNew(status, rows, existing);
}

function requireRunningStack() {
  step(1, TOTAL_STEPS, 'Sprawdzam lokalną bazę');

  const status = supabaseStatus();
  if (status === null) {
    fail({
      what: 'lokalna baza nie działa',
      why: 'Cytaty trzeba gdzieś zapisać, a baza jest wyłączona.',
      fix: [
        'Uruchom bazę i spróbuj ponownie:',
        '$ npm run db:start',
        '$ npm run quotes:import',
      ],
    });
  }

  ok('baza działa');
  blank();
  return status;
}

// Wczytanie pliku -------------------------------------------------------------

function readCsv() {
  step(2, TOTAL_STEPS, 'Czytam plik z cytatami');

  const relative = path.relative(REPO_ROOT, CSV_PATH);

  if (!existsSync(CSV_PATH)) {
    fail({
      what: `nie znalazłem pliku ${relative}`,
      why: 'To z niego skrypt bierze cytaty do wgrania.',
      fix: [
        'Plik powinien leżeć w repozytorium. Jeśli go skasowałeś, odtwórz go:',
        '$ git checkout supabase/data/quotes.csv',
      ],
    });
  }

  // Excel zapisuje pliki CSV z bajtem BOM na początku — bez tego pierwsza
  // nazwa kolumny miałaby doklejony niewidzialny znak i nie dałaby się dopasować.
  const raw = readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const table = parseCsv(raw);

  if (table.length === 0) {
    fail({
      what: `plik ${relative} jest pusty`,
      why: 'Nie ma czego wgrywać.',
      fix: ['Dopisz cytaty do pliku i uruchom ponownie:', '$ npm run quotes:import'],
    });
  }

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));

  if (missing.length > 0) {
    fail({
      what: `w pliku ${relative} brakuje kolumn: ${missing.join(', ')}`,
      why: 'Pierwszy wiersz pliku to nazwy kolumn i musi je zawierać.',
      fix: [
        'Pierwszy wiersz powinien wyglądać dokładnie tak:',
        `$ ${KNOWN_COLUMNS.join(',')}`,
      ],
    });
  }

  const unknown = header.filter((name) => !KNOWN_COLUMNS.includes(name));
  if (unknown.length > 0) {
    fail({
      what: `nie znam kolumn: ${unknown.join(', ')}`,
      why: 'Wgranie ich do bazy skończyłoby się błędem, więc przerywam,\nzanim cokolwiek zapiszę.',
      fix: ['Dozwolone nazwy kolumn:', `$ ${KNOWN_COLUMNS.join(',')}`],
    });
  }

  const rows = [];
  const problems = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    // Numer wiersza taki, jaki widać w arkuszu — łatwiej trafić w błąd.
    const lineNumber = index + 1;

    if (cells.every((cell) => cell.trim() === '')) continue;

    const record = {};
    for (let column = 0; column < header.length; column += 1) {
      record[header[column]] = (cells[column] ?? '').trim();
    }

    if (record.content === '') {
      problems.push(`wiersz ${lineNumber}: pusta kolumna content (treść cytatu)`);
      continue;
    }
    if (record.author === '') {
      problems.push(`wiersz ${lineNumber}: pusta kolumna author (autor)`);
      continue;
    }

    const publicDomain = parseBoolean(record.is_public_domain);
    if (publicDomain === null) {
      problems.push(
        `wiersz ${lineNumber}: w kolumnie is_public_domain wpisz "tak" albo "nie" (jest: "${record.is_public_domain}")`,
      );
      continue;
    }

    rows.push({
      content: record.content,
      author: record.author,
      source_book: emptyToNull(record.source_book),
      language: record.language === '' ? 'pl' : record.language,
      tags: parseTags(record.tags),
      is_public_domain: publicDomain,
      is_active: true,
    });
  }

  if (problems.length > 0) {
    fail({
      what: `plik ${relative} ma błędy w ${problems.length} wierszach`,
      why: 'Nic nie wgrałem — najpierw popraw plik, żeby import był kompletny.',
      fix: ['Do poprawy:', ...problems.map((problem) => `  ${problem}`)],
    });
  }

  ok(`wczytane cytaty: ${rows.length}`);
  blank();
  return rows;
}

// Baza ------------------------------------------------------------------------

async function fetchExistingContents(status) {
  step(3, TOTAL_STEPS, 'Sprawdzam, co już jest w bazie');

  const response = await fetch(`${status.apiUrl}/rest/v1/quotes?select=content`, {
    headers: serviceHeaders(status),
  });

  if (!response.ok) {
    fail({
      what: `nie udało się odczytać tabeli quotes (HTTP ${response.status})`,
      why: 'Bez listy istniejących cytatów nie da się pominąć duplikatów.',
      fix: ['Sprawdź stan bazy:', '$ npm run doctor'],
      raw: await response.text(),
    });
  }

  const existing = new Set((await response.json()).map((row) => normalize(row.content)));
  ok(`w bazie jest już ${existing.size} cytatów`);
  blank();

  return existing;
}

async function insertNew(status, rows, existing) {
  step(4, TOTAL_STEPS, 'Wgrywam nowe cytaty');

  const seen = new Set();
  const fresh = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = normalize(row.content);

    // Duplikat może być i w bazie, i wewnątrz samego pliku.
    if (existing.has(key) || seen.has(key)) {
      duplicates += 1;
      continue;
    }

    seen.add(key);
    fresh.push(row);
  }

  if (fresh.length === 0) {
    ok('nic nowego — wszystkie cytaty z pliku są już w bazie');
    blank();
    note(`Pominięte duplikaty: ${duplicates}`);
    blank();
    return;
  }

  const response = await fetch(`${status.apiUrl}/rest/v1/quotes`, {
    method: 'POST',
    headers: { ...serviceHeaders(status), Prefer: 'return=minimal' },
    body: JSON.stringify(fresh),
  });

  if (!response.ok) {
    fail({
      what: `baza odrzuciła zapis (HTTP ${response.status})`,
      why: 'Któryś wiersz nie pasuje do kształtu tabeli quotes.',
      fix: [
        'Sprawdź, czy kolumna language ma dwuliterowy kod (pl albo en),',
        'a potem spróbuj ponownie:',
        '$ npm run quotes:import',
      ],
      raw: await response.text(),
    });
  }

  ok(`dograne nowe cytaty: ${fresh.length}`);
  if (duplicates > 0) info(`pominięte duplikaty: ${duplicates}`);
  blank();

  for (const row of fresh.slice(0, 5)) {
    process.stdout.write(
      `      ${color.gray(`„${truncate(row.content)}" — ${row.author}`)}\n`,
    );
  }
  if (fresh.length > 5) {
    process.stdout.write(`      ${color.gray(`…i jeszcze ${fresh.length - 5}`)}\n`);
  }

  blank();
  note(
    `Podgląd i edycja w przeglądarce: ${status.studioUrl ?? 'http://127.0.0.1:55323'}`,
  );
  note('Table Editor → tabela quotes.');
  blank();
}

// CSV -------------------------------------------------------------------------

/**
 * Parser CSV zgodny z RFC 4180: pola w cudzysłowach mogą zawierać przecinki,
 * średniki i znaki końca linii, a podwójny cudzysłów w środku zapisuje się
 * jako "". Piszemy go sami, bo jedna funkcja jest tańsza niż kolejna zależność.
 *
 * Separator wykrywamy z pierwszego wiersza — Excel w polskiej wersji zapisuje
 * pliki CSV ze średnikami i inaczej cały plik wyszedłby jako jedna kolumna.
 */
function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char !== '"') {
        field += char;
        continue;
      }

      if (text[index + 1] === '"') {
        field += '"';
        index += 1;
        continue;
      }

      quoted = false;
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      // \r\n to jeden koniec linii, nie dwa.
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.length > 0);
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
}

/** Tagi rozdzielone pionową kreską — nie kolidują ani z przecinkiem, ani ze średnikiem. */
function parseTags(value) {
  if (value === undefined || value.trim() === '') return null;

  const tags = value
    .split('|')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

  return tags.length > 0 ? tags : null;
}

function parseBoolean(value) {
  if (value === undefined || value.trim() === '') return false;

  const normalized = value.trim().toLowerCase();
  if (['tak', 'true', '1', 'yes'].includes(normalized)) return true;
  if (['nie', 'false', '0', 'no'].includes(normalized)) return false;

  return null;
}

function emptyToNull(value) {
  return value === undefined || value.trim() === '' ? null : value.trim();
}

/** Porównanie treści bez względu na wielkość liter i nadmiarowe odstępy. */
function normalize(content) {
  return content.trim().toLowerCase().replace(/\s+/g, ' ');
}

function truncate(text) {
  return text.length <= 60 ? text : `${text.slice(0, 57)}…`;
}
