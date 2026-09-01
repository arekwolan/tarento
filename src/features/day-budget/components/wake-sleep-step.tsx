import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { TimeDial } from '@/features/day-budget/components/time-dial';
import { cn } from '@/lib/cn';

/** Powyżej tej skali fontu dwa pokrętła obok siebie przestają się mieścić. */
const STACK_FONT_SCALE = 1.2;

export type WakeSleepStepProps = {
  wakeTime: string;
  sleepTime: string;
  onChangeWakeTime: (value: string) => void;
  onChangeSleepTime: (value: string) => void;
};

/** Krok 1: kotwice doby. Dwa pokrętła, dziesięć sekund. */
export function WakeSleepStep({
  wakeTime,
  sleepTime,
  onChangeWakeTime,
  onChangeSleepTime,
}: WakeSleepStepProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const isStacked = fontScale > STACK_FONT_SCALE;

  return (
    <View className="gap-3">
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.dayShape.step1.title')}
      </Text>

      <View className={cn('gap-3', isStacked ? 'flex-col' : 'flex-row')}>
        <TimeDial
          label={t('onboarding.dayShape.step1.wake')}
          earlierLabel={t('onboarding.dayShape.step1.earlier')}
          laterLabel={t('onboarding.dayShape.step1.later')}
          value={wakeTime}
          onChange={onChangeWakeTime}
        />
        <TimeDial
          label={t('onboarding.dayShape.step1.sleep')}
          earlierLabel={t('onboarding.dayShape.step1.earlier')}
          laterLabel={t('onboarding.dayShape.step1.later')}
          value={sleepTime}
          onChange={onChangeSleepTime}
        />
      </View>
    </View>
  );
}
