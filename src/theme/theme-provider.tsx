import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'nativewind';

import { palette, type ColorScheme, type ColorToken } from '@/theme/palette';

/**
 * 'system' oznacza podążanie za ustawieniem systemowym (wymaga
 * userInterfaceStyle: 'automatic' w app.config.ts). 'light'/'dark' to
 * świadome nadpisanie przez użytkownika.
 *
 * Wybór nie jest jeszcze utrwalany — wraca do 'system' po restarcie.
 * Persystencja przyjdzie razem z MMKV.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const themePreferences: readonly ThemePreference[] = ['system', 'light', 'dark'];

type ThemeContextValue = {
  /** Co wybrał użytkownik. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Co z tego wyszło po rozwiązaniu 'system'. */
  scheme: ColorScheme;
  /** Kolor tokenu dla bieżącego schematu, w formacie 'rgb(r g b)'. */
  color: (token: ColorToken) => string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      setColorScheme(next);
    },
    [setColorScheme],
  );

  const scheme: ColorScheme = colorScheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      scheme,
      color: (token: ColorToken) => `rgb(${palette[scheme][token]})`,
    }),
    [preference, setPreference, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme() wymaga <ThemeProvider> wyżej w drzewie.');
  }
  return value;
}
