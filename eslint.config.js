const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/**
 * Reguła krytyczna z CLAUDE.md: importy przez alias @/, bez wspinania się
 * po katalogach. Wyjątek: root layout importuje ../global.css.
 *
 * Trzymana osobno, bo `no-restricted-imports` konfiguruje się w całości —
 * dopisanie zakazu importu <Text> w nadpisaniu skasowałoby ten wzorzec.
 */
const RELATIVE_IMPORT_PATTERNS = [
  {
    group: ['../../*'],
    message: 'Użyj aliasu @/ zamiast ścieżek względnych w górę.',
  },
];

/**
 * Strażnicy systemu designu.
 *
 * Bez nich system rozjeżdża się w kilka tygodni: pierwszy hex „tylko na chwilę",
 * pierwsze `text-sm`, pierwszy <Text> prosto z react-native — i po miesiącu
 * połowa ekranów żyje własnym życiem. Te reguły są tańsze niż code review.
 */
const DESIGN_SYSTEM_SYNTAX = [
  {
    // Dopasowuje wyłącznie pełne kolory (#RGB, #RRGGBB, #RRGGBBAA), więc
    // '#access_token' czy '#' w linku nie wywołują fałszywego alarmu.
    selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message:
      'Zakaz wartości koloru wprost. Użyj tokenu semantycznego: klasy (bg-surface) albo color() z @/theme.',
  },
  {
    selector: 'Literal[value=/-\\[#/]',
    message:
      'Zakaz arbitralnego koloru w klasie (np. bg-[#123456]). Token semantyczny albo nowy token w global.css.',
  },
  {
    selector:
      'Literal[value=/(?:^|\\s)(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(?:\\/\\d+)?(?:\\s|$)/]',
    message:
      'Domyślna paleta Tailwinda nie istnieje w tym projekcie. Użyj tokenu semantycznego.',
  },
  {
    selector: "Property[key.name='textTransform'][value.value='uppercase']",
    message:
      'Zakaz wersalików: polskie słowa są długie, a diakrytyka w wersalikach czyta się źle.',
  },
  {
    selector: 'Literal[value=/(?:^|\\s)uppercase(?:\\s|$)/]',
    message:
      'Zakaz wersalików: polskie słowa są długie, a diakrytyka w wersalikach czyta się źle.',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
      // Artefakty runtime'u Supabase CLI — nie nasz kod.
      'supabase/.temp/**',
      // Kod Deno — inne globalne API, sprawdzany przez 'supabase functions serve'.
      'supabase/functions/**',
      'supabase/.branches/**',
    ],
  },
  {
    // Skrypty deweloperskie z scripts/ — zwykły Node, nie React Native.
    // Nie są objęte tsconfigiem (to .mjs), więc globalne API deklarujemy tutaj.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Reguła krytyczna z CLAUDE.md: zero `any`, zero obchodzenia typów.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      'no-restricted-imports': ['error', { patterns: RELATIVE_IMPORT_PATTERNS }],
    },
  },
  {
    // Warstwa produktu: ekrany, feature'y i współdzielone UI.
    // src/theme/** jest celowo poza zakresem — to tam mieszkają wartości.
    files: [
      'app/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
    ],
    ignores: [
      // Jedyne dwa pliki, które z definicji sięgają po prymitywy:
      // opakowanie <Text> i ekran awaryjny działający bez kontekstu aplikacji.
      'src/components/ui/text.tsx',
      'src/components/route-error-boundary.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: RELATIVE_IMPORT_PATTERNS,
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message:
                'Użyj <Text> z @/components/ui — tylko on zna skalę typografii, tokeny i skalowanie fontu.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...DESIGN_SYSTEM_SYNTAX],
    },
  },
]);
