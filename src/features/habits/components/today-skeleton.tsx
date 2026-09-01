import { View } from 'react-native';

import { Skeleton } from '@/components/ui';

/** Ile wierszy udaje ładowanie. Tyle, ile mieści się bez przewijania. */
const PLACEHOLDER_ROWS = [3, 2];

/**
 * Szkielet w kształcie docelowej listy: cytat, pasek postępu, sekcje z zadaniami.
 * Spinner nic nie mówi o tym, co się pojawi — ten układ mówi.
 */
export function TodaySkeleton() {
  return (
    <View
      className="gap-8"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full rounded-md" />
      </View>

      <View className="gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-1 w-full" />
      </View>

      {PLACEHOLDER_ROWS.map((rows, groupIndex) => (
        <View key={groupIndex} className="gap-2">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: rows }, (_, rowIndex) => (
            <Skeleton key={rowIndex} className="h-14 w-full rounded-md" />
          ))}
        </View>
      ))}
    </View>
  );
}
