import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Card, Chip, Text } from '@/components/ui';
import { useRestDays } from '@/features/day-budget/api/use-rest-days';
import { useToggleRestDay } from '@/features/day-budget/api/use-toggle-rest-day';
import { findRestWeekday } from '@/features/day-budget/model/rest';
import type { TranslationKey } from '@/i18n/keys';

/**
 * Kolejność od poniedziałku, bo tak czyta się tydzień po polsku. Wartości to
 * numeracja Postgresa i `dayOfWeek()`: 0 = niedziela.
 */
const WEEKDAYS: readonly { value: number; label: TranslationKey }[] = [
  { value: 1, label: 'dayShort.mon' },
  { value: 2, label: 'dayShort.tue' },
  { value: 3, label: 'dayShort.wed' },
  { value: 4, label: 'dayShort.thu' },
  { value: 5, label: 'dayShort.fri' },
  { value: 6, label: 'dayShort.sat' },
  { value: 0, label: 'dayShort.sun' },
];

/**
 * Cykliczne dni puste.
 *
 * Domyślnie żaden — to ma być decyzja, a nie ustawienie, które ktoś zastał
 * włączone. Podpis mówi wprost, co się dzieje z serią, bo to jedyna obawa,
 * przez którą ktoś by tego nie włączył.
 */
export function RestDaysCard() {
  const { t } = useTranslation();
  const { restDays } = useRestDays();
  const { setWeekday, error } = useToggleRestDay();

  return (
    <Card className="gap-4">
      <Text variant="title">{t('rest.settings.title')}</Text>

      <View className="flex-row flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const declared = findRestWeekday(day.value, restDays);

          return (
            <Chip
              key={day.value}
              label={t(day.label)}
              selected={declared !== null}
              onPress={() => {
                setWeekday(day.value, declared === null, declared?.id ?? null);
              }}
            />
          );
        })}
      </View>

      <Text variant="caption" tone="tertiary">
        {t('rest.settings.hint')}
      </Text>

      {error === null ? null : (
        <Banner tone="danger" message={t('rest.settings.error')} />
      )}
    </Card>
  );
}
