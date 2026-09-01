import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Text, usePressClass } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { HabitTemplate } from '@/features/templates/model/template';
import { cn } from '@/lib/cn';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

export type TemplateCardProps = {
  template: HabitTemplate;
  onPress: (template: HabitTemplate) => void;
};

/** Kafelek katalogu. Tytuł, punkt startowy i skąd pomysł. */
export function TemplateCard({ template, onPress }: TemplateCardProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const pressClass = usePressClass();

  const unitKey = targetUnitKey(template.unit);
  const startLabel =
    template.unit === 'none'
      ? null
      : `${formatTargetValue(template.startValue)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={template.title}
      onPress={() => {
        onPress(template);
      }}
      // Dwie kolumny z odstępem 12 — połowa minus pół odstępu.
      style={[CONTINUOUS_CURVE, { width: '48%' }]}
      className={cn(
        'min-h-12 gap-2 rounded-md border border-border bg-surface p-4',
        pressClass,
      )}
    >
      <Ionicons
        name={(template.icon ?? 'leaf-outline') as keyof typeof Ionicons.glyphMap}
        size={20}
        color={color('text-tertiary')}
      />
      <Text variant="bodyLg" numberOfLines={2}>
        {template.title}
      </Text>
      {startLabel === null ? null : (
        <Text variant="num" tone="tertiary">
          {startLabel}
        </Text>
      )}
      {template.sourceBook === null ? null : (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {template.sourceBook}
        </Text>
      )}
    </Pressable>
  );
}
