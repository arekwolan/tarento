import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Screen, Text } from '@/components/ui';
import type { TranslationKey } from '@/i18n/keys';

/**
 * Sekcje polityki prywatności.
 *
 * Kolejność jest celowa: najpierw co zbieramy, zaraz potem czego nie —
 * druga lista odpowiada na pytanie, które i tak zada każdy, kto czyta pierwszą.
 */
const SECTIONS = [
  { title: 'privacy.controller.title', body: 'privacy.controller.body' },
  { title: 'privacy.collected.title', body: 'privacy.collected.body' },
  { title: 'privacy.notCollected.title', body: 'privacy.notCollected.body' },
  { title: 'privacy.analytics.title', body: 'privacy.analytics.body' },
  { title: 'privacy.errors.title', body: 'privacy.errors.body' },
  { title: 'privacy.notifications.title', body: 'privacy.notifications.body' },
  { title: 'privacy.storage.title', body: 'privacy.storage.body' },
  { title: 'privacy.retention.title', body: 'privacy.retention.body' },
  { title: 'privacy.rights.title', body: 'privacy.rights.body' },
  { title: 'privacy.changes.title', body: 'privacy.changes.body' },
] as const satisfies readonly { title: TranslationKey; body: TranslationKey }[];

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-2">
        <Text variant="titleLg" accessibilityRole="header">
          {t('privacy.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('privacy.intro')}
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} className="gap-2">
          <Divider />
          <Text variant="title" accessibilityRole="header">
            {t(section.title)}
          </Text>
          <Text variant="body" tone="secondary">
            {t(section.body)}
          </Text>
        </View>
      ))}

      <Button
        label={t('common.back')}
        variant="secondary"
        onPress={() => {
          router.back();
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
