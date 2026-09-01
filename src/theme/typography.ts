/**
 * Skala typografii. Zamknięta lista — nowy rozmiar powstaje tylko przez
 * zmianę tego pliku i tailwind.config.js, nigdy przez `text-[15px]`.
 *
 * Rozmiary i interlinie żyją w tailwind.config.js pod tymi samymi nazwami;
 * tutaj jest przypisanie wariant → klasy oraz metryki, których potrzebują
 * testy i dokumentacja.
 *
 * Krój jest zakodowany w rodzinie, nie w `fontWeight`: pliki są statyczne,
 * więc `font-bold` na kroju 400 dałoby syntetyczne pogrubienie zamiast
 * właściwej wagi. Dlatego `theme.fontWeight` jest w Tailwindzie wyłączone.
 */

export const textVariants = [
  'display',
  'titleLg',
  'title',
  'bodyLg',
  'body',
  'caption',
  'label',
  'quote',
  'numLg',
  'num',
] as const;

export type TextVariant = (typeof textVariants)[number];

/** Rodziny odpowiadają klasom `font-*` z tailwind.config.js. */
export type FontRole = 'sans' | 'sans-medium' | 'sans-semibold' | 'serif' | 'mono';

export type TextMetrics = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  font: FontRole;
};

/**
 * Metryki wariantów. Muszą zgadzać się z tailwind.config.js — pilnuje tego
 * src/theme/__tests__/typography.test.ts.
 */
export const textMetrics: Record<TextVariant, TextMetrics> = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.5, font: 'sans-semibold' },
  titleLg: { fontSize: 26, lineHeight: 32, letterSpacing: -0.3, font: 'sans-semibold' },
  title: { fontSize: 19, lineHeight: 25, letterSpacing: -0.1, font: 'sans-semibold' },
  bodyLg: { fontSize: 17, lineHeight: 25, letterSpacing: 0, font: 'sans' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, font: 'sans' },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0, font: 'sans' },
  label: { fontSize: 13, lineHeight: 16, letterSpacing: 0.2, font: 'sans-medium' },
  quote: { fontSize: 22, lineHeight: 34, letterSpacing: 0, font: 'serif' },
  numLg: { fontSize: 28, lineHeight: 32, letterSpacing: 0, font: 'mono' },
  num: { fontSize: 13, lineHeight: 18, letterSpacing: 0, font: 'mono' },
};

/** Klasy Tailwind przypisane do wariantu: rozmiar, tracking, krój. */
export const textVariantClass: Record<TextVariant, string> = {
  display: 'text-display tracking-display font-sans-semibold',
  titleLg: 'text-title-lg tracking-title-lg font-sans-semibold',
  title: 'text-title tracking-title font-sans-semibold',
  bodyLg: 'text-body-lg font-sans',
  body: 'text-body font-sans',
  caption: 'text-caption font-sans',
  label: 'text-label tracking-label font-sans-medium',
  quote: 'text-quote font-serif',
  numLg: 'text-num-lg font-mono',
  num: 'text-num font-mono',
};

/**
 * Warianty, w których wartość zmienia się w czasie (licznik serii, procenty).
 * Bez cyfr tabelarycznych szerokość ciągu skacze przy każdej zmianie.
 */
export const TABULAR_VARIANTS: readonly TextVariant[] = ['numLg', 'num'];
