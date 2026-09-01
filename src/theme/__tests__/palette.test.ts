import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colorTokens, palette, type ColorScheme } from '@/theme/palette';

// Komentarze wycinamy przed parsowaniem: bez tego deklaracja poprzedzona
// komentarzem wpada do tego samego kawałka po splicie na ';' i cicho znika
// z porównania — czyli test przestaje pilnować akurat tych tokenów, przy
// których ktoś uznał, że trzeba coś wyjaśnić.
const css = readFileSync(join(__dirname, '..', '..', '..', 'global.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Wyciąga zmienne --color-* z jednego bloku selektora w global.css. */
function cssColorVars(selectorPattern: RegExp): Record<string, string> {
  const match = selectorPattern.exec(css);
  if (match === null) {
    throw new Error(`Nie znaleziono bloku ${String(selectorPattern)} w global.css`);
  }

  const body = match[1] ?? '';
  const vars: Record<string, string> = {};

  for (const declaration of body.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;

    const name = declaration.slice(0, separator).trim();
    if (!name.startsWith('--color-')) continue;

    vars[name.slice('--color-'.length)] = declaration.slice(separator + 1).trim();
  }

  return vars;
}

const cssPalette: Record<ColorScheme, Record<string, string>> = {
  // (?<![\w.-]) odsiewa `.dark:root`, który też zawiera `:root`.
  light: cssColorVars(/(?<![\w.-]):root\s*\{([^}]*)\}/),
  dark: cssColorVars(/\.dark:root\s*\{([^}]*)\}/),
};

describe('paleta', () => {
  it.each(['light', 'dark'] as const)(
    'global.css i palette.ts mają ten sam zestaw tokenów (%s)',
    (scheme) => {
      expect(Object.keys(cssPalette[scheme]).sort()).toEqual([...colorTokens].sort());
    },
  );

  it.each(['light', 'dark'] as const)(
    'global.css i palette.ts mają te same wartości (%s)',
    (scheme) => {
      expect(cssPalette[scheme]).toEqual(palette[scheme]);
    },
  );

  it.each(['light', 'dark'] as const)('wartości są trójkami RGB 0-255 (%s)', (scheme) => {
    for (const token of colorTokens) {
      const channels = palette[scheme][token].split(' ');
      expect(channels).toHaveLength(3);
      for (const channel of channels) {
        const value = Number(channel);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(255);
      }
    }
  });
});
