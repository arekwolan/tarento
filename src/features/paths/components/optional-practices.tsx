import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card, Text, usePressClass } from '@/components/ui';
import type { PathPractice } from '@/features/paths/model/schemas';
import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/theme-provider';

export type OptionalPracticesProps = {
  /** Wyłącznie praktyki oznaczone jako wyłączalne. */
  practices: readonly PathPractice[];
  /** Identyfikatory praktyk już odznaczonych. */
  skipped: readonly string[];
  onToggle: (practiceId: string) => void;
};

/**
 * Praktyki, które można zdjąć jeszcze przed startem.
 *
 * Jeden gest, bez tłumaczenia się i bez pytania „na pewno" — jeśli ścieżka
 * oznaczyła praktykę jako wyłączalną, to znaczy, że użytkownik ma prawo jej
 * nie chcieć z powodów, o które aplikacja nie ma prawa pytać.
 *
 * Zaznaczenie niesie kontrast i znacznik, nie kolor: to nie jest postęp.
 */
export function OptionalPractices({
  practices,
  skipped,
  onToggle,
}: OptionalPracticesProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const pressClass = usePressClass();

  if (practices.length === 0) return null;

  return (
    <Card className="gap-3">
      <Text variant="label" tone="secondary">
        {t('path.enroll.optional')}
      </Text>

      {practices.map((practice) => {
        const isIncluded = !skipped.includes(practice.id);

        return (
          <Pressable
            key={practice.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isIncluded }}
            accessibilityLabel={practice.title}
            onPress={() => {
              onToggle(practice.id);
            }}
            className={cn(
              'min-h-12 flex-row items-start gap-3 rounded-sm py-2',
              pressClass,
            )}
          >
            <Ionicons
              name={isIncluded ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={isIncluded ? color('text-primary') : color('text-tertiary')}
            />
            <View className="flex-1 gap-1">
              <Text variant="bodyLg" tone={isIncluded ? 'primary' : 'tertiary'}>
                {practice.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {isIncluded ? practice.why : t('path.enroll.optionalSkipped')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
