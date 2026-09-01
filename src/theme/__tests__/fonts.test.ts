import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_FAMILY } from '@/theme/font-families';

/**
 * Polskie znaki w każdym kroju i każdej wadze.
 *
 * Wymóg twardy systemu designu. Brak jednego glifu nie wywala aplikacji —
 * podmienia go po cichu na krój zastępczy, więc „Ł" w nagłówku wygląda inaczej
 * niż reszta słowa i nikt tego nie zauważa aż do zrzutu ekranu ze sklepu.
 * Dlatego sprawdzamy tablicę cmap pliku, a nie deklarację `subsets`.
 */
const POLISH = 'ĄĆĘŁŃÓŚŹŻąćęłńóśźż';

/** Ścieżki do plików .ttf, po jednym na zarejestrowaną rodzinę. */
const FONT_FILES: Record<string, string> = {
  [FONT_FAMILY.sans]: '@expo-google-fonts/ibm-plex-sans/400Regular',
  [FONT_FAMILY['sans-medium']]: '@expo-google-fonts/ibm-plex-sans/500Medium',
  [FONT_FAMILY['sans-semibold']]: '@expo-google-fonts/ibm-plex-sans/600SemiBold',
  [FONT_FAMILY.serif]: '@expo-google-fonts/literata/400Regular',
  [FONT_FAMILY['serif-italic']]: '@expo-google-fonts/literata/400Regular_Italic',
  [FONT_FAMILY.mono]: '@expo-google-fonts/ibm-plex-mono/500Medium',
};

function fontPath(family: string): string {
  const directory = FONT_FILES[family];
  if (directory === undefined) throw new Error(`Brak ścieżki dla rodziny ${family}`);
  return join(process.cwd(), 'node_modules', directory, `${family}.ttf`);
}

/** Zwraca zawartość tablicy o podanym tagu z pliku TrueType. */
function readTable(font: Buffer, tag: string): Buffer {
  const tableCount = font.readUInt16BE(4);

  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (font.toString('ascii', record, record + 4) !== tag) continue;

    const offset = font.readUInt32BE(record + 8);
    return font.subarray(offset, offset + font.readUInt32BE(record + 12));
  }

  throw new Error(`Plik nie zawiera tablicy ${tag}`);
}

/** Identyfikator glifu dla znaku w podtablicy cmap formatu 4. */
function glyphFromFormat4(subtable: Buffer, codePoint: number): number {
  const segCount = subtable.readUInt16BE(6) / 2;
  const endCodes = 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;

  for (let segment = 0; segment < segCount; segment += 1) {
    if (subtable.readUInt16BE(endCodes + segment * 2) < codePoint) continue;
    if (subtable.readUInt16BE(startCodes + segment * 2) > codePoint) return 0;

    const rangeOffsetAt = idRangeOffsets + segment * 2;
    const rangeOffset = subtable.readUInt16BE(rangeOffsetAt);
    const delta = subtable.readInt16BE(idDeltas + segment * 2);

    if (rangeOffset === 0) {
      return (codePoint + delta) & 0xffff;
    }

    const start = subtable.readUInt16BE(startCodes + segment * 2);
    const glyphAt = rangeOffsetAt + rangeOffset + (codePoint - start) * 2;
    const glyph = subtable.readUInt16BE(glyphAt);

    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }

  return 0;
}

/** Identyfikator glifu dla znaku w podtablicy cmap formatu 12. */
function glyphFromFormat12(subtable: Buffer, codePoint: number): number {
  const groupCount = subtable.readUInt32BE(12);

  for (let group = 0; group < groupCount; group += 1) {
    const at = 16 + group * 12;
    const start = subtable.readUInt32BE(at);
    const end = subtable.readUInt32BE(at + 4);

    if (codePoint < start) return 0;
    if (codePoint > end) continue;

    return subtable.readUInt32BE(at + 8) + (codePoint - start);
  }

  return 0;
}

/** Podtablica cmap dla Unicode: preferujemy format 12, w zapasie format 4. */
function unicodeSubtable(cmap: Buffer): { subtable: Buffer; format: number } {
  const tableCount = cmap.readUInt16BE(2);
  let fallback: { subtable: Buffer; format: number } | null = null;

  for (let index = 0; index < tableCount; index += 1) {
    const record = 4 + index * 8;
    const platform = cmap.readUInt16BE(record);
    const encoding = cmap.readUInt16BE(record + 2);
    const subtable = cmap.subarray(cmap.readUInt32BE(record + 4));
    const format = subtable.readUInt16BE(0);

    const isUnicode =
      platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!isUnicode) continue;

    if (format === 12) return { subtable, format };
    if (format === 4 && fallback === null) fallback = { subtable, format };
  }

  if (fallback === null) throw new Error('Brak podtablicy cmap dla Unicode');
  return fallback;
}

function hasGlyph(font: Buffer, character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  const { subtable, format } = unicodeSubtable(readTable(font, 'cmap'));

  return format === 12
    ? glyphFromFormat12(subtable, codePoint) !== 0
    : glyphFromFormat4(subtable, codePoint) !== 0;
}

describe('polskie znaki w krojach', () => {
  it.each(Object.values(FONT_FAMILY))('%s ma komplet diakrytyki', (family) => {
    const font = readFileSync(fontPath(family));

    for (const character of POLISH) {
      expect({ family, character, present: hasGlyph(font, character) }).toEqual({
        family,
        character,
        present: true,
      });
    }
  });

  it('każda rodzina ze skali ma zarejestrowany plik', () => {
    for (const family of Object.values(FONT_FAMILY)) {
      expect(FONT_FILES[family]).toBeDefined();
    }
  });
});
