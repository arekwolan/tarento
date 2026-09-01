/**
 * Wypisywanie komunikatów dla skryptów z scripts/.
 *
 * Założenie: te skrypty czyta osoba, która nie programuje w React Native.
 * Każdy komunikat błędu ma powiedzieć trzy rzeczy — co się stało, dlaczego
 * i co konkretnie wpisać, żeby to naprawić. Surowy stacktrace pokazujemy
 * tylko wtedy, gdy naprawdę nie wiemy, co poszło nie tak.
 */

import process from 'node:process';

const ESC = String.fromCharCode(27);

// Kolory tylko w prawdziwym terminalu. Przy przekierowaniu do pliku albo
// w CI kody ANSI byłyby śmieciem w logu.
const useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

const paint = (code) => (text) =>
  useColor ? `${ESC}[${code}m${text}${ESC}[0m` : String(text);

export const color = {
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  cyan: paint('36'),
  gray: paint('90'),
  bold: paint('1'),
};

export const SYMBOL = {
  ok: '✓',
  bad: '✗',
  warn: '!',
  arrow: '→',
  bullet: '•',
};

/** Nagłówek całego skryptu. */
export function title(text) {
  process.stdout.write(`\n${color.bold(text)}\n\n`);
}

/** Krok procedury: [3/7] Uruchamiam bazę… */
export function step(index, total, text) {
  process.stdout.write(`${color.gray(`[${index}/${total}]`)} ${text}\n`);
}

export function ok(text) {
  process.stdout.write(`      ${color.green(SYMBOL.ok)} ${text}\n`);
}

export function warn(text) {
  process.stdout.write(`      ${color.yellow(SYMBOL.warn)} ${text}\n`);
}

export function info(text) {
  process.stdout.write(`      ${color.gray(SYMBOL.bullet)} ${text}\n`);
}

/** Dopisek pod krokiem — szczegół, którego nie trzeba czytać. */
export function note(text) {
  process.stdout.write(`        ${color.gray(text)}\n`);
}

/** Komenda do skopiowania. */
export function command(text) {
  process.stdout.write(`        ${color.cyan(text)}\n`);
}

export function blank() {
  process.stdout.write('\n');
}

/**
 * Zatrzymuje skrypt i tłumaczy, co dalej.
 *
 * @param {object} problem
 * @param {string} problem.what   Co się nie udało — jednym zdaniem.
 * @param {string} problem.why    Dlaczego to blokuje pracę.
 * @param {string[]} problem.fix  Kroki naprawcze; linia zaczynająca się od
 *                                '$ ' jest renderowana jako komenda.
 * @param {string} [problem.raw]  Surowy output narzędzia — tylko gdy pomaga.
 */
export function fail({ what, why, fix, raw }) {
  process.stdout.write(`\n${color.red(`${SYMBOL.bad} NIE UDAŁO SIĘ — ${what}`)}\n\n`);

  if (typeof why === 'string' && why.length > 0) {
    process.stdout.write(`   ${color.bold('Dlaczego')}\n`);
    for (const line of why.split('\n')) {
      process.stdout.write(`     ${line}\n`);
    }
    blank();
  }

  if (Array.isArray(fix) && fix.length > 0) {
    process.stdout.write(`   ${color.bold('Jak to naprawić')}\n`);
    for (const line of fix) {
      if (line.startsWith('$ ')) {
        process.stdout.write(`     ${color.cyan(line.slice(2))}\n`);
      } else {
        process.stdout.write(`     ${line}\n`);
      }
    }
    blank();
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    process.stdout.write(`   ${color.bold('Co dokładnie odpowiedziało narzędzie')}\n`);
    for (const line of raw.trim().split('\n').slice(-12)) {
      process.stdout.write(`     ${color.gray(line)}\n`);
    }
    blank();
  }

  process.stdout.write(
    `${color.gray('   Linie zaczynające się od "npm error" poniżej to tylko informacja,')}\n` +
      `${color.gray('   że skrypt się zatrzymał. Właściwy komunikat jest powyżej.')}\n\n`,
  );

  process.exit(1);
}

/**
 * Tabela wyników dla `npm run doctor`.
 *
 * @param {{ name: string, status: 'ok' | 'bad' | 'warn', detail: string }[]} rows
 */
export function statusTable(rows) {
  const nameWidth = Math.max(...rows.map((row) => row.name.length), 'Sprawdzenie'.length);
  const label = { ok: 'OK   ', bad: 'BŁĄD ', warn: 'UWAGA' };
  const tint = { ok: color.green, bad: color.red, warn: color.yellow };

  const header = `${'Sprawdzenie'.padEnd(nameWidth)}  ${'Wynik'.padEnd(5)}  Szczegóły`;
  // Kreska pod nagłówkiem ma sięgać najszerszego wiersza, nie samego nagłówka.
  const width = Math.max(
    header.length,
    ...rows.map((row) => nameWidth + 9 + row.detail.length),
  );

  process.stdout.write(`  ${color.bold(header)}\n`);
  process.stdout.write(`  ${color.gray('-'.repeat(width))}\n`);

  for (const row of rows) {
    const status = tint[row.status](label[row.status]);
    process.stdout.write(`  ${row.name.padEnd(nameWidth)}  ${status}  ${row.detail}\n`);
  }

  blank();
}

/**
 * Ostatnia linia obrony: błąd, którego skrypt się nie spodziewał.
 *
 * Sam komunikat błędu pokazujemy — bez niego nie da się niczego zdiagnozować.
 * Stos wywołań już nie: dla osoby, która nie czyta kodu, jest to sam szum.
 */
export function failUnexpected(error) {
  const message = error instanceof Error ? error.message : String(error);

  fail({
    what: 'skrypt zatrzymał się na błędzie, którego nie przewidziałem',
    why: 'To nie jest żadna ze znanych sytuacji, więc nie mam gotowej podpowiedzi.\nNajczęściej pomaga sprawdzenie, czy całe środowisko jest w porządku.',
    fix: [
      'Sprawdź stan środowiska:',
      '$ npm run doctor',
      '',
      'Jeśli doctor nie pokazuje błędów, zbuduj bazę od zera:',
      '$ npm run dev -- --reset',
    ],
    raw: message,
  });
}
