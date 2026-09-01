import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { SurfaceRadiusProvider } from '@/components/ui/surface-radius';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/elevation';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

/**
 * Wcięcie zawartości arkusza od jego krawędzi. Odpowiada klasie `px-5` niżej
 * i wchodzi do rachunku promienia koncentrycznego dla kontrolek w środku.
 */
const SHEET_INSET = 20;

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Gotowy tytuł — przekazuj wynik t(), nigdy literał. Pomiń dla arkusza bez nagłówka. */
  title?: string;
  /** Gotowa etykieta dostępności zamknięcia (dotknięcie tła). */
  closeLabel: string;
  children: ReactNode;
  contentClassName?: string;
};

/**
 * Bottom sheet — domyślna forma dla akcji na jednym–dwóch polach.
 * Pełnoekranowy modal zostaje dla przepływów wieloetapowych.
 *
 * Przy włączonej redukcji ruchu arkusz pojawia się przez zmianę krycia,
 * bez wjeżdżania od dołu.
 */
export function Sheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
  contentClassName,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        className="flex-1 justify-end bg-scrim/50"
        onPress={onClose}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Zatrzymuje dotknięcia, żeby stuknięcie w arkusz go nie zamykało. */}
          <Pressable
            accessible={false}
            onPress={(event) => {
              event.stopPropagation();
            }}
            className="rounded-t-lg border-t border-border bg-surface-elevated"
            style={[
              CONTINUOUS_CURVE,
              elevation(scheme, 'sheet'),
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-border-strong" />
            </View>

            <SurfaceRadiusProvider radius="lg" inset={SHEET_INSET}>
              <ScrollView
                className="max-h-sheet"
                contentContainerClassName={cn('gap-4 px-5 pb-4', contentClassName)}
                keyboardShouldPersistTaps="handled"
              >
                {title === undefined ? null : (
                  <Text variant="title" accessibilityRole="header">
                    {title}
                  </Text>
                )}
                {children}
              </ScrollView>
            </SurfaceRadiusProvider>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
