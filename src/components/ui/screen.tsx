import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

export type ScreenEdge = 'top' | 'bottom' | 'left' | 'right';

export type ScreenProps = {
  children: ReactNode;
  /** Zawartość dłuższa niż ekran. */
  scroll?: boolean;
  /** Które krawędzie mają respektować safe areę. */
  edges?: readonly ScreenEdge[];
  /** Klasy kontenera na całą wysokość ekranu. */
  className?: string;
  /** Klasy warstwy z zawartością (padding, gap, wyrównanie). */
  contentClassName?: string;
  /** Pull-to-refresh. Działa tylko razem z propem `scroll`. */
  refreshControl?: ReactElement<RefreshControlProps>;
};

/**
 * Korzeń każdego ekranu: tło z tokenu, safe area, margines poziomy 20
 * i odstęp 12 między kartami — te trzy wartości są takie same wszędzie
 * i nie ustawia się ich lokalnie.
 *
 * Insety liczymy ręcznie zamiast <SafeAreaView>, bo NativeWind nie stylują
 * komponentów spoza react-native — className na obcym komponencie zostałby
 * po cichu zignorowany.
 */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  className,
  contentClassName,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const safeArea = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View className={cn('flex-1 bg-background', className)} style={safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerClassName={cn('grow gap-3 px-5 py-5', contentClassName)}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1 gap-3 px-5 py-5', contentClassName)}>{children}</View>
      )}
    </View>
  );
}
