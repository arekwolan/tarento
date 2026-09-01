import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Chip, Screen, Text } from '@/components/ui';
import { trackEvent } from '@/features/analytics';
import { useAuth } from '@/features/auth';
import { useSaveHabit } from '@/features/habits';
import { useNotificationPermission } from '@/features/notifications';
import { toFormValuesFromTemplate, useHabitTemplates } from '@/features/templates';
import { useTheme } from '@/theme/theme-provider';

const TIME_PRESETS = ['07:00', '08:00', '12:00', '18:00', '20:00', '21:00'];
const DEFAULT_REMINDER = '08:00';

/**
 * Krok 3: godzina przypomnienia i zgoda na powiadomienia.
 *
 * Systemowy dialog pada dopiero po tym ekranie. Zgody pyta się raz — jeśli
 * spalimy ją zanim użytkownik wie, po co, drugiej szansy nie ma.
 *
 * Ten ekran domyka też onboarding: zakłada wybrane nawyki i stempluje
 * `onboarding_completed_at`.
 */
export default function OnboardingRemindersScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const { markOnboardingComplete } = useAuth();
  const { templates: allTemplates } = useHabitTemplates(null);
  const { create } = useSaveHabit();
  const { status, isRequesting, request } = useNotificationPermission();
  const { templates: selectedIds } = useLocalSearchParams<{ templates?: string }>();

  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER);
  const [isFinishing, setIsFinishing] = useState(false);
  const [failed, setFailed] = useState(false);

  const chosenIds =
    typeof selectedIds === 'string' && selectedIds !== '' ? selectedIds.split(',') : [];

  const finish = async (withReminder: boolean) => {
    setIsFinishing(true);
    setFailed(false);

    try {
      for (const templateId of chosenIds) {
        const template = allTemplates.find((candidate) => candidate.id === templateId);
        if (template === undefined) continue;

        const values = toFormValuesFromTemplate(template);
        await create(
          { ...values, reminderTime: withReminder ? reminderTime : '' },
          { fromTemplate: true },
        );
      }

      await markOnboardingComplete();

      trackEvent('onboarding_completed', {
        starter_habits: chosenIds.length,
        reminders_enabled: withReminder,
        area: null,
      });
    } catch {
      setFailed(true);
    } finally {
      setIsFinishing(false);
    }
  };

  const allowAndFinish = async () => {
    const next = await request();
    await finish(next === 'granted');
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('onboarding.step3.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('onboarding.step3.description')}
        </Text>
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="ellipse" size={6} color={color('text-tertiary')} />
          <Text variant="caption" tone="secondary" className="flex-1">
            {t('onboarding.step3.whyOne')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="ellipse" size={6} color={color('text-tertiary')} />
          <Text variant="caption" tone="secondary" className="flex-1">
            {t('onboarding.step3.whyTwo')}
          </Text>
        </View>
      </Card>

      <View className="gap-2">
        <Text variant="label" tone="secondary">
          {t('onboarding.step3.timeLabel')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {TIME_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={preset}
              selected={reminderTime === preset}
              onPress={() => {
                setReminderTime(preset);
              }}
            />
          ))}
        </View>
      </View>

      {status === 'denied' ? <Banner message={t('onboarding.step3.denied')} /> : null}
      {failed ? <Banner tone="danger" message={t('onboarding.error')} /> : null}

      <View className="gap-2">
        <Button
          label={t('onboarding.step3.allow')}
          size="lg"
          loading={isRequesting || isFinishing}
          onPress={() => {
            void allowAndFinish();
          }}
        />
        <Button
          label={t('onboarding.step3.later')}
          variant="ghost"
          disabled={isRequesting || isFinishing}
          onPress={() => {
            void finish(false);
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
