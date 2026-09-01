import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { streakLevels, type StreakLevel } from '@/theme/palette';
import { CONTINUOUS_CURVE } from '@/theme/radii';

/**
 * Mapa dni — sygnatura aplikacji.
 *
 * Jedyny element, który dostaje pełne nasycenie akcentu. Wszystko wokół niej
 * ma być ciche, więc nie dokładaj tu podpisów, ikon ani drugiego koloru.
 *
 * Dzień pominięty ma poziom 0, czyli wygląda tak samo jak dzień bez danych —
 * nie karzemy wizualnie. Dzień dzisiejszy, jeszcze niedomknięty, dostaje obrys
 * zamiast wypełnienia.
 */
const LEVEL_CLASS: Record<StreakLevel, string> = {
  0: 'bg-streak-0',
  1: 'bg-streak-1',
  2: 'bg-streak-2',
  3: 'bg-streak-3',
  4: 'bg-streak-4',
};

export type StreakGridCell = {
  /** Klucz React i identyfikator dnia. */
  key: string;
  /** `null` = brak danych; renderuje się jak poziom 0. */
  level: StreakLevel | null;
  /** Dzisiaj, jeszcze niedomknięty. */
  pending?: boolean;
  /**
   * Gotowa etykieta dostępności. Wymagana: kolor nie może być jedynym
   * nośnikiem informacji.
   */
  accessibilityLabel: string;
};

export type StreakGridProps = {
  /** Kolumna = tydzień, wiersz = dzień tygodnia. */
  weeks: readonly (readonly StreakGridCell[])[];
  /** Długie przytrzymanie na dniu. Dostaje `key` komórki. */
  onLongPressDay?: (key: string) => void;
  /** Gotowa podpowiedź dostępności dla długiego przytrzymania. */
  longPressHint?: string;
  /** Podpisy wierszy, po jednym na dzień tygodnia. Pusty string = bez podpisu. */
  rowLabels?: readonly string[];
  /** Gotowe etykiety legendy. */
  legend?: { less: string; more: string };
  className?: string;
};

function Cell({
  cell,
  onLongPress,
  hint,
}: {
  cell: StreakGridCell;
  onLongPress?: () => void;
  hint?: string;
}) {
  const className = cn(
    'size-4 rounded-xs',
    cell.pending === true ? 'border border-border-strong' : LEVEL_CLASS[cell.level ?? 0],
  );

  if (onLongPress === undefined) {
    return (
      <View
        accessible
        accessibilityLabel={cell.accessibilityLabel}
        style={CONTINUOUS_CURVE}
        className={className}
      />
    );
  }

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={cell.accessibilityLabel}
      accessibilityHint={hint}
      // Komórka ma 16 dp, bo taka jest mapa dni. Cel dotykowy dobija do
      // wymaganych 48 dp hitSlop — sąsiedzi zachodzą na siebie i tak ma być:
      // przy tej gęstości nie da się inaczej trafić palcem w konkretny dzień.
      hitSlop={16}
      onLongPress={onLongPress}
      style={CONTINUOUS_CURVE}
      className={className}
    />
  );
}

export function StreakGrid({
  weeks,
  rowLabels,
  legend,
  onLongPressDay,
  longPressHint,
  className,
}: StreakGridProps) {
  const rowCount = weeks[0]?.length ?? 0;

  return (
    <View className={cn('gap-3', className)}>
      <View className="flex-row gap-2">
        {rowLabels === undefined ? null : (
          <View className="gap-1">
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <View key={rowIndex} className="h-4 justify-center">
                <Text variant="num" tone="tertiary">
                  {rowLabels[rowIndex] ?? ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="flex-1 flex-row justify-between">
          {weeks.map((week, weekIndex) => (
            <View key={week[0]?.key ?? weekIndex} className="gap-1">
              {week.map((cell) => (
                <Cell
                  key={cell.key}
                  cell={cell}
                  hint={longPressHint}
                  onLongPress={
                    onLongPressDay === undefined
                      ? undefined
                      : () => {
                          onLongPressDay(cell.key);
                        }
                  }
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {legend === undefined ? null : (
        <View
          className="flex-row items-center justify-end gap-1"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text variant="caption" tone="tertiary" className="mr-1">
            {legend.less}
          </Text>
          {streakLevels.map((level) => (
            <View
              key={level}
              style={CONTINUOUS_CURVE}
              className={cn('size-3 rounded-xs', LEVEL_CLASS[level])}
            />
          ))}
          <Text variant="caption" tone="tertiary" className="ml-1">
            {legend.more}
          </Text>
        </View>
      )}
    </View>
  );
}
