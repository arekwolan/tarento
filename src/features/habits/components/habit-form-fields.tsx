import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Chip, OptionCard, Text, usePressClass } from '@/components/ui';
import type { HabitFormValues } from '@/features/habits/model/habit-form';
import type { TranslationKey } from '@/i18n/keys';
import { cn } from '@/lib/cn';
import { shiftTimeOfDay } from '@/lib/date';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

type FormControl = Control<HabitFormValues>;

/** Etykieta nad grupą przełączników. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="secondary">
      {children}
    </Text>
  );
}

type ChoiceOption<TValue extends string> = { value: TValue; label: TranslationKey };

/** Rząd chipów spięty z jednym polem formularza. */
export function ChipField<TValue extends string>({
  control,
  name,
  label,
  options,
}: {
  control: FormControl;
  name: 'unit' | 'category' | 'scheduleType' | 'timeOfDay';
  label: TranslationKey;
  options: readonly ChoiceOption<TValue>[];
}) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <View className="gap-2">
          <FieldLabel>{t(label)}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {options.map((option) => (
              <Chip
                key={option.value}
                label={t(option.label)}
                selected={field.value === option.value}
                onPress={() => {
                  field.onChange(option.value);
                }}
              />
            ))}
          </View>
        </View>
      )}
    />
  );
}

const WEEKDAY_LABELS: readonly TranslationKey[] = [
  'dayShort.sun',
  'dayShort.mon',
  'dayShort.tue',
  'dayShort.wed',
  'dayShort.thu',
  'dayShort.fri',
  'dayShort.sat',
];

/** Wybór dni tygodnia. Numeracja 0–6 jak w bazie, niedziela pierwsza. */
export function WeekdayField({
  control,
  errorMessage,
}: {
  control: FormControl;
  errorMessage?: string;
}) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name="scheduleDays"
      render={({ field }) => (
        <View className="gap-2">
          <FieldLabel>{t('habits.form.scheduleDaysLabel')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, dayOfWeek) => {
              const selected = field.value.includes(dayOfWeek);
              return (
                <Chip
                  key={label}
                  label={t(label)}
                  selected={selected}
                  onPress={() => {
                    field.onChange(
                      selected
                        ? field.value.filter((day: number) => day !== dayOfWeek)
                        : [...field.value, dayOfWeek].sort((a, b) => a - b),
                    );
                  }}
                />
              );
            })}
          </View>
          {errorMessage === undefined ? null : (
            <Text variant="caption" tone="danger">
              {errorMessage}
            </Text>
          )}
        </View>
      )}
    />
  );
}

/** Presety godzin. Pokrywają typowe pory, a ±15 min dopina resztę. */
const REMINDER_PRESETS = ['06:30', '07:00', '08:00', '12:00', '18:00', '20:00', '21:30'];

/**
 * Godzina przypomnienia bez natywnego pickera: chipy z presetami plus
 * przesuwanie co kwadrans. Jedna ścieżka kodu na obu platformach.
 */
export function ReminderField({ control }: { control: FormControl }) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name="reminderTime"
      render={({ field }) => (
        <View className="gap-2">
          <FieldLabel>{t('habits.form.reminderLabel')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('habits.form.reminderNone')}
              selected={field.value === ''}
              onPress={() => {
                field.onChange('');
              }}
            />
            {REMINDER_PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={preset}
                selected={field.value === preset}
                onPress={() => {
                  field.onChange(preset);
                }}
              />
            ))}
          </View>

          {field.value === '' ? null : (
            <View className="flex-row items-center gap-2">
              <Chip
                label={t('habits.form.reminderEarlier')}
                onPress={() => {
                  field.onChange(shiftTimeOfDay(field.value, -15));
                }}
              />
              <Text variant="body">{field.value}</Text>
              <Chip
                label={t('habits.form.reminderLater')}
                onPress={() => {
                  field.onChange(shiftTimeOfDay(field.value, 15));
                }}
              />
            </View>
          )}
        </View>
      )}
    />
  );
}

/** Wybór trybu progresji — z opisem różnicy, bo to niełatwa decyzja. */
export function ProgressionField({ control }: { control: FormControl }) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name="progressionMode"
      render={({ field }) => (
        <View className="gap-2">
          <FieldLabel>{t('habits.form.progressionLabel')}</FieldLabel>
          <OptionCard
            title={t('habits.form.progressionCompletionTitle')}
            description={t('habits.form.progressionCompletionDescription')}
            selected={field.value === 'completion'}
            onPress={() => {
              field.onChange('completion');
            }}
          />
          <OptionCard
            title={t('habits.form.progressionCalendarTitle')}
            description={t('habits.form.progressionCalendarDescription')}
            selected={field.value === 'calendar'}
            onPress={() => {
              field.onChange('calendar');
            }}
          />
        </View>
      )}
    />
  );
}

/**
 * Zestaw ikon do wyboru.
 *
 * Świadomie krótki: pełna lista Ionicons to tysiące pozycji, a nawyk
 * potrzebuje rozpoznawalnego znaczka, nie katalogu.
 */
const ICON_CHOICES: readonly (keyof typeof Ionicons.glyphMap)[] = [
  'leaf-outline',
  'timer-outline',
  'book-outline',
  'barbell-outline',
  'walk-outline',
  'moon-outline',
  'water-outline',
  'create-outline',
  'heart-outline',
  'bulb-outline',
  'musical-notes-outline',
  'people-outline',
];

export function IconField({ control }: { control: FormControl }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const pressClass = usePressClass();

  return (
    <Controller
      control={control}
      name="icon"
      render={({ field }) => (
        <View className="gap-2">
          <FieldLabel>{t('habits.form.iconLabel')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {ICON_CHOICES.map((icon) => {
              const selected = field.value === icon;
              return (
                <Pressable
                  key={icon}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={icon}
                  onPress={() => {
                    field.onChange(icon);
                  }}
                  style={CONTINUOUS_CURVE}
                  className={cn(
                    'size-12 items-center justify-center rounded-sm border',
                    selected
                      ? 'border-border-strong bg-surface-elevated'
                      : 'border-border bg-surface',
                    pressClass,
                  )}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={selected ? color('text-primary') : color('text-tertiary')}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}
