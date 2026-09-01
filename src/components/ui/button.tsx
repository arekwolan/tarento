import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { usePressClass } from '@/components/ui/press';
import { useControlRadius } from '@/components/ui/surface-radius';
import { Text, type TextTone } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { ColorToken } from '@/theme/palette';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

/**
 * Przycisk główny nie jest kolorowy — jest maksymalnym kontrastem. Akcent
 * (mosiądz) zostaje zarezerwowany dla stanu wykonania i postępu, więc nie
 * pojawia się tutaj w żadnym wariancie.
 *
 * `destructive` to osobny wariant, nie modyfikator: czerwień istnieje wyłącznie
 * przy akcjach niszczących i nie łączy się z hierarchią pozostałych trzech.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

const containerClass: Record<ButtonVariant, string> = {
  primary: 'border border-action bg-action',
  secondary: 'border border-border-strong bg-surface',
  ghost: 'border border-transparent bg-transparent',
  destructive: 'border border-danger bg-transparent',
};

const labelTone: Record<ButtonVariant, TextTone> = {
  primary: 'on-action',
  secondary: 'primary',
  ghost: 'secondary',
  destructive: 'danger',
};

const spinnerToken: Record<ButtonVariant, ColorToken> = {
  primary: 'on-action',
  secondary: 'text-primary',
  ghost: 'text-secondary',
  destructive: 'danger',
};

/** Oba rozmiary spełniają minimalny cel dotykowy 48dp. */
const sizeClass: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 py-3',
  lg: 'min-h-14 px-6 py-4',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Gotowy tekst — przekazuj wynik t(), nigdy literał. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  ...rest
}: ButtonProps) {
  const { color } = useTheme();
  const pressClass = usePressClass();
  // Promień nie należy do przycisku, tylko do płaszczyzny, w której stoi:
  // sam na ekranie jest `md`, w karcie schodzi do promienia koncentrycznego.
  const borderRadius = useControlRadius('md');
  const isInactive = disabled || loading;
  // Klasy `active:` muszą być na przycisku od pierwszego renderu, a przygaszenie
  // nieaktywnego stanu idzie stylem — nie klasą. Dołożenie pseudoklasy po
  // pierwszym renderze każe css-interopowi "upgrade'ować" komponent, a jego
  // ostrzeżenie serializuje propsy razem z `_owner` elementów Reacta. Spacer po
  // fiberach dochodzi do domyślnego NavigationStateContext, którego gettery rzucają
  // "Couldn't find a navigation context" — błąd wygląda wtedy na błąd nawigacji.
  const inactiveStyle = isInactive ? { opacity: 0.5 } : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      style={[CONTINUOUS_CURVE, { borderRadius }, inactiveStyle]}
      className={cn(
        'flex-row items-center justify-center gap-2',
        containerClass[variant],
        sizeClass[size],
        pressClass,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ActivityIndicator size="small" color={color(spinnerToken[variant])} />
        </View>
      ) : null}
      <Text variant="label" tone={labelTone[variant]} className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}
