import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Text } from '@/components/ui';
import type { StageTransition } from '@/features/paths/api/use-stage-advance';

export type StageAdvanceSheetProps = {
  transition: StageTransition | null;
  /**
   * Domknięcie przejścia. Podpięte i pod „Zaczynam", i pod zamknięcie
   * arkusza: etap przechodzi tak samo, bo to informacja, a nie prośba o zgodę.
   */
  onConfirm: () => void;
  isPending: boolean;
};

/**
 * Podsumowanie przejścia etapu.
 *
 * Nagłówek zależy od powodu: przy suficie mówi wprost, że poprzedni etap nie
 * domknął się w całości i że to nic nie zmienia. Nie ma tu słowa
 * „gratulacje", „poziom" ani „odblokowałeś".
 */
export function StageAdvanceSheet({
  transition,
  onConfirm,
  isPending,
}: StageAdvanceSheetProps) {
  const { t } = useTranslation();

  if (transition === null) return null;

  const title =
    transition.reason === 'threshold'
      ? t('path.advance.title', {
          ordinal: transition.nextStage.ordinal,
          name: transition.nextStage.name,
        })
      : t('path.advance.titleSlow', { ordinal: transition.nextStage.ordinal });

  return (
    <Sheet visible onClose={onConfirm} title={title} closeLabel={t('path.advance.close')}>
      <Text variant="body" tone="secondary">
        {transition.nextStage.description}
      </Text>

      {transition.adds.length === 0 ? null : (
        <View className="gap-3">
          <Divider />
          <Text variant="label" tone="secondary">
            {t('path.advance.adds')}
          </Text>
          {transition.adds.map((practice) => (
            <View key={practice.id} className="gap-1">
              <Text variant="bodyLg">{practice.title}</Text>
              <Text variant="caption" tone="secondary">
                {practice.why}
              </Text>
            </View>
          ))}
        </View>
      )}

      {transition.removes.length === 0 ? null : (
        <View className="gap-3">
          <Divider />
          <Text variant="label" tone="secondary">
            {t('path.advance.removes')}
          </Text>
          {transition.removes.map((practice) => (
            <Text key={practice.id} variant="bodyLg">
              {practice.title}
            </Text>
          ))}
        </View>
      )}

      <Button
        label={t('path.advance.confirm')}
        size="lg"
        loading={isPending}
        onPress={onConfirm}
      />
    </Sheet>
  );
}
