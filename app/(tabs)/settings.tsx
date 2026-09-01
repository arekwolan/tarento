import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Card, Divider, Screen, Text } from '@/components/ui';
import { AccountCard, GuestUpgradeCard, useAuth } from '@/features/auth';
import { PreferencesCard } from '@/features/auth/components/preferences-card';
import { ExportCard } from '@/features/data-export';
import { RestDaysCard } from '@/features/day-budget';
import { NotificationsCard } from '@/features/notifications';
import { themePreferences, useTheme, type ThemePreference } from '@/theme/theme-provider';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { preference, setPreference } = useTheme();
  const { isGuest } = useAuth();

  const appearanceLabel: Record<ThemePreference, string> = {
    system: t('settings.appearance.system'),
    light: t('settings.appearance.light'),
    dark: t('settings.appearance.dark'),
  };

  return (
    <Screen scroll>
      <Text variant="titleLg" accessibilityRole="header">
        {t('settings.title')}
      </Text>

      {isGuest ? <GuestUpgradeCard /> : null}

      <AccountCard />

      <Card className="gap-4">
        <Text variant="title">{t('settings.appearance.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('settings.appearance.description')}
        </Text>
        <Divider />
        <View className="gap-2">
          {themePreferences.map((option) => (
            <Button
              key={option}
              label={appearanceLabel[option]}
              variant={preference === option ? 'primary' : 'secondary'}
              onPress={() => {
                setPreference(option);
              }}
            />
          ))}
        </View>
      </Card>

      <PreferencesCard />

      <RestDaysCard />

      <NotificationsCard />

      <ExportCard />

      <Card className="gap-4">
        <Text variant="title">{t('settings.privacy.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('settings.privacy.description')}
        </Text>
        <Button
          label={t('settings.privacy.action')}
          variant="secondary"
          onPress={() => {
            router.push('/privacy');
          }}
        />
      </Card>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
