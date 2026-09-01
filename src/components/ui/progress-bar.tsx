import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';

export type ProgressBarProps = {
  /** Wartość 0–1. Spoza zakresu jest przycinana. */
  value: number;
  /** Gotowy opis dla czytnika ekranu. */
  accessibilityLabel: string;
  className?: string;
};

/**
 * Cienki pasek postępu.
 *
 * Wypełnienie idzie akcentem, bo to jedno z dwóch miejsc niosących informację
 * o postępie (drugim jest mapa dni). Tor zostaje neutralny.
 */
export function ProgressBar({ value, accessibilityLabel, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={CONTINUOUS_CURVE}
      className={cn(
        'h-1 w-full overflow-hidden rounded-full bg-surface-sunken',
        className,
      )}
    >
      <View
        className="h-full rounded-full bg-accent-fill"
        style={[CONTINUOUS_CURVE, { width: `${clamped * 100}%` }]}
      />
    </View>
  );
}
