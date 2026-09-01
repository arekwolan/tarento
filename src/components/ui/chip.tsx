import { Pressable, type PressableProps } from 'react-native';

import { usePressClass } from '@/components/ui/press';
import { useControlRadius } from '@/components/ui/surface-radius';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Gotowy tekst — przekazuj wynik t(), nigdy literał. */
  label: string;
  selected?: boolean;
};

/**
 * Mały przełącznik do filtrów i zakładek.
 *
 * Zaznaczenie niesie kontrast, nie kolor — akcent zostaje zarezerwowany
 * dla postępu.
 *
 * Prostokąt zaokrąglony, nie pigułka: `rounded-full` zostaje wyłącznie dla
 * znaczników i pasków, w których pełne zaokrąglenie jest samym kształtem.
 */
export function Chip({ label, selected = false, className, ...rest }: ChipProps) {
  const pressClass = usePressClass();
  const borderRadius = useControlRadius('sm');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[CONTINUOUS_CURVE, { borderRadius }]}
      className={cn(
        'min-h-12 justify-center border px-4',
        selected ? 'border-action bg-action' : 'border-hairline bg-surface',
        pressClass,
        className,
      )}
      {...rest}
    >
      <Text variant="label" tone={selected ? 'on-action' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
