import { View, type ViewProps } from 'react-native';

import { SurfaceRadiusProvider } from '@/components/ui/surface-radius';
import { cn } from '@/lib/cn';
import { edgeHighlight, elevation, type ElevationLevel } from '@/theme/elevation';
import { CONTINUOUS_CURVE, type Radius } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

/**
 * Wcięcie zawartości od krawędzi karty. Odpowiada klasie `p-4` niżej i wchodzi
 * do rachunku promienia koncentrycznego dla kontrolek w środku — dlatego karta
 * z nadpisanym paddingiem przestaje być koncentryczna i nie należy tego robić.
 */
const CARD_INSET = 16;

/**
 * Warianty karty.
 *
 * `default` i `raised` różnią się głębią, nie kreską: płaszczyzną, świetlną
 * krawędzią i cieniem. `outlined` jako jedyny ma obrys i ma go dostać wyłącznie
 * karta, w której obrys coś znaczy — niesie stan zaznaczenia albo kolor, jak
 * przy domkniętym dniu. To ma być decyzja, a nie domyślka.
 */
export type CardVariant = 'default' | 'raised' | 'outlined';

const SURFACE: Record<CardVariant, string> = {
  default: 'rounded-md bg-surface',
  raised: 'rounded-lg bg-surface-elevated',
  outlined: 'rounded-md border border-border bg-surface',
};

const RADIUS: Record<CardVariant, Radius> = {
  default: 'md',
  raised: 'lg',
  outlined: 'md',
};

const DEPTH: Record<CardVariant, ElevationLevel | null> = {
  default: 'card',
  raised: 'raised',
  // Obrys robi tu całą robotę. Cień pod nim byłby drugą odpowiedzią na to samo
  // pytanie, a karta wyboru ma być płaska — unosi ją zaznaczenie, nie kształt.
  outlined: null,
};

export type CardProps = ViewProps & {
  variant?: CardVariant;
};

export function Card({ variant = 'default', className, style, ...rest }: CardProps) {
  const { scheme } = useTheme();
  const depth = DEPTH[variant];

  return (
    <SurfaceRadiusProvider radius={RADIUS[variant]} inset={CARD_INSET}>
      <View
        className={cn('p-4', SURFACE[variant], className)}
        style={[
          CONTINUOUS_CURVE,
          depth === null ? null : elevation(scheme, depth),
          depth === null ? null : edgeHighlight(scheme, depth),
          style,
        ]}
        {...rest}
      />
    </SurfaceRadiusProvider>
  );
}
