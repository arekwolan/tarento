import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, OptionCard, Screen, Text } from '@/components/ui';
import type { TemplateCategory } from '@/features/templates';
import type { TranslationKey } from '@/i18n/keys';

type Area = {
  category: TemplateCategory;
  title: TranslationKey;
  description: TranslationKey;
  icon: 'lock-closed-outline' | 'leaf-outline' | 'heart-outline' | 'book-outline';
};

/** Cztery obszary z zadania, zmapowane na kategorie katalogu szablonów. */
const AREAS: readonly Area[] = [
  {
    category: 'focus',
    title: 'onboarding.step1.focus',
    description: 'onboarding.step1.focusDescription',
    icon: 'lock-closed-outline',
  },
  {
    category: 'mindfulness',
    title: 'onboarding.step1.mindfulness',
    description: 'onboarding.step1.mindfulnessDescription',
    icon: 'leaf-outline',
  },
  {
    category: 'health',
    title: 'onboarding.step1.health',
    description: 'onboarding.step1.healthDescription',
    icon: 'heart-outline',
  },
  {
    category: 'learning',
    title: 'onboarding.step1.learning',
    description: 'onboarding.step1.learningDescription',
    icon: 'book-outline',
  },
];

/**
 * Krok 1: obszar startowy.
 *
 * Pominięcie prowadzi do kolejnego kroku bez filtra, a nie do końca
 * onboardingu — chodzi o to, żeby użytkownik wyszedł stąd z nawykami,
 * a nie z pustą listą.
 *
 * Wybrany obszar jedzie dalej przez kształt dnia: budżet czasu musi powstać
 * przed listą nawyków, bo to on ogranicza wybór.
 */
export default function OnboardingAreaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [area, setArea] = useState<TemplateCategory | null>(null);

  const goNext = (selected: TemplateCategory | null) => {
    router.push(selected === null ? '/day-shape' : `/day-shape?area=${selected}`);
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('onboarding.step1.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('onboarding.step1.description')}
        </Text>
      </View>

      <View className="gap-3">
        {AREAS.map((option) => (
          <OptionCard
            key={option.category}
            icon={option.icon}
            title={t(option.title)}
            description={t(option.description)}
            selected={area === option.category}
            onPress={() => {
              setArea(option.category);
            }}
          />
        ))}
      </View>

      <View className="gap-2">
        <Button
          label={t('onboarding.next')}
          size="lg"
          disabled={area === null}
          onPress={() => {
            goNext(area);
          }}
        />
        <Button
          label={t('onboarding.skip')}
          variant="ghost"
          onPress={() => {
            goNext(null);
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
