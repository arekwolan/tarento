import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { DayStrip } from '@/features/day-budget/components/day-strip';
import {
  axisTimeLabel,
  MIN_BLOCK_MINUTES,
  STEP_MINUTES,
  type DayAxis,
  type DayShapeBlockDraft,
} from '@/features/day-budget/model/day-shape';

export type BusyBlocksStepProps = {
  axis: DayAxis;
  blocks: readonly DayShapeBlockDraft[];
  canAddBlock: boolean;
  onChangeBlock: (id: string, start: number, end: number) => void;
  onAddBlock: () => void;
  onRemoveBlock: (id: string) => void;
};

/**
 * Krok 2: zajęte pasy doby.
 *
 * Każdy pas dostaje własny wiersz, nie własne miejsce na wspólnym pasku —
 * dwa bloki na jednej osi zaczynają na siebie nachodzić, zanim użytkownik
 * skończy je ustawiać.
 */
export function BusyBlocksStep({
  axis,
  blocks,
  canAddBlock,
  onChangeBlock,
  onAddBlock,
  onRemoveBlock,
}: BusyBlocksStepProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.dayShape.step2.title')}
      </Text>

      {blocks.map((block, index) => {
        const startLabel = axisTimeLabel(block.start);
        const endLabel = axisTimeLabel(block.end);

        return (
          <View key={block.id} className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="num" tone="secondary">
                {t('onboarding.dayShape.step2.range', {
                  start: startLabel,
                  end: endLabel,
                })}
              </Text>

              {index === 0 ? null : (
                <Button
                  variant="ghost"
                  label={t('onboarding.dayShape.step2.remove')}
                  onPress={() => {
                    onRemoveBlock(block.id);
                  }}
                />
              )}
            </View>

            <DayStrip
              axis={axis}
              start={block.start}
              end={block.end}
              step={STEP_MINUTES}
              minLength={MIN_BLOCK_MINUTES}
              startLabel={t('onboarding.dayShape.step2.blockStart')}
              endLabel={t('onboarding.dayShape.step2.blockEnd')}
              startValueLabel={startLabel}
              endValueLabel={endLabel}
              onChange={(start, end) => {
                onChangeBlock(block.id, start, end);
              }}
            />
          </View>
        );
      })}

      <Text variant="caption" tone="tertiary">
        {t('onboarding.dayShape.step2.hint')}
      </Text>

      <Button
        variant="ghost"
        label={t('onboarding.dayShape.step2.add')}
        disabled={!canAddBlock}
        onPress={onAddBlock}
      />
    </View>
  );
}
