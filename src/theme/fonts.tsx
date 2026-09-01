import { createContext, useContext, type ReactNode } from 'react';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
} from '@expo-google-fonts/literata';

import { FONT_FAMILY, SYSTEM_FALLBACK, type FontFamilyRole } from '@/theme/font-families';

/**
 * Wczytywanie krojów.
 *
 * Same nazwy rodzin mieszkają w @/theme/font-families — ten moduł dokłada
 * do nich runtime (expo-font), więc importują go tylko miejsca, które
 * naprawdę ładują pliki.
 */
const FONT_ASSETS = {
  [FONT_FAMILY.sans]: IBMPlexSans_400Regular,
  [FONT_FAMILY['sans-medium']]: IBMPlexSans_500Medium,
  [FONT_FAMILY['sans-semibold']]: IBMPlexSans_600SemiBold,
  [FONT_FAMILY.serif]: Literata_400Regular,
  [FONT_FAMILY['serif-italic']]: Literata_400Regular_Italic,
  [FONT_FAMILY.mono]: IBMPlexMono_500Medium,
};

export type FontStatus = {
  /** Splash może zniknąć: fonty są albo wczytane, albo nieodwracalnie padły. */
  isSettled: boolean;
  /** Wczytywanie padło — obowiązuje fallback systemowy. */
  hasFailed: boolean;
};

const FontContext = createContext<FontStatus>({ isSettled: true, hasFailed: false });

/** Wczytuje statyczne pliki krojów. Wołane raz, w korzeniu aplikacji. */
export function useAppFonts(): FontStatus {
  const [isLoaded, error] = useFonts(FONT_ASSETS);
  const hasFailed = error !== null;

  return { isSettled: isLoaded || hasFailed, hasFailed };
}

export function FontProvider({
  status,
  children,
}: {
  status: FontStatus;
  children: ReactNode;
}) {
  return <FontContext.Provider value={status}>{children}</FontContext.Provider>;
}

/**
 * Rodzina do nadpisania stylem, gdy fonty nie wstały.
 *
 * W normalnym przebiegu zwraca `undefined` — rodzinę ustawia wtedy klasa
 * `font-*` i nie ma potrzeby dublować jej w propsie `style`.
 */
export function useFontFallback(role: FontFamilyRole): string | undefined {
  const { hasFailed } = useContext(FontContext);
  return hasFailed ? SYSTEM_FALLBACK[role] : undefined;
}
