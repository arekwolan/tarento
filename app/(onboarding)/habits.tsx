import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, OptionCard, Screen, Text } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import { useHabitTemplates, type TemplateCategory } from '@/features/templates';
import { useTheme } from '@/theme/theme-provider';

/** Trzy to granica, po której lista przestaje być „jedną rzeczą na dziś". */
const MAX_STARTER_HABITS = 3;

const KNOWN_AREAS: readonly TemplateCategory[] = [
  'focus',
  'mindfulness',
  'health',
  'learning',
  'relationships',
];

/**
 * Krok 2: wybór 1–3 nawyków startowych.
 *
 * Katalog zawężamy do wybranego obszaru, ale gdy nie ma tam nic — pokazujemy
 * całość, zamiast wypuszczać użytkownika z pustymi rękami.
 */
export default function OnboardingHabitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const { area } = useLocalSearchParams<{ area?: string }>();

  const category = KNOWN_AREAS.find((known) => known === area) ?? null;
  const { templates, isLoading } = useHabitTemplates(category);
  const { templates: allTemplates } = useHabitTemplates(null);

  const pool = templates.length > 0 ? templates : allTemplates;
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (templateId: string) => {
    setSelected((current) => {
      if (current.includes(templateId)) {
        return current.filter((id) => id !== templateId);
      }
      return current.length >= MAX_STARTER_HABITS ? current : [...current, templateId];
    });
  };

  const goNext = (ids: readonly string[]) => {
    // Rozgałęzienie zamiast sklejania: typed routes zna tylko konkretne
    // kształty adresu, a `/reminders${string}` nie jest jednym z nich.
    if (ids.length === 0) {
      router.push('/reminders');
      return;
    }
    router.push(`/reminders?templates=${ids.join(',')}`);
  };

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color('text-secondary')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('onboarding.step2.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('onboarding.step2.description')}
        </Text>
        <Text variant="num" tone="secondary">
          {t('onboarding.step2.selected', {
            selected: selected.length,
            max: MAX_STARTER_HABITS,
          })}
        </Text>
      </View>

      {pool.length === 0 ? (
        <Text variant="body" tone="secondary">
          {t('onboarding.step2.empty')}
        </Text>
      ) : (
        <View className="gap-3">
          {pool.map((template) => {
            const unitKey = targetUnitKey(template.unit);
            const start =
              template.unit === 'none'
                ? undefined
                : `${formatTargetValue(template.startValue)}${
                    unitKey === null ? '' : ` ${t(unitKey)}`
                  }`;

            return (
              <OptionCard
                key={template.id}
                title={template.title}
                description={
                  start === undefined ? (template.description ?? undefined) : start
                }
                selected={selected.includes(template.id)}
                onPress={() => {
                  toggle(template.id);
                }}
              />
            );
          })}
        </View>
      )}

      <View className="gap-2">
        <Button
          label={t('onboarding.next')}
          size="lg"
          disabled={selected.length === 0}
          onPress={() => {
            goNext(selected);
          }}
        />
        <Button
          label={t('onboarding.skip')}
          variant="ghost"
          onPress={() => {
            goNext([]);
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
