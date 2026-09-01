import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { concentricRadius, radii, type Radius } from '@/theme/radii';

/**
 * Promień płaszczyzny, w której siedzi element.
 *
 * Zasada koncentryczności mówi, że róg wewnętrzny zależy od zewnętrznego —
 * więc element nie może znać swojego promienia sam. Przekazywanie tego propem
 * kończyłoby się tym, że przy dziesiątym przycisku w karcie ktoś zapomni; stąd
 * kontekst, który ustawia płaszczyzna, a czytają kontrolki.
 *
 * Zakres jest wąski celowo: ustawiają go wyłącznie `Card` i `Sheet`, czytają
 * wyłącznie kontrolki z własnym promieniem (`Button`, `TextField`, `Chip`).
 * Poza płaszczyzną kontrolka dostaje swój promień domyślny i nic się nie zmienia.
 */

type SurfaceRadius = {
  /** Promień płaszczyzny. */
  radius: Radius;
  /** Wcięcie zawartości od krawędzi płaszczyzny, w dp. */
  inset: number;
};

const SurfaceRadiusContext = createContext<SurfaceRadius | null>(null);

export type SurfaceRadiusProviderProps = SurfaceRadius & { children: ReactNode };

export function SurfaceRadiusProvider({
  radius,
  inset,
  children,
}: SurfaceRadiusProviderProps) {
  const value = useMemo(() => ({ radius, inset }), [radius, inset]);

  return (
    <SurfaceRadiusContext.Provider value={value}>
      {children}
    </SurfaceRadiusContext.Provider>
  );
}

/**
 * Promień kontrolki: koncentryczny wewnątrz płaszczyzny, domyślny poza nią.
 *
 * @param fallback promień, który kontrolka ma, gdy stoi sama na ekranie
 */
export function useControlRadius(fallback: Radius): number {
  const surface = useContext(SurfaceRadiusContext);

  return surface === null
    ? radii[fallback]
    : concentricRadius(surface.radius, surface.inset);
}
