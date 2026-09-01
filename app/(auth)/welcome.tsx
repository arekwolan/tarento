import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Screen, Text } from '@/components/ui';
import { signInAsGuest } from '@/features/auth';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPending, errorKey, run } = useAuthAction();

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentClassName="justify-between">
      <View className="flex-1 justify-center gap-3">
        <Text variant="titleLg">{t('auth.welcome.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('auth.welcome.tagline')}
        </Text>
      </View>

      <View className="gap-3">
        {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}

        <Button
          label={t('auth.welcome.guestCta')}
          size="lg"
          loading={isPending}
          onPress={() => {
            void run(signInAsGuest);
          }}
        />
        <Text variant="caption" tone="secondary" className="text-center">
          {t('auth.welcome.guestNote')}
        </Text>

        <Button
          label={t('auth.welcome.haveAccount')}
          variant="ghost"
          disabled={isPending}
          onPress={() => {
            router.push('/sign-in');
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
