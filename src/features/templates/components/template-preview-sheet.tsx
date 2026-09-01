import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Text } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { HabitTemplate } from '@/features/templates/model/template';
import type { TranslationKey } from '@/i18n/keys';

const CATEGORY_LABEL = {
  focus: 'categories.focus',
  mindfulness: 'categories.mindfulness',
  health: 'categories.health',
  learning: 'categories.learning',
  relationships: 'categories.relationships',
} as const satisfies Record<string, TranslationKey>;

export type TemplatePreviewSheetProps = {
  template: HabitTemplate | null;
  onClose: () => void;
  onAdd: (template: HabitTemplate) => void;
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="body" tone="secondary" className="flex-1">
        {label}
      </Text>
      <Text variant="num">{value}</Text>
    </View>
  );
}

/** Podgląd szablonu przed dodaniem. Pokazuje, co dokładnie trafi do formularza. */
export function TemplatePreviewSheet({
  template,
  onClose,
  onAdd,
}: TemplatePreviewSheetProps) {
  const { t } = useTranslation();

  if (template === null) return null;

  const unitKey = targetUnitKey(template.unit);
  const withUnit = (value: number) =>
    `${formatTargetValue(value)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={template.title}
      closeLabel={t('today.details.close')}
    >
      {template.description === null ? null : (
        <Text variant="body" tone="secondary">
          {template.description}
        </Text>
      )}

      <Divider />

      <View className="gap-3">
        <PreviewRow
          label={t('habits.form.startValueLabel')}
          value={withUnit(template.startValue)}
        />
        <PreviewRow
          label={t('habits.form.incrementLabel')}
          value={withUnit(template.incrementValue)}
        />
        {template.targetValue === null ? null : (
          <PreviewRow
            label={t('habits.form.targetLabel')}
            value={withUnit(template.targetValue)}
          />
        )}
        {template.category === null ? null : (
          <PreviewRow
            label={t('habits.form.categoryLabel')}
            value={t(CATEGORY_LABEL[template.category])}
          />
        )}
      </View>

      {template.sourceBook === null ? null : (
        <Text variant="caption" tone="tertiary">
          {t('library.template.source', { book: template.sourceBook })}
        </Text>
      )}

      <Button
        label={t('library.template.add')}
        size="lg"
        onPress={() => {
          onAdd(template);
        }}
      />
      <Button label={t('today.details.close')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
