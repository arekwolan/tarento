import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Text, TextField } from '@/components/ui';
import type { PlanItem } from '@/features/ai-plan/model/plan';
import { targetUnitKey } from '@/features/habits/model/grouping';
import { parseDecimal } from '@/features/habits/model/habit-form';

export type PlanItemEditorProps = {
  item: PlanItem;
  onChange: (item: PlanItem) => void;
  onRemove: () => void;
};

/**
 * Jedna pozycja propozycji, w całości edytowalna.
 *
 * Model podaje punkt wyjścia; użytkownik ma ostatnie słowo przy każdej
 * liczbie, bo to on wie, ile naprawdę da radę zrobić pierwszego dnia.
 */
export function PlanItemEditor({ item, onChange, onRemove }: PlanItemEditorProps) {
  const { t } = useTranslation();
  const unitKey = targetUnitKey(item.unit);
  const unitLabel = unitKey === null ? '' : t(unitKey);

  /** Puste pole zostawia poprzednią liczbę, żeby kasowanie cyfry nie zerowało celu. */
  const withNumber = (key: 'start_value' | 'increment_value', text: string) => {
    const parsed = parseDecimal(text);
    onChange({ ...item, [key]: parsed === null ? 0 : Math.max(0, parsed) });
  };

  return (
    <Card className="gap-4">
      <TextField
        label={t('aiPlan.item.titleLabel')}
        value={item.title}
        onChangeText={(title) => {
          onChange({ ...item, title });
        }}
      />

      {item.rationale === '' ? null : (
        <Text variant="caption" tone="tertiary">
          {item.rationale}
        </Text>
      )}

      <View className="flex-row gap-3">
        <TextField
          containerClassName="flex-1"
          label={`${t('aiPlan.item.startLabel')} ${unitLabel}`.trim()}
          value={String(item.start_value)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          onChangeText={(text) => {
            withNumber('start_value', text);
          }}
        />
        <TextField
          containerClassName="flex-1"
          label={`${t('aiPlan.item.incrementLabel')} ${unitLabel}`.trim()}
          value={String(item.increment_value)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          onChangeText={(text) => {
            withNumber('increment_value', text);
          }}
        />
      </View>

      <TextField
        label={`${t('aiPlan.item.targetLabel')} ${unitLabel}`.trim()}
        value={item.target_value === undefined ? '' : String(item.target_value)}
        keyboardType="decimal-pad"
        inputMode="decimal"
        onChangeText={(text) => {
          const parsed = parseDecimal(text);
          onChange({
            ...item,
            target_value: parsed === null || parsed <= 0 ? undefined : parsed,
          });
        }}
      />

      <Button label={t('aiPlan.item.remove')} variant="destructive" onPress={onRemove} />
    </Card>
  );
}
