/**
 * Wartości kolorów w JS.
 *
 * Potrzebne tam, gdzie nie da się użyć klasy: chrome nawigacji (tab bar,
 * nagłówki), StatusBar, propsy typu `tintColor`. Te same trójki RGB są
 * zapisane jako zmienne CSS w global.css i to tamten plik jest źródłem prawdy
 * dla stylowania — ten mirroruje go dla runtime'u.
 *
 * Nie edytuj tego pliku bez global.css. Parzystość sprawdza
 * src/theme/__tests__/palette.test.ts.
 */

export const colorTokens = [
  'background',
  'surface',
  'surface-elevated',
  'surface-sunken',
  'border',
  'border-strong',
  'hairline',
  'edge',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'accent',
  'accent-strong',
  'accent-fill',
  'accent-muted',
  'on-accent',
  'action',
  'on-action',
  'success',
  'warning',
  'danger',
  'scrim',
  'streak-0',
  'streak-1',
  'streak-2',
  'streak-3',
  'streak-4',
] as const;

export type ColorToken = (typeof colorTokens)[number];
export type ColorScheme = 'light' | 'dark';

/**
 * Poziomy wypełnienia w mapie serii. 0 to brak danych ORAZ dzień pominięty —
 * pominięcie nie ma własnego, karzącego koloru.
 */
export const streakLevels = [0, 1, 2, 3, 4] as const;
export type StreakLevel = (typeof streakLevels)[number];

/** Trójki "R G B" — ten sam format co w zmiennych CSS. */
export const palette: Record<ColorScheme, Record<ColorToken, string>> = {
  light: {
    background: '245 246 247',
    surface: '255 255 255',
    'surface-elevated': '255 255 255',
    'surface-sunken': '237 239 241',
    border: '224 227 230',
    'border-strong': '198 203 208',
    hairline: '224 227 230',
    edge: '255 255 255',
    'text-primary': '22 24 26',
    'text-secondary': '87 95 102',
    'text-tertiary': '122 131 138',
    accent: '122 90 18',
    'accent-strong': '95 69 14',
    'accent-fill': '201 146 43',
    'accent-muted': '245 234 210',
    'on-accent': '22 24 26',
    action: '22 24 26',
    'on-action': '245 246 247',
    success: '47 107 71',
    warning: '154 78 35',
    danger: '180 50 46',
    scrim: '22 24 26',
    'streak-0': '231 234 236',
    'streak-1': '240 227 194',
    'streak-2': '226 199 130',
    'streak-3': '207 167 70',
    'streak-4': '169 125 30',
  },
  dark: {
    background: '19 22 25',
    surface: '26 30 34',
    'surface-elevated': '34 39 44',
    'surface-sunken': '14 17 20',
    border: '44 50 56',
    'border-strong': '61 69 76',
    hairline: '44 50 56',
    edge: '255 255 255',
    'text-primary': '236 239 241',
    'text-secondary': '155 165 173',
    'text-tertiary': '123 133 141',
    accent: '201 146 43',
    'accent-strong': '221 166 60',
    'accent-fill': '201 146 43',
    'accent-muted': '46 39 22',
    'on-accent': '22 24 26',
    action: '236 239 241',
    'on-action': '19 22 25',
    success: '94 156 118',
    warning: '194 104 58',
    danger: '192 82 79',
    scrim: '14 17 20',
    'streak-0': '34 39 44',
    'streak-1': '58 51 32',
    'streak-2': '87 71 40',
    'streak-3': '140 106 38',
    'streak-4': '201 146 43',
  },
};

/** Zwraca kolor w formacie akceptowanym przez propsy stylu React Native. */
export function resolveColor(scheme: ColorScheme, token: ColorToken): string {
  return `rgb(${palette[scheme][token]})`;
}

/**
 * Kolor z kryciem.
 *
 * Potrzebny tam, gdzie krycie jest wartością systemową, a nie ozdobą —
 * świetlna krawędź płaszczyzny ma sześć albo dziewięć procent i ta liczba
 * musi dać się zaimportować do testu, a nie siedzieć w nazwie klasy.
 */
export function resolveColorAlpha(
  scheme: ColorScheme,
  token: ColorToken,
  alpha: number,
): string {
  return `rgba(${palette[scheme][token].split(' ').join(', ')}, ${alpha})`;
}

/** Token wypełnienia dla danego poziomu w mapie serii. */
export function streakToken(level: StreakLevel): ColorToken {
  return `streak-${level}`;
}
