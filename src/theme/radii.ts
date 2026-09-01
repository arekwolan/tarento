import type { ViewStyle } from 'react-native';

/**
 * Promienie zaokrągleń.
 *
 * Wartości liczbowe dla propsów stylu (np. maski Reanimated) i dla
 * `concentricRadius()`. W komponentach używaj klas: rounded-md, rounded-lg.
 *
 * Skala żyje w dwóch miejscach — tutaj i w tailwind.config.js. Parzystości
 * pilnuje src/theme/__tests__/radii.test.ts.
 */
export const radii = {
  /** Komórka mapy dni, szkielet, drobny znacznik. */
  xs: 8,
  /** Pola formularza, chipy. */
  sm: 12,
  /** Przycisk, domyślna karta, toast. */
  md: 18,
  /** Bottom sheet, karta uniesiona. */
  lg: 28,
  /** Płaszczyzny pełnoekranowe i pływające. */
  xl: 36,
  full: 9999,
} as const;

export type Radius = keyof typeof radii;

/**
 * Krzywizna ciągła (superelipsa) zamiast łuku koła.
 *
 * `borderCurve` jest propsem iOS-owym. Na Androidzie nie robi nic i róg
 * zostaje wycinkiem koła — nie udajemy, że działa wszędzie. Różnica jest
 * subtelna przy 8 dp i wyraźna przy 28 dp, więc największy zysk daje ją na
 * arkuszu i na kartach.
 *
 * Stała, nie funkcja: obiekt jest niezmienny, więc można go bezpiecznie
 * wkładać do tablicy stylów bez tworzenia nowej referencji przy renderze.
 *
 * Typ jest zawężony do jednej właściwości, a nie do całego `ViewStyle`, bo
 * pełny `ViewStyle` nie wchodzi w `style` TextInputa (`TextStyle` zawęża
 * `userSelect`). `Pick` pasuje do obu i przy okazji mówi wprost, co ta stała
 * zawiera.
 */
export const CONTINUOUS_CURVE: Pick<ViewStyle, 'borderCurve'> = {
  borderCurve: 'continuous',
};

/**
 * Promień elementu wstawionego w inny element z promieniem.
 *
 * Zasada koncentryczności: żeby odstęp między dwiema krzywymi był stały,
 * promień wewnętrzny musi być mniejszy od zewnętrznego dokładnie o wielkość
 * wcięcia. Bez tego róg wewnętrzny „odkleja się" od zewnętrznego i widać, że
 * dwa kształty nie należą do siebie.
 *
 * Podłoga na `xs` jest świadomym odstępstwem od czystej geometrii: karta
 * o promieniu 18 z paddingiem 16 dałaby wewnątrz 2 dp, a taki róg czyta się
 * jak usterka, nie jak decyzja. Poniżej 8 dp przestajemy być koncentryczni
 * i mówimy to wprost tutaj, zamiast poprawiać na oko w komponentach.
 */
export function concentricRadius(outer: Radius, inset: number): number {
  return Math.max(radii.xs, radii[outer] - Math.max(0, inset));
}
