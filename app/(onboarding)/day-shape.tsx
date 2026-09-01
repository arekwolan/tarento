import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Screen, Text } from '@/components/ui';
import {
  BusyBlocksStep,
  defaultDayShape,
  SelfMinutesStep,
  useDayShapeDraft,
  useSaveDayShape,
  WakeSleepStep,
  type DayShapeDraft,
} from '@/features/day-budget';
import { useIsOnline } from '@/lib/network';

/**
 * Krok „kształt dnia": pobudka i sen, zajęte pasy, czas dla siebie.
 *
 * Stoi przed wyborem nawyków, bo to budżet ogranicza wybór — lista, z której
 * użytkownik wybiera, ma się mieścić w dniu, który właśnie opisał.
 */
export default function OnboardingDayShapeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area?: string }>();

  const isOnline = useIsOnline();
  const shape = useDayShapeDraft();
  const { save, isPending, error } = useSaveDayShape();

  const goNext = async (draft: DayShapeDraft) => {
    const saved = await save(draft);
    if (!saved) return;

    // Rozgałęzienie zamiast sklejania: typed routes zna tylko konkretne
    // kształty adresu, a `/habits${string}` nie jest jednym z nich.
    if (area === undefined || area === '') {
      router.push('/habits');
      return;
    }
    router.push(`/habits?area=${area}`);
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} contentClassName="gap-8">
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('onboarding.dayShape.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('onboarding.dayShape.description')}
        </Text>
      </View>

      <WakeSleepStep
        wakeTime={shape.draft.wakeTime}
        sleepTime={shape.draft.sleepTime}
        onChangeWakeTime={shape.setWakeTime}
        onChangeSleepTime={shape.setSleepTime}
      />

      <BusyBlocksStep
        axis={shape.axis}
        blocks={shape.draft.blocks}
        canAddBlock={shape.canAddBlock}
        onChangeBlock={shape.setBlock}
        onAddBlock={shape.addBlock}
        onRemoveBlock={shape.removeBlock}
      />

      <SelfMinutesStep
        draft={shape.draft}
        dayWindow={shape.dayWindow}
        onChange={shape.setSelfMinutes}
      />

      {isOnline ? null : <Banner message={t('onboarding.dayShape.offline')} />}
      {error === null ? null : <Banner tone="danger" message={t('onboarding.error')} />}

      <View className="gap-2">
        <Button
          label={t('onboarding.next')}
          size="lg"
          loading={isPending}
          onPress={() => {
            void goNext(shape.draft);
          }}
        />
        <Button
          label={t('onboarding.dayShape.skip')}
          variant="ghost"
          disabled={isPending}
          onPress={() => {
            void goNext(defaultDayShape());
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
