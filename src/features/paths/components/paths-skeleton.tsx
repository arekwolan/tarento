import { View } from 'react-native';

import { Skeleton } from '@/components/ui';
import { CONTINUOUS_CURVE } from '@/theme/radii';

/** Tyle kart, ile mieści się na ekranie bez przewijania. */
const PLACEHOLDER_CARDS = 3;

/**
 * Szkielet w kształcie kart katalogu: tytuł, zdanie, dwie liczby.
 * Spinner nie mówi, co się pojawi — ten układ mówi.
 */
export function PathsSkeleton() {
  return (
    <View
      className="gap-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
        <View
          key={index}
          style={CONTINUOUS_CURVE}
          className="gap-2 rounded-md border border-border p-4"
        >
          <Skeleton className="w-40 h-6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-32" />
        </View>
      ))}
    </View>
  );
}
