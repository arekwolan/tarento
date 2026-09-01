import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip, Text } from '@/components/ui';
import {
  SELF_MINUTES_OPTIONS,
  windowMessage,
  type DayShapeDraft,
} from '@/features/day-budget/model/day-shape';
import type { TimeWindow } from '@/features/day-budget/model/windows';

export type SelfMinutesStepProps = {
  draft: DayShapeDraft;
  /** Okno policzone z wersji roboczej; `null`, gdy w dobie nie zostaje nic. */
  dayWindow: TimeWindow | null;
  onChange: (minutes: number) => void;
};

/**
 * Krok 3: deklaracja czasu dla siebie.
 *
 * Zdanie pod chipami jest najważniejszym tekstem onboardingu i mówi wyłącznie
 * o przydzielonym oknie. Wyliczona wolna pula zostaje w modelu — liczba na
 * ekranie ma być granicą, nie inwentarzem (IDEAS.md §A).
 */
export function SelfMinutesStep({ draft, dayWindow, onChange }: SelfMinutesStepProps) {
  const { t } = useTranslation();
  const message = windowMessage(draft, dayWindow);

  return (
    <View className="gap-3">
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.dayShape.step3.title')}
      </Text>

      {/* Zawijanie, a nie stała szerokość: przy fontScale 1.3 chipy schodzą do drugiej linii. */}
      <View className="flex-row flex-wrap gap-2">
        {SELF_MINUTES_OPTIONS.map((minutes) => (
          <Chip
            key={minutes}
            label={t('onboarding.dayShape.step3.option', { minutes })}
            selected={draft.selfMinutes === minutes}
            onPress={() => {
              onChange(minutes);
            }}
          />
        ))}
      </View>

      <Text variant="bodyLg" accessibilityLiveRegion="polite">
        {t(message.key, { minutes: message.minutes })}
      </Text>
    </View>
  );
}
