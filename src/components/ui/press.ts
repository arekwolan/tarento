import { useReducedMotion } from 'react-native-reanimated';

/**
 * Klasy stanu wciśnięcia: przygaszenie zawsze, skala tylko wtedy, gdy system
 * nie prosi o ograniczenie ruchu.
 *
 * Wartości (opacity 0.9, scale 0.98) pochodzą z reguł dostępności systemu
 * designu — nie zmieniaj ich lokalnie, zmień w tailwind.config.js i tutaj.
 */
export function usePressClass(): string {
  const reducedMotion = useReducedMotion();

  return reducedMotion ? 'active:opacity-90' : 'active:opacity-90 active:scale-98';
}
