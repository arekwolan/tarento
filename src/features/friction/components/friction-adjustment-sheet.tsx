import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Chip, Divider, Sheet, Text, TextField } from '@/components/ui';
import {
  frictionReminderSchema,
  initialFrictionReminder,
  type FrictionReminderValues,
} from '@/features/friction/model/adjustment';
import type { Habit, TimeOfDay } from '@/features/habits';
import type { TranslationKey } from '@/i18n/keys';

export type FrictionAdjustmentMode = 'time' | 'reminder';

const TIME_OPTIONS = [
  { value: 'morning', label: 'today.groups.morning' },
  { value: 'afternoon', label: 'today.groups.afternoon' },
  { value: 'evening', label: 'today.groups.evening' },
] as const satisfies readonly { value: TimeOfDay; label: TranslationKey }[];

const TIME_LABELS: Record<TimeOfDay, TranslationKey> = {
  morning: 'today.groups.morning',
  afternoon: 'today.groups.afternoon',
  evening: 'today.groups.evening',
};

function TimeAdjustment({
  habit,
  isSaving,
  hasError,
  onApply,
}: {
  habit: Habit;
  isSaving: boolean;
  hasError: boolean;
  onApply: (value: TimeOfDay) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<TimeOfDay>(habit.timeOfDay ?? 'morning');

  return (
    <>
      <Text variant="body" tone="secondary">
        {t('friction.adjustment.timeDescription')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {TIME_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={t(option.label)}
            selected={selected === option.value}
            onPress={() => {
              setSelected(option.value);
            }}
          />
        ))}
      </View>
      <Divider />
      <Text variant="body">
        {t('friction.adjustment.timePreview', {
          before:
            habit.timeOfDay === null
              ? t('habits.form.timeOfDayNone')
              : t(TIME_LABELS[habit.timeOfDay]),
          after: t(TIME_LABELS[selected]),
        })}
      </Text>
      {hasError ? <Banner message={t('friction.adjustment.saveError')} /> : null}
      <Button
        label={t('friction.adjustment.timeConfirm')}
        loading={isSaving}
        disabled={habit.timeOfDay === selected}
        onPress={() => {
          onApply(selected);
        }}
      />
    </>
  );
}

function ReminderAdjustment({
  habit,
  isSaving,
  hasError,
  canEnableReminder,
  isPermissionLoading,
  onApply,
  onOpenSettings,
}: {
  habit: Habit;
  isSaving: boolean;
  hasError: boolean;
  canEnableReminder: boolean;
  isPermissionLoading: boolean;
  onApply: (value: string) => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<FrictionReminderValues>({
    resolver: zodResolver(frictionReminderSchema),
    mode: 'onChange',
    defaultValues: { reminderTime: initialFrictionReminder(habit) },
  });

  const submit = handleSubmit((values) => {
    onApply(values.reminderTime);
  });
  const reminderTime = useWatch({ control, name: 'reminderTime' });

  return (
    <>
      <Text variant="body" tone="secondary">
        {t('friction.adjustment.reminderDescription')}
      </Text>
      {!canEnableReminder ? (
        <>
          <Banner message={t('friction.adjustment.reminderUnavailable')} />
          <Button
            label={t('friction.adjustment.openSettings')}
            variant="secondary"
            onPress={onOpenSettings}
          />
        </>
      ) : null}
      <Controller
        control={control}
        name="reminderTime"
        render={({ field }) => (
          <TextField
            label={t('friction.adjustment.reminderLabel')}
            placeholder={t('friction.adjustment.reminderPlaceholder')}
            hint={t(
              isValid
                ? 'friction.adjustment.reminderHint'
                : 'friction.adjustment.reminderInvalid',
            )}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="numbers-and-punctuation"
            inputMode="text"
            editable={canEnableReminder}
          />
        )}
      />
      <Text variant="body">
        {t('friction.adjustment.reminderPreview', {
          before: habit.reminderTime?.slice(0, 5) ?? t('friction.adjustment.off'),
          after: reminderTime,
        })}
      </Text>
      {hasError ? <Banner message={t('friction.adjustment.saveError')} /> : null}
      <Button
        label={t(
          habit.reminderTime === null
            ? 'friction.adjustment.reminderConfirm'
            : 'friction.adjustment.reminderChange',
        )}
        loading={isSaving || isPermissionLoading}
        disabled={!canEnableReminder || !isValid}
        onPress={() => {
          void submit();
        }}
      />
    </>
  );
}

export type FrictionAdjustmentSheetProps = {
  mode: FrictionAdjustmentMode | null;
  habit: Habit;
  isSaving: boolean;
  hasError: boolean;
  canEnableReminder: boolean;
  isPermissionLoading: boolean;
  onClose: () => void;
  onApplyTime: (value: TimeOfDay) => void;
  onApplyReminder: (value: string) => void;
  onOpenSettings: () => void;
};

export function FrictionAdjustmentSheet({
  mode,
  habit,
  isSaving,
  hasError,
  canEnableReminder,
  isPermissionLoading,
  onClose,
  onApplyTime,
  onApplyReminder,
  onOpenSettings,
}: FrictionAdjustmentSheetProps) {
  const { t } = useTranslation();

  if (mode === null) return null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t(
        mode === 'time'
          ? 'friction.adjustment.timeTitle'
          : 'friction.adjustment.reminderTitle',
      )}
      closeLabel={t('friction.adjustment.close')}
    >
      {mode === 'time' ? (
        <TimeAdjustment
          habit={habit}
          isSaving={isSaving}
          hasError={hasError}
          onApply={onApplyTime}
        />
      ) : (
        <ReminderAdjustment
          habit={habit}
          isSaving={isSaving}
          hasError={hasError}
          canEnableReminder={canEnableReminder}
          isPermissionLoading={isPermissionLoading}
          onApply={onApplyReminder}
          onOpenSettings={onOpenSettings}
        />
      )}
      <Button label={t('friction.adjustment.close')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
