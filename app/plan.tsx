import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Chip, Screen, Text, TextField } from '@/components/ui';
import { PlanItemEditor } from '@/features/ai-plan/components/plan-item-editor';
import { toHabitFormValues } from '@/features/ai-plan/model/plan';
import { useGeneratePlan } from '@/features/ai-plan';
import { useHabits, useSaveHabit } from '@/features/habits';
import type { TranslationKey } from '@/i18n/keys';
import { useTheme } from '@/theme/theme-provider';

const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'today.groups.morning' },
  { value: 'afternoon', label: 'today.groups.afternoon' },
  { value: 'evening', label: 'today.groups.evening' },
] as const satisfies readonly { value: string; label: TranslationKey }[];

const MINUTE_OPTIONS = [5, 10, 15, 30, 60];
const DEFAULT_MINUTES = 15;

/** Oznaczenie treści pochodzącej od modelu. Widoczne przy każdej propozycji. */
function AiBadge() {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <View className="flex-row items-center gap-2 self-start rounded-full border border-border bg-surface-sunken px-3 py-1">
      <Ionicons name="sparkles-outline" size={12} color={color('text-tertiary')} />
      <Text variant="label" tone="tertiary">
        {t('aiPlan.badge')}
      </Text>
    </View>
  );
}

export default function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { habits } = useHabits();
  const { create, isPending: isSaving } = useSaveHabit();
  const {
    proposal,
    remaining,
    isGenerating,
    errorKey,
    generate,
    reset,
    replaceItem,
    removeItem,
  } = useGeneratePlan();

  const [goal, setGoal] = useState('');
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>(
    'morning',
  );
  const [preferences, setPreferences] = useState('');
  const [added, setAdded] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const submit = () => {
    setAdded(null);
    void generate({
      goal,
      availableMinutes: minutes,
      timeOfDay,
      preferences,
      existingHabits: habits.map((habit) => habit.title),
    });
  };

  /**
   * Zapis dopiero tutaj.
   *
   * Funkcja brzegowa zwraca propozycję i niczego nie zapisuje — nawyki
   * powstają dopiero po tym, jak użytkownik przejrzał i poprawił listę.
   */
  const accept = async () => {
    if (proposal === null) return;

    setSaveFailed(false);
    let saved = 0;

    for (const item of proposal.items) {
      const habit = await create(toHabitFormValues(item));
      if (habit !== null) saved += 1;
    }

    if (saved === 0 && proposal.items.length > 0) {
      setSaveFailed(true);
      return;
    }

    setAdded(saved);
    reset();
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('aiPlan.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('aiPlan.subtitle')}
        </Text>
      </View>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
      {added === null ? null : (
        <Banner tone="success" message={t('aiPlan.proposal.added', { added })} />
      )}
      {saveFailed ? (
        <Banner tone="danger" message={t('aiPlan.proposal.addFailed')} />
      ) : null}

      {proposal === null ? (
        <>
          <TextField
            label={t('aiPlan.form.goalLabel')}
            placeholder={t('aiPlan.form.goalPlaceholder')}
            value={goal}
            onChangeText={setGoal}
            multiline
            numberOfLines={2}
          />

          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('aiPlan.form.minutesLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MINUTE_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={String(option)}
                  selected={minutes === option}
                  onPress={() => {
                    setMinutes(option);
                  }}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('aiPlan.form.timeOfDayLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TIME_OF_DAY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={t(option.label)}
                  selected={timeOfDay === option.value}
                  onPress={() => {
                    setTimeOfDay(option.value);
                  }}
                />
              ))}
            </View>
          </View>

          <TextField
            label={t('aiPlan.form.preferencesLabel')}
            placeholder={t('aiPlan.form.preferencesPlaceholder')}
            value={preferences}
            onChangeText={setPreferences}
            multiline
            numberOfLines={2}
          />

          <Card className="gap-3">
            <AiBadge />
            <Text variant="caption" tone="secondary">
              {t('aiPlan.disclaimer')}
            </Text>
          </Card>

          <Button
            label={isGenerating ? t('aiPlan.generating') : t('aiPlan.form.submit')}
            size="lg"
            loading={isGenerating}
            disabled={goal.trim() === ''}
            onPress={submit}
          />
        </>
      ) : (
        <>
          <AiBadge />

          <Card className="gap-3">
            <Text variant="title">{t('aiPlan.proposal.title')}</Text>
            {proposal.summary === '' ? null : (
              <Text variant="body" tone="secondary">
                {proposal.summary}
              </Text>
            )}
            <Text variant="caption" tone="secondary">
              {t('aiPlan.disclaimer')}
            </Text>
          </Card>

          {proposal.items.length === 0 ? (
            <Text variant="body" tone="secondary">
              {t('aiPlan.proposal.empty')}
            </Text>
          ) : (
            proposal.items.map((item, index) => (
              <PlanItemEditor
                key={`${item.title}-${index}`}
                item={item}
                onChange={(next) => {
                  replaceItem(index, next);
                }}
                onRemove={() => {
                  removeItem(index);
                }}
              />
            ))
          )}

          {remaining === null ? null : (
            <Text variant="num" tone="tertiary">
              {t('aiPlan.remaining', { remaining })}
            </Text>
          )}

          <Button
            label={t('aiPlan.proposal.accept')}
            size="lg"
            loading={isSaving}
            disabled={proposal.items.length === 0}
            onPress={() => {
              void accept();
            }}
          />
          <Button
            label={t('aiPlan.proposal.regenerate')}
            variant="secondary"
            disabled={isGenerating || isSaving}
            onPress={submit}
          />
          <Button label={t('aiPlan.proposal.discard')} variant="ghost" onPress={reset} />
        </>
      )}

      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
