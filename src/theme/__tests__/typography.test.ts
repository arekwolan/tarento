import { join } from 'node:path';

import { FONT_FAMILY } from '@/theme/font-families';
import {
  textMetrics,
  textVariantClass,
  textVariants,
  type TextVariant,
} from '@/theme/typography';

/* eslint-disable @typescript-eslint/no-require-imports */
const tailwindConfig = require(
  join(process.cwd(), 'tailwind.config.js'),
) as TailwindShape;
/* eslint-enable @typescript-eslint/no-require-imports */

type TailwindShape = {
  theme: {
    fontSize: Record<string, [string, string]>;
    letterSpacing: Record<string, string>;
    fontFamily: Record<string, string>;
  };
};

/** Nazwa klasy Tailwinda dla wariantu: display → display, titleLg → title-lg. */
function scaleKey(variant: TextVariant): string {
  return variant.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function px(value: string): number {
  return Number(value.replace('px', ''));
}

/**
 * Skala typografii żyje w dwóch miejscach: tailwind.config.js generuje klasy,
 * a textMetrics podaje te same liczby kodowi, który nie może użyć klasy
 * (ekran awaryjny, tab bar). Ten test jest jedynym powodem, dla którego wolno
 * je trzymać osobno.
 */
describe('skala typografii', () => {
  it.each(textVariants)('%s ma ten sam rozmiar w tailwind.config.js', (variant) => {
    const entry = tailwindConfig.theme.fontSize[scaleKey(variant)];
    expect(entry).toBeDefined();
    expect(px(entry?.[0] ?? '')).toBe(textMetrics[variant].fontSize);
    expect(px(entry?.[1] ?? '')).toBe(textMetrics[variant].lineHeight);
  });

  it.each(textVariants)('%s ma ten sam tracking', (variant) => {
    const expected = textMetrics[variant].letterSpacing;
    const declared = tailwindConfig.theme.letterSpacing[scaleKey(variant)];

    if (expected === 0) {
      // Zerowy tracking nie dostaje własnej klasy — obowiązuje domyślny.
      expect(px(tailwindConfig.theme.letterSpacing.normal ?? '')).toBe(0);
      return;
    }

    expect(declared).toBeDefined();
    expect(px(declared ?? '')).toBe(expected);
  });

  it.each(textVariants)('%s używa zarejestrowanej rodziny', (variant) => {
    const role = textMetrics[variant].font;
    expect(tailwindConfig.theme.fontFamily[role]).toBe(FONT_FAMILY[role]);
    expect(textVariantClass[variant]).toContain(`font-${role}`);
  });

  it('żaden wariant nie schodzi poniżej 13px', () => {
    for (const variant of textVariants) {
      expect(textMetrics[variant].fontSize).toBeGreaterThanOrEqual(13);
    }
  });

  it('klasa wariantu podaje rozmiar ze skali', () => {
    for (const variant of textVariants) {
      expect(textVariantClass[variant]).toContain(`text-${scaleKey(variant)}`);
    }
  });
});
