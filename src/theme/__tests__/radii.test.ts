import { join } from 'node:path';

import { concentricRadius, CONTINUOUS_CURVE, radii, type Radius } from '@/theme/radii';

/* eslint-disable @typescript-eslint/no-require-imports */
const tailwindConfig = require(
  join(process.cwd(), 'tailwind.config.js'),
) as TailwindShape;
/* eslint-enable @typescript-eslint/no-require-imports */

type TailwindShape = { theme: { borderRadius: Record<string, string> } };

function px(value: string): number {
  return Number(value.replace('px', ''));
}

const scale = Object.keys(radii) as Radius[];

/**
 * Skala promieni żyje w dwóch miejscach: tailwind.config.js generuje klasy
 * `rounded-*`, a `radii` podaje te same liczby kodowi, który klasy użyć nie
 * może (styl Reanimated, promień koncentryczny, ekran awaryjny). Ten test jest
 * jedynym powodem, dla którego wolno je trzymać osobno.
 */
describe('skala promieni', () => {
  it.each(scale)('%s ma tę samą wartość w tailwind.config.js', (key) => {
    const declared = tailwindConfig.theme.borderRadius[key];

    expect(declared).toBeDefined();
    expect(px(declared ?? '')).toBe(radii[key]);
  });

  it('tailwind nie deklaruje promieni spoza skali', () => {
    // `none` istnieje tylko po stronie klas — zerowy promień nie potrzebuje
    // wartości w JS, bo brak zaokrąglenia jest domyślny.
    const declared = Object.keys(tailwindConfig.theme.borderRadius).filter(
      (key) => key !== 'none',
    );

    expect(declared.sort()).toEqual([...scale].sort());
  });

  it('skala rośnie monotonicznie', () => {
    const values = [radii.xs, radii.sm, radii.md, radii.lg, radii.xl];

    expect(values).toEqual([...values].sort((left, right) => left - right));
    expect(new Set(values).size).toBe(values.length);
  });

  it('krzywizna ciągła jest jedną wartością, nie stylem do skopiowania', () => {
    expect(CONTINUOUS_CURVE).toEqual({ borderCurve: 'continuous' });
  });
});

describe('concentricRadius', () => {
  const nested: Radius[] = ['xs', 'sm', 'md', 'lg', 'xl'];

  it.each(nested)('nigdy nie schodzi poniżej xs dla %s', (outer) => {
    for (const inset of [0, 4, 8, 16, 20, 64]) {
      expect(concentricRadius(outer, inset)).toBeGreaterThanOrEqual(radii.xs);
    }
  });

  it.each(nested)('nigdy nie przerasta promienia zewnętrznego dla %s', (outer) => {
    for (const inset of [0, 4, 8, 16, 20]) {
      expect(concentricRadius(outer, inset)).toBeLessThanOrEqual(radii[outer]);
    }
  });

  it('przy niezerowym wcięciu schodzi poniżej zewnętrznego, dopóki jest z czego', () => {
    // Warunek „zawsze mniejszy" obowiązuje tylko tam, gdzie podłoga na xs go
    // nie przycina — przy zewnętrznym równym xs nie ma już czego odejmować.
    expect(concentricRadius('lg', 8)).toBe(20);
    expect(concentricRadius('md', 4)).toBe(14);
    expect(concentricRadius('sm', 2)).toBe(10);

    expect(concentricRadius('xs', 4)).toBe(radii.xs);
  });

  it('odpowiada rzeczywistym wcięciom karty i arkusza', () => {
    // Karta: promień md, padding 16. Arkusz: promień lg, padding 20.
    expect(concentricRadius('md', 16)).toBe(radii.xs);
    expect(concentricRadius('lg', 20)).toBe(radii.xs);
  });

  it('ujemne wcięcie traktuje jak zerowe', () => {
    expect(concentricRadius('md', -8)).toBe(radii.md);
  });
});
