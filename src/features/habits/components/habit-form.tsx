import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Banner, Button, ControlledTextField, ProgressBar, Text } from '@/components/ui';
import {
  ChipField,
  IconField,
  ProgressionField,
  ReminderField,
  WeekdayField,
} from '@/features/habits/components/habit-form-fields';
import { HabitPreview } from '@/features/habits/components/habit-preview';
import {
  habitFormMessageKey,
  habitFormSchema,
  type HabitFormValues,
} from '@/features/habits/model/habit-form';
import type { TranslationKey } from '@/i18n/keys';

/** Pola sprawdzane przed przejściem do kolejnego kroku. */
const STEP_FIELDS: readonly (readonly Path<HabitFormValues>[])[] = [
  ['title', 'description', 'category'],
  ['unit', 'startValue', 'incrementValue', 'targetValue', 'progressionMode'],
  ['scheduleType', 'scheduleDays', 'timeOfDay', 'reminderTime'],
];

const STEP_TITLES = [
  'habits.form.steps.what',
  'habits.form.steps.howMuch',
  'habits.form.steps.when',
] as const satisfies readonly TranslationKey[];

const UNIT_OPTIONS = [
  { value: 'none', label: 'habits.unitNames.none' },
  { value: 'minutes', label: 'habits.unitNames.minutes' },
  { value: 'seconds', label: 'habits.unitNames.seconds' },
  { value: 'reps', label: 'habits.unitNames.reps' },
  { value: 'pages', label: 'habits.unitNames.pages' },
  { value: 'count', label: 'habits.unitNames.count' },
] as const satisfies readonly { value: string; label: TranslationKey }[];

const CATEGORY_OPTIONS = [
  { value: '', label: 'library.filterAll' },
  { value: 'focus', label: 'categories.focus' },
  { value: 'mindfulness', label: 'categories.mindfulness' },
  { value: 'health', label: 'categories.health' },
  { value: 'learning', label: 'categories.learning' },
  { value: 'relationships', label: 'categories.relationships' },
] as const satisfies readonly { value: string; label: TranslationKey }[];

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'habits.form.scheduleDaily' },
  { value: 'weekdays', label: 'habits.form.scheduleWeekdays' },
  { value: 'custom', label: 'habits.form.scheduleCustom' },
] as const satisfies readonly { value: string; label: TranslationKey }[];

const TIME_OF_DAY_OPTIONS = [
  { value: '', label: 'habits.form.timeOfDayNone' },
  { value: 'morning', label: 'today.groups.morning' },
  { value: 'afternoon', label: 'today.groups.afternoon' },
  { value: 'evening', label: 'today.groups.evening' },
] as const satisfies readonly { value: string; label: TranslationKey }[];

export type HabitFormProps = {
  initialValues: HabitFormValues;
  /** Gotowa etykieta przycisku zapisu. */
  submitLabel: string;
  isSubmitting: boolean;
  /** Gotowy komunikat błędu zapisu. */
  errorMessage?: string;
  onSubmit: (values: HabitFormValues) => void;
  onCancel: () => void;
  /** Dodatkowe akcje pod formularzem, np. archiwizacja przy edycji. */
  footer?: ReactNode;
  /** Jawny kontekst zaakceptowanych reguł, wyświetlany tylko w preview. */
  previewContext?: ReactNode;
};

/**
 * Formularz nawyku w trzech krokach: co, ile, kiedy.
 *
 * Krokowo, a nie jedną listą: sam krok „ile" ma pięć pól, z których dwa
 * wymagają zrozumienia progresji. Zrzucone razem z resztą wyglądają jak
 * formularz podatkowy.
 */
export function HabitForm({
  initialValues,
  submitLabel,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
  footer,
  previewContext,
}: HabitFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const { control, handleSubmit, trigger, formState } = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });

  // useWatch zamiast watch(): watch() czyta stan poza cyklem renderu,
  // przez co React Compiler pomija optymalizację całego komponentu.
  const values = useWatch({ control });
  const isLastStep = step === STEP_FIELDS.length - 1;
  const stepTitle = STEP_TITLES[step] ?? STEP_TITLES[0];

  const goNext = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    if (await trigger([...fields])) {
      setStep((current) => Math.min(current + 1, STEP_FIELDS.length - 1));
    }
  };

  const submit = handleSubmit((formValues) => {
    onSubmit(formValues);
  });

  const scheduleDaysError = habitFormMessageKey(formState.errors.scheduleDays?.message);

  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text variant="num" tone="secondary">
          {t('habits.form.stepOf', { current: step + 1, total: STEP_FIELDS.length })}
        </Text>
        <ProgressBar
          value={(step + 1) / STEP_FIELDS.length}
          accessibilityLabel={t('habits.form.stepOf', {
            current: step + 1,
            total: STEP_FIELDS.length,
          })}
        />
        <Text variant="title">{t(stepTitle)}</Text>
      </View>

      {errorMessage === undefined ? null : (
        <Banner tone="danger" message={errorMessage} />
      )}

      {step === 0 ? (
        <View className="gap-4">
          <ControlledTextField
            control={control}
            name="title"
            messageKey={habitFormMessageKey}
            label={t('habits.form.titleLabel')}
            placeholder={t('habits.form.titlePlaceholder')}
            autoCapitalize="sentences"
          />
          <ControlledTextField
            control={control}
            name="description"
            messageKey={habitFormMessageKey}
            label={t('habits.form.descriptionLabel')}
            placeholder={t('habits.form.descriptionPlaceholder')}
            multiline
            numberOfLines={2}
          />
          <IconField control={control} />
          <ChipField
            control={control}
            name="category"
            label="habits.form.categoryLabel"
            options={CATEGORY_OPTIONS}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View className="gap-4">
          <ChipField
            control={control}
            name="unit"
            label="habits.form.unitLabel"
            options={UNIT_OPTIONS}
          />
          <ControlledTextField
            control={control}
            name="startValue"
            messageKey={habitFormMessageKey}
            label={t('habits.form.startValueLabel')}
            hint={t('habits.form.startValueHint')}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <ControlledTextField
            control={control}
            name="incrementValue"
            messageKey={habitFormMessageKey}
            label={t('habits.form.incrementLabel')}
            hint={t('habits.form.incrementHint')}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <ControlledTextField
            control={control}
            name="targetValue"
            messageKey={habitFormMessageKey}
            label={t('habits.form.targetLabel')}
            hint={t('habits.form.targetHint')}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <ProgressionField control={control} />
          <HabitPreview values={values} />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-4">
          <ChipField
            control={control}
            name="scheduleType"
            label="habits.form.scheduleLabel"
            options={SCHEDULE_OPTIONS}
          />
          {values.scheduleType === 'custom' ? (
            <WeekdayField
              control={control}
              errorMessage={
                scheduleDaysError === undefined ? undefined : t(scheduleDaysError)
              }
            />
          ) : null}
          <ChipField
            control={control}
            name="timeOfDay"
            label="habits.form.timeOfDayLabel"
            options={TIME_OF_DAY_OPTIONS}
          />
          <ReminderField control={control} />
          <HabitPreview values={values} />
          {previewContext}
        </View>
      ) : null}

      <View className="gap-2">
        {isLastStep ? (
          <Button
            label={submitLabel}
            size="lg"
            loading={isSubmitting}
            onPress={() => {
              void submit();
            }}
          />
        ) : (
          <Button
            label={t('habits.form.next')}
            size="lg"
            onPress={() => {
              void goNext();
            }}
          />
        )}

        {step > 0 ? (
          <Button
            label={t('habits.form.back')}
            variant="secondary"
            onPress={() => {
              setStep((current) => Math.max(0, current - 1));
            }}
          />
        ) : null}

        <Button label={t('habits.form.cancel')} variant="ghost" onPress={onCancel} />
        {footer}
      </View>
    </View>
  );
}
