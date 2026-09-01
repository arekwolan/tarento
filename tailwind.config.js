/**
 * System designu Tarento.
 *
 * Wszystkie skale są NADPISANE, nie rozszerzone. To celowe: `bg-blue-500`,
 * `text-sm`, `p-7` i `rounded-2xl` mają nie istnieć, żeby dodanie ekranu poza
 * systemem było trudniejsze niż zrobienie tego poprawnie.
 *
 * - Kolory: wyłącznie zmienne CSS z global.css, nazwy semantyczne. Nigdy nie
 *   wpisuj tu wartości koloru na sztywno.
 * - Typografia: rozmiary ze skali z src/theme/typography.ts. Waga jest zaszyta
 *   w rodzinie (statyczne pliki .ttf), więc `theme.fontWeight` jest wyłączone —
 *   `font-bold` na kroju 400 dałoby syntetyczne pogrubienie.
 * - Odstępy: baza 4. Kroki 1–18 to skala z systemu designu; 12 (48dp) to
 *   minimalny cel dotykowy, a 20–32 służą wyłącznie jako wymiary szkieletów,
 *   nie jako odstępy.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    colors: {
      transparent: 'transparent',
      background: 'rgb(var(--color-background) / <alpha-value>)',
      surface: 'rgb(var(--color-surface) / <alpha-value>)',
      'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
      'surface-sunken': 'rgb(var(--color-surface-sunken) / <alpha-value>)',
      border: 'rgb(var(--color-border) / <alpha-value>)',
      'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
      hairline: 'rgb(var(--color-hairline) / <alpha-value>)',
      edge: 'rgb(var(--color-edge) / <alpha-value>)',
      'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
      'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
      'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
      accent: 'rgb(var(--color-accent) / <alpha-value>)',
      'accent-strong': 'rgb(var(--color-accent-strong) / <alpha-value>)',
      'accent-fill': 'rgb(var(--color-accent-fill) / <alpha-value>)',
      'accent-muted': 'rgb(var(--color-accent-muted) / <alpha-value>)',
      'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
      action: 'rgb(var(--color-action) / <alpha-value>)',
      'on-action': 'rgb(var(--color-on-action) / <alpha-value>)',
      success: 'rgb(var(--color-success) / <alpha-value>)',
      warning: 'rgb(var(--color-warning) / <alpha-value>)',
      danger: 'rgb(var(--color-danger) / <alpha-value>)',
      scrim: 'rgb(var(--color-scrim) / <alpha-value>)',
      'streak-0': 'rgb(var(--color-streak-0) / <alpha-value>)',
      'streak-1': 'rgb(var(--color-streak-1) / <alpha-value>)',
      'streak-2': 'rgb(var(--color-streak-2) / <alpha-value>)',
      'streak-3': 'rgb(var(--color-streak-3) / <alpha-value>)',
      'streak-4': 'rgb(var(--color-streak-4) / <alpha-value>)',
    },
    spacing: {
      px: '1px',
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px',
      14: '56px',
      16: '64px',
      18: '72px',
      20: '80px',
      24: '96px',
      32: '128px',
    },
    fontSize: {
      display: ['34px', '40px'],
      'title-lg': ['26px', '32px'],
      title: ['19px', '25px'],
      'body-lg': ['17px', '25px'],
      body: ['15px', '22px'],
      caption: ['13px', '18px'],
      label: ['13px', '16px'],
      quote: ['22px', '34px'],
      'num-lg': ['28px', '32px'],
      num: ['13px', '18px'],
    },
    fontFamily: {
      sans: 'IBMPlexSans_400Regular',
      'sans-medium': 'IBMPlexSans_500Medium',
      'sans-semibold': 'IBMPlexSans_600SemiBold',
      serif: 'Literata_400Regular',
      'serif-italic': 'Literata_400Regular_Italic',
      mono: 'IBMPlexMono_500Medium',
    },
    // Waga jest częścią rodziny — patrz komentarz na górze pliku.
    fontWeight: {},
    letterSpacing: {
      display: '-0.5px',
      'title-lg': '-0.3px',
      title: '-0.1px',
      normal: '0px',
      label: '0.2px',
    },
    // Skala promieni. Parzystości z src/theme/radii.ts pilnuje
    // src/theme/__tests__/radii.test.ts — nie edytuj jednego bez drugiego.
    borderRadius: {
      none: '0px',
      xs: '8px',
      sm: '12px',
      md: '18px',
      lg: '28px',
      xl: '36px',
      full: '9999px',
    },
    extend: {
      // Dzięki temu `text-primary` / `text-secondary` to kolory tekstu,
      // a nie `text-text-primary`. Pozostałe kolory nadal działają z `text-*`.
      textColor: {
        primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
      },
      // Domyślne min-h/min-w w Tailwindzie nie korzystają ze skali odstępów,
      // a 48dp to minimalny cel dotykowy z reguł użyteczności.
      minHeight: {
        12: '48px',
        14: '56px',
      },
      minWidth: {
        12: '48px',
      },
      // Stan wciśnięcia z reguł dostępności: opacity 0.9 + scale 0.98.
      scale: {
        98: '0.98',
      },
      // Sufit wysokości bottom sheeta — pojedyncza wartość systemowa zamiast
      // arbitralnego max-h-[520px] rozsianego po komponentach.
      maxHeight: {
        sheet: '520px',
      },
    },
  },
  plugins: [],
};
