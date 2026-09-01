import { Platform } from 'react-native';

import type { FontRole } from '@/theme/typography';

/**
 * Nazwy krojów aplikacji.
 *
 * Osobno od `@/theme/fonts`, bo tamten moduł wciąga `expo-font` — a nazwy
 * rodzin są potrzebne też tam, gdzie runtime'u fontów nie ma i być nie może:
 * w ekranie awaryjnym trasy i w testach parzystości skali.
 *
 * IBM Plex ma bezbłędną diakrytykę i cyfry tabelaryczne, Literata to krój
 * książkowy — cytaty pochodzą z książek, więc krój niesie znaczenie, a nie
 * dekorację. Mono daje wyrównanie kolumn liczb za darmo.
 *
 * Wyłącznie statyczne pliki .ttf, bez krojów zmiennych: na Androidzie
 * w React Native bywają zawodne. Waga jest zakodowana w nazwie rodziny,
 * bo `fontWeight` na statycznym pliku daje syntetyczne pogrubienie.
 */
export type FontFamilyRole = FontRole | 'serif-italic';

/** Rodziny zarejestrowane w runtime — te same nazwy co klasy `font-*`. */
export const FONT_FAMILY = {
  sans: 'IBMPlexSans_400Regular',
  'sans-medium': 'IBMPlexSans_500Medium',
  'sans-semibold': 'IBMPlexSans_600SemiBold',
  serif: 'Literata_400Regular',
  'serif-italic': 'Literata_400Regular_Italic',
  mono: 'IBMPlexMono_500Medium',
} as const satisfies Record<FontFamilyRole, string>;

/**
 * Jawny fallback systemowy na wypadek, gdyby wczytywanie się nie powiodło.
 *
 * Bez tego React Native pokazałby krój domyślny bez żadnej kontroli nad tym,
 * który to jest — a szeryfy w cytacie i monospace w liczbach niosą znaczenie,
 * więc chcemy je zachować nawet w trybie awaryjnym.
 */
export const SYSTEM_FALLBACK: Record<FontFamilyRole, string> = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  'sans-medium': Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  'sans-semibold': Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  'serif-italic': Platform.select({
    ios: 'Georgia-Italic',
    android: 'serif',
    default: 'serif',
  }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};
