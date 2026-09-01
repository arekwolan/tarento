import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import { useLogicalToday } from '@/features/auth';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import { parseDecimal, type HabitFormValues } from '@/features/habits/model/habit-form';
import { addDays, computeTargetAtStep, countScheduledDays } from '@/lib/date';

/** Horyzont podglądu. Miesiąc to tyle, ile widać gołym okiem w progresji. */
const PREVIEW_HORIZON_DAYS = 30;

/**
 * Pokazuje, dokąd zaprowadzi ustawiony przyrost.
 *
 * Sens tej sekcji: liczby w formularzu wyglądają na drobne („+30 sekund"),
 * a po miesiącu robi się z nich coś, czego użytkownik sam by nie policzył.
 */
/**
 * Wartości przychodzą z useWatch, więc każde pole może być jeszcze
 * niezainicjalizowane — podgląd musi działać także w połowie wpisywania.
 */
export function HabitPreview({ values }: { values: Partial<HabitFormValues> }) {
  const { t } = useTranslation();
  const today = useLogicalToday();

  const startValue = parseDecimal(values.startValue ?? '') ?? 0;
  const incrementValue = parseDecimal(values.incrementValue ?? '') ?? 0;
  const unitKey = targetUnitKey(values.unit ?? 'none');

  const withUnit = (value: number) =>
    `${formatTargetValue(value)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

  if (incrementValue <= 0) {
    return (
      <Card className="gap-2">
        <Text variant="label" tone="secondary">
          {t('habits.form.previewTitle')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('habits.form.previewNoProgression')}
        </Text>
      </Card>
    );
  }

  const schedule = {
    scheduleType: values.scheduleType ?? 'daily',
    scheduleDays: values.scheduleDays ?? [],
    startedOn: today,
  };

  const steps = countScheduledDays(schedule, today, addDays(today, PREVIEW_HORIZON_DAYS));
  const target = computeTargetAtStep(
    {
      ...schedule,
      startValue,
      incrementValue,
      targetValue: parseDecimal(values.targetValue ?? ''),
      progressionMode: values.progressionMode ?? 'completion',
    },
    steps,
  );

  return (
    <Card className="gap-2">
      <Text variant="label" tone="secondary">
        {t('habits.form.previewTitle')}
      </Text>
      <Text variant="title" tone="accent">
        {t('habits.form.previewInDays', {
          days: PREVIEW_HORIZON_DAYS,
          target: withUnit(target),
        })}
      </Text>
      <Text variant="caption" tone="tertiary">
        {withUnit(startValue)}
      </Text>
    </Card>
  );
}
