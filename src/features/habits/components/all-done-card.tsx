import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

export type AllDoneCardProps = {
  /**
   * Dodatkowa treść pod opisem — miejsce na linię o dniu.
   *
   * Slot zamiast bezpośredniego importu: feature nawyków nie zna dziennika,
   * a ekran „Dziś" zna oba.
   */
  footer?: ReactNode;
};

/**
 * Stan „dzień domknięty". Spokojny — bez konfetti i bez animacji.
 *
 * To jedyna karta na tym ekranie z tłem akcentu, bo niesie informację
 * o pełnym wykonaniu. Nasycenie zostaje przygaszone (`accent-muted`),
 * pełne ma tylko mapa dni.
 */
export function AllDoneCard({ footer }: AllDoneCardProps) {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <Card variant="outlined" className="gap-4 border-accent/30 bg-accent-muted">
      <View className="flex-row items-start gap-3">
        <Ionicons name="checkmark-done" size={20} color={color('accent')} />
        <View className="flex-1 gap-1">
          <Text variant="title" tone="accent">
            {t('today.allDone.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('today.allDone.description')}
          </Text>
        </View>
      </View>

      {footer}
    </Card>
  );
}
