import { Easing } from 'react-native-reanimated';

/**
 * Ruch w interfejsie.
 *
 * Tylko Reanimated — żadnej innej biblioteki animacji. Sprężyna jest dozwolona
 * w jednym miejscu: potwierdzenie odhaczenia nawyku. Wszystko inne to timing.
 *
 * Każda animacja musi respektować `useReducedMotion()`: przy włączonej
 * redukcji zostaje wyłącznie zmiana `opacity`, bez transformacji.
 * Pomaga w tym `motionDuration()` i `pressScale()` niżej.
 */

export const duration = {
  /** Reakcja na dotyk, zmiana stanu kontrolki. */
  fast: 140,
  /** Domyślne wejście i wyjście elementu. */
  base: 220,
  /** Arkusz, toast, większe przesunięcia. */
  slow: 320,
} as const;

export type MotionDuration = keyof typeof duration;

/** Wejścia elementów: szybki start, miękkie dojście. */
export const easeEnter = Easing.bezier(0.22, 1, 0.36, 1);

/** Przesunięcia i zmiany pozycji istniejących elementów. */
export const easeMove = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Jedyna sprężyna w aplikacji — potwierdzenie odhaczenia nawyku.
 * Nie kopiuj tych wartości do innych animacji.
 */
export const checkSpring = { damping: 18, stiffness: 220 } as const;

/** Stan wciśnięcia: przygaszenie zawsze, skala tylko bez redukcji ruchu. */
export const PRESS_OPACITY = 0.9;
export const PRESS_SCALE = 0.98;

/** Czas trwania z uwzględnieniem redukcji ruchu (0 = zmiana natychmiastowa). */
export function motionDuration(key: MotionDuration, reduced: boolean): number {
  return reduced ? 0 : duration[key];
}

/** Skala wciśnięcia z uwzględnieniem redukcji ruchu. */
export function pressScale(reduced: boolean): number {
  return reduced ? 1 : PRESS_SCALE;
}
