/**
 * Skala odstępów: baza 4.
 *
 * Wartości liczbowe dla miejsc, w których React Native wymaga liczby
 * (np. wysokość tab bara, insety). W komponentach używaj klas: p-5, gap-3, mt-8.
 */
export const SPACING_UNIT = 4;

/** krok * 4px */
export function space(step: number): number {
  return step * SPACING_UNIT;
}

/** Margines poziomy każdego ekranu. Jedna wartość dla całej aplikacji. */
export const SCREEN_PADDING = space(5); // 20

/** Odstęp między kartami na liście. */
export const CARD_GAP = space(3); // 12

/** Odstęp między sekcjami ekranu. */
export const SECTION_GAP = space(8); // 32

/** Maksymalna szerokość kolumny dłuższego materiału na tabletach. */
export const READER_MAX_WIDTH = space(160); // 640

/**
 * Minimalny cel dotykowy (dp). Wynika z reguły użyteczności, nie ze skali
 * odstępów — dlatego stoi osobno i nie wolno go zmniejszać „bo się nie mieści".
 */
export const MIN_TOUCH_TARGET = 48;
