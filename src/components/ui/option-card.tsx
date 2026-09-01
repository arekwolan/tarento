import { Pressable, View, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePressClass } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

export type OptionCardProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Gotowe teksty — przekazuj wynik t(), nigdy literał. */
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
};

/**
 * Wybór z opisem: tryb progresji, obszar w onboardingu.
 * Opis jest częścią decyzji, więc nie chowamy go pod znakiem zapytania.
 *
 * Zaznaczenie niesie kontrast obrysu i znacznik, nie kolor.
 */
export function OptionCard({
  title,
  description,
  icon,
  selected = false,
  className,
  ...rest
}: OptionCardProps) {
  const { color } = useTheme();
  const pressClass = usePressClass();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={CONTINUOUS_CURVE}
      className={cn(
        'min-h-12 flex-row items-start gap-3 rounded-md border p-4',
        selected
          ? 'border-border-strong bg-surface-elevated'
          : 'border-hairline bg-surface',
        pressClass,
        className,
      )}
      {...rest}
    >
      {icon === undefined ? null : (
        <Ionicons
          name={icon}
          size={20}
          color={selected ? color('text-primary') : color('text-tertiary')}
        />
      )}

      <View className="flex-1 gap-1">
        <Text variant="bodyLg">{title}</Text>
        {description === undefined ? null : (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        )}
      </View>

      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={color('text-primary')} />
      ) : null}
    </Pressable>
  );
}
