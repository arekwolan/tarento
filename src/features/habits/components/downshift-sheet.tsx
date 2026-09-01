import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button, Sheet, Text } from '@/components/ui';
import type { DownshiftProposal } from '@/features/ai-plan';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { Habit } from '@/features/habits/model/habit';
import type { TranslationKey } from '@/i18n/keys';
import { useTheme } from '@/theme/theme-provider';

export type DownshiftSheetProps = {
  habit: Habit;
  /** `null` zamyka arkusz. */
  proposal: DownshiftProposal | null;
  isApplying: boolean;
  onApply: () => void;
  onClose: () => void;
};

const DAY_KEYS = [
  'dayShort.sun',
  'dayShort.mon',
  'dayShort.tue',
  'dayShort.wed',
  'dayShort.thu',
  'dayShort.fri',
  'dayShort.sat',
] as const satisfies readonly TranslationKey[];

type Row = { key: string; before: string; after: string };

/**
 * Zmiana pokazana jako różnica, nie jako nowy stan.
 *
 * „30 minut → 10 minut" mówi wszystko bez zdania wyjaśniającego; sama liczba
 * „10 minut" zmusza użytkownika do przypomnienia sobie, ile było wcześniej.
 */
function ChangeRow({ before, after }: { before: string; after: string }) {
  const { color } = useTheme();

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Text variant="bodyLg" tone="tertiary">
        {before}
      </Text>
      <Ionicons name="arrow-forward" size={16} color={color('text-tertiary')} />
      <Text variant="bodyLg">{after}</Text>
    </View>
  );
}

export function DownshiftSheet({
  habit,
  proposal,
  isApplying,
  onApply,
  onClose,
}: DownshiftSheetProps) {
  const { t } = useTranslation();

  if (proposal === null) return null;

  const unitKey = targetUnitKey(habit.unit);
  const unit = unitKey === null ? '' : ` ${t(unitKey)}`;

  const describeSchedule = (
    scheduleType: Habit['scheduleType'],
    scheduleDays: readonly number[] | null,
  ): string => {
    if (scheduleType === 'daily') return t('habits.form.scheduleDaily');
    if (scheduleType === 'weekdays') return t('habits.form.scheduleWeekdays');

    return (scheduleDays ?? [])
      .map((day) => {
        const key = DAY_KEYS[day];
        return key === undefined ? '' : t(key);
      })
      .filter((label) => label !== '')
      .join(', ');
  };

  const rows: Row[] = [];

  if (proposal.start_value !== habit.startValue) {
    rows.push({
      key: 'value',
      before: `${formatTargetValue(habit.startValue)}${unit}`,
      after: `${formatTargetValue(proposal.start_value)}${unit}`,
    });
  }

  if (proposal.increment_value !== habit.incrementValue) {
    rows.push({
      key: 'increment',
      before: t('habits.downshift.incrementValue', {
        value: formatTargetValue(habit.incrementValue),
      }),
      after: t('habits.downshift.incrementNone'),
    });
  }

  const scheduleChanged =
    proposal.schedule_type !== habit.scheduleType ||
    describeSchedule(proposal.schedule_type, proposal.schedule_days) !==
      describeSchedule(habit.scheduleType, habit.scheduleDays);

  if (scheduleChanged) {
    rows.push({
      key: 'schedule',
      before: describeSchedule(habit.scheduleType, habit.scheduleDays),
      after: describeSchedule(proposal.schedule_type, proposal.schedule_days),
    });
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('habits.downshift.sheetTitle')}
      closeLabel={t('habits.downshift.close')}
    >
      <View className="gap-3">
        {rows.map((row) => (
          <ChangeRow key={row.key} before={row.before} after={row.after} />
        ))}
      </View>

      {proposal.rationale === '' ? null : (
        <Text variant="caption" tone="secondary">
          {proposal.rationale}
        </Text>
      )}

      <Text variant="caption" tone="tertiary">
        {t('habits.downshift.historyStays')}
      </Text>

      <Button
        label={t('habits.downshift.confirm')}
        size="lg"
        loading={isApplying}
        disabled={isApplying}
        onPress={onApply}
      />
    </Sheet>
  );
}
