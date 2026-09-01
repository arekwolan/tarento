import { EDGE_ALPHA, type ElevationLevel } from '@/theme/elevation';
import {
  colorTokens,
  palette,
  streakLevels,
  streakToken,
  type ColorScheme,
  type ColorToken,
} from '@/theme/palette';

/**
 * Kontrast według WCAG 2.1.
 *
 * Paleta jest celowo przygaszona, więc progi nie są tu formalnością — ten test
 * istnieje po to, żeby kolejna zmiana odcienia nie zepsuła czytelności po cichu.
 *
 * Progi są dwa, bo dwie są role kolorów:
 *
 * - 4.5:1 dla tokenów, na których leży tekst ciągły (`text-primary`,
 *   `text-secondary`, `accent`) oraz dla par „tekst na wypełnieniu".
 * - 3:1 dla tokenów statusu (`success`, `warning`, `danger`) i dla
 *   `text-tertiary`. Te niosą krótkie etykiety i ikony, zawsze obok tej samej
 *   informacji podanej inaczej, więc obowiązuje ich próg dla elementów
 *   nietekstowych. Wartości mosiądzowo-grafitowej palety z systemu designu
 *   nie sięgają przy nich 4.5:1 w żadnym motywie i jest to świadoma decyzja
 *   projektowa, a nie przeoczenie: to kolory, których nie wolno użyć do
 *   akapitu.
 */
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(triplet: string): number {
  const [red = 0, green = 0, blue = 0] = triplet.split(' ').map(Number);
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function ratioOf(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

function contrastRatio(
  scheme: ColorScheme,
  foreground: ColorToken,
  background: ColorToken,
) {
  return ratioOf(
    relativeLuminance(palette[scheme][foreground]),
    relativeLuminance(palette[scheme][background]),
  );
}

/** Kolor półprzezroczysty złożony na nieprzezroczystym tle. */
function blend(foreground: string, background: string, alpha: number): string {
  const front = foreground.split(' ').map(Number);
  const back = background.split(' ').map(Number);

  return front
    .map((channel, index) =>
      Math.round(channel * alpha + (back[index] ?? 0) * (1 - alpha)),
    )
    .join(' ');
}

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

/** Tła, na których w ogóle ląduje tekst. */
const SURFACES: readonly ColorToken[] = [
  'background',
  'surface',
  'surface-elevated',
  'surface-sunken',
];

/** Kolory niosące tekst ciągły. */
const BODY_TEXT_TOKENS: readonly ColorToken[] = [
  'text-primary',
  'text-secondary',
  'accent',
];

/** Kolory krótkich etykiet i ikon — nigdy akapitu. */
const ACCENT_TEXT_TOKENS: readonly ColorToken[] = [
  'text-tertiary',
  'success',
  'warning',
  'danger',
];

describe('kontrast WCAG AA', () => {
  describe.each(SCHEMES)('motyw %s', (scheme) => {
    it.each(
      BODY_TEXT_TOKENS.flatMap((text) =>
        SURFACES.map((surface) => [text, surface] as const),
      ),
    )('%s na %s ma co najmniej 4.5:1', (text, surface) => {
      expect(contrastRatio(scheme, text, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(
      ACCENT_TEXT_TOKENS.flatMap((text) =>
        SURFACES.map((surface) => [text, surface] as const),
      ),
    )('%s na %s ma co najmniej 3:1', (text, surface) => {
      expect(contrastRatio(scheme, text, surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it('etykieta przycisku głównego jest czytelna', () => {
      expect(contrastRatio(scheme, 'on-action', 'action')).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });

    it('tekst na wypełnieniu akcentem jest czytelny', () => {
      expect(contrastRatio(scheme, 'on-accent', 'accent-fill')).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });

    it('przycisk główny odcina się od tła', () => {
      expect(contrastRatio(scheme, 'action', 'background')).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });

    it('obramowanie odcina się od tła na tyle, żeby je było widać', () => {
      // Elementy nietekstowe mają w WCAG niższy próg niż tekst.
      expect(contrastRatio(scheme, 'border', 'background')).toBeGreaterThan(1.1);
    });

    it('mocne obramowanie jest wyraźniejsze od zwykłego', () => {
      expect(contrastRatio(scheme, 'border-strong', 'background')).toBeGreaterThan(
        contrastRatio(scheme, 'border', 'background'),
      );
    });
  });

  describe.each(SCHEMES)('skala serii, motyw %s', (scheme) => {
    it('poziomy rosną monotonicznie', () => {
      const luminances = streakLevels.map((level) =>
        relativeLuminance(palette[scheme][streakToken(level)]),
      );

      // W ciemnym motywie wyższy poziom jest jaśniejszy, w jasnym — ciemniejszy.
      const sorted = [...luminances].sort((a, b) => (scheme === 'dark' ? a - b : b - a));
      expect(luminances).toEqual(sorted);
      expect(new Set(luminances).size).toBe(streakLevels.length);
    });

    it('komplet odcina się od dnia bez danych', () => {
      expect(contrastRatio(scheme, 'streak-4', 'streak-0')).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });

    it('dzień bez danych odcina się od tła karty', () => {
      expect(contrastRatio(scheme, 'streak-0', 'surface')).toBeGreaterThan(1.05);
    });
  });

  it('każdy token ma poprawną trójkę RGB', () => {
    for (const scheme of SCHEMES) {
      for (const token of colorTokens) {
        const channels = palette[scheme][token].split(' ').map(Number);
        expect(channels).toHaveLength(3);
        expect(channels.every((value) => Number.isInteger(value))).toBe(true);
      }
    }
  });
});

/**
 * Głębia bez obrysów.
 *
 * Po przejściu z kresek na warstwy krawędź karty niesie w ciemnym motywie
 * świetlna linia o kryciu kilku procent, a w jasnym cień. Cienia nie da się
 * zmierzyć liczbą kontrastu, ale krawędź już tak — i to jest jedyny sposób,
 * żeby „karty są widoczne bez obrysu" było sprawdzeniem, a nie zrzutem ekranu.
 */
describe('głębia warstwowa', () => {
  const EDGE_SURFACE: Record<ElevationLevel, ColorToken> = {
    card: 'surface',
    raised: 'surface-elevated',
    sheet: 'surface-elevated',
  };

  const LEVELS = Object.keys(EDGE_ALPHA) as ElevationLevel[];

  it.each(LEVELS)('krycie krawędzi %s nie przekracza sufitu', (level) => {
    // Powyżej 0.12 krawędź przestaje być światłem i zaczyna być obrysem —
    // czyli dokładnie tym, od czego ta zmiana odchodzi.
    expect(EDGE_ALPHA[level]).toBeGreaterThan(0);
    expect(EDGE_ALPHA[level]).toBeLessThanOrEqual(0.12);
  });

  it.each(LEVELS)('krawędź %s jest widoczna na swojej płaszczyźnie', (level) => {
    const surface = palette.dark[EDGE_SURFACE[level]];
    const edge = blend(palette.dark.edge, surface, EDGE_ALPHA[level]);

    expect(ratioOf(relativeLuminance(edge), relativeLuminance(surface))).toBeGreaterThan(
      1.1,
    );
  });

  it('krawędź uniesiona jest wyraźniejsza od krawędzi karty', () => {
    const contrastAt = (level: ElevationLevel) => {
      const surface = palette.dark[EDGE_SURFACE[level]];

      return ratioOf(
        relativeLuminance(blend(palette.dark.edge, surface, EDGE_ALPHA[level])),
        relativeLuminance(surface),
      );
    };

    expect(contrastAt('raised')).toBeGreaterThan(contrastAt('card'));
  });

  it('w jasnym motywie krawędź świetlna nic nie rysuje i tak ma być', () => {
    // Biel na bieli. Głębię niesie tam cień z elevation.ts, nie ta krawędź.
    expect(palette.light.edge).toBe(palette.light.surface);
  });

  it.each(SCHEMES)('płaszczyzna karty odcina się od tła ekranu (%s)', (scheme) => {
    // Sama płaszczyzna daje w obu motywach około 1.08 — sygnał słaby i taki
    // ma być: karta ma się wyłaniać, a nie odcinać. Resztę roboty robi
    // świetlna krawędź w ciemnym i cień w jasnym. Ten próg pilnuje wyłącznie
    // tego, żeby ktoś nie zrównał obu płaszczyzn.
    expect(contrastRatio(scheme, 'surface', 'background')).toBeGreaterThan(1.05);
  });

  it('separator jest widoczny, ale nie mocniejszy od obrysu', () => {
    for (const scheme of SCHEMES) {
      expect(contrastRatio(scheme, 'hairline', 'surface')).toBeGreaterThan(1.05);
      expect(contrastRatio(scheme, 'hairline', 'background')).toBeLessThanOrEqual(
        contrastRatio(scheme, 'border', 'background'),
      );
    }
  });
});
