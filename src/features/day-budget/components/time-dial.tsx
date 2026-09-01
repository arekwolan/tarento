import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Text, usePressClass } from '@/components/ui';
import { stepTime } from '@/features/day-budget/model/day-shape';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

export type TimeDialProps = {
  /** Gotowe teksty — przekazuj wynik t(), nigdy literał. */
  label: string;
  earlierLabel: string;
  laterLabel: string;
  /** Godzina w zapisie 'HH:MM'. */
  value: string;
  onChange: (next: string) => void;
};

/**
 * Pokrętło godziny: dwa przyciski i wartość, bez pola tekstowego.
 *
 * Klawiatura na tym ekranie nie ma prawa się pojawić — cel to trzy pytania
 * poniżej 90 sekund, a wywołanie klawiatury numerycznej kosztuje więcej niż
 * kilka stuknięć w krok.
 */
export function TimeDial({
  label,
  earlierLabel,
  laterLabel,
  value,
  onChange,
}: TimeDialProps) {
  const { color } = useTheme();
  const pressClass = usePressClass();

  const step = (steps: number) => {
    void Haptics.selectionAsync();
    onChange(stepTime(value, steps));
  };

  return (
    <View className="flex-1 gap-2">
      <Text variant="label" tone="secondary">
        {label}
      </Text>

      <View
        style={CONTINUOUS_CURVE}
        className="flex-row items-center justify-between rounded-sm border border-border bg-surface px-1 py-1"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${earlierLabel}`}
          onPress={() => {
            step(-1);
          }}
          className={cn('size-12 items-center justify-center rounded-full', pressClass)}
        >
          <Ionicons name="remove" size={20} color={color('text-primary')} />
        </Pressable>

        <Text variant="numLg" accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${laterLabel}`}
          onPress={() => {
            step(1);
          }}
          className={cn('size-12 items-center justify-center rounded-full', pressClass)}
        >
          <Ionicons name="add" size={20} color={color('text-primary')} />
        </Pressable>
      </View>
    </View>
  );
}
