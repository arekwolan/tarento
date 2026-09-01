import { View } from 'react-native';

import { Text, type TextTone } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';

/**
 * `info` obsługuje też stan offline: dyskretny pasek, który informuje
 * i nie blokuje ekranu. Czerwień zostaje dla `danger`.
 */
export type BannerTone = 'danger' | 'success' | 'info';

const containerClass: Record<BannerTone, string> = {
  danger: 'border-danger/40 bg-danger/10',
  success: 'border-success/40 bg-success/10',
  info: 'border-border bg-surface-sunken',
};

const textTone: Record<BannerTone, TextTone> = {
  danger: 'danger',
  success: 'success',
  info: 'secondary',
};

export type BannerProps = {
  tone?: BannerTone;
  /** Gotowy tekst — przekazuj wynik t(), nigdy literał. */
  message: string;
  className?: string;
};

/** Komunikat na poziomie ekranu lub formularza: brak sieci, błąd, potwierdzenie. */
export function Banner({ tone = 'info', message, className }: BannerProps) {
  return (
    <View
      accessibilityRole="alert"
      style={CONTINUOUS_CURVE}
      className={cn('rounded-sm border px-4 py-3', containerClass[tone], className)}
    >
      <Text variant="caption" tone={textTone[tone]}>
        {message}
      </Text>
    </View>
  );
}
