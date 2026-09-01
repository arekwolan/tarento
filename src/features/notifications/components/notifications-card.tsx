import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Divider, Text } from '@/components/ui';
import { useNotificationPermission } from '@/features/notifications/hooks/use-notification-permission';
import { useQuietWeek } from '@/features/notifications/hooks/use-quiet-week';
import { useRemindersEnabled } from '@/features/notifications/hooks/use-reminders-enabled';
import { formatFullDay, type SupportedLocale } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';

/**
 * Globalny przełącznik przypomnień.
 *
 * Wyłączenie kasuje wszystko, co zaplanowane — uzgadnianie planu widzi flagę
 * i przy następnym przebiegu nie dokłada nic nowego.
 */
export function NotificationsCard() {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const { isEnabled, setEnabled } = useRemindersEnabled();
  const { status, isRequesting, request } = useNotificationPermission();
  const { endsOn, endNow, isEnding } = useQuietWeek();

  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';

  return (
    <Card className="gap-4">
      <Text variant="title">{t('settings.notifications.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('settings.notifications.description')}
      </Text>

      <Divider />

      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text variant="bodyLg">{t('settings.notifications.toggle')}</Text>
          <Text variant="caption" tone="tertiary">
            {t(isEnabled ? 'settings.notifications.on' : 'settings.notifications.off')}
          </Text>
        </View>

        <Switch
          value={isEnabled}
          onValueChange={setEnabled}
          accessibilityLabel={t('settings.notifications.toggle')}
          trackColor={{ true: color('action'), false: color('border') }}
          thumbColor={color('surface-elevated')}
        />
      </View>

      {/*
        Jedyny ślad cichego tygodnia w całym interfejsie. Bez banera na ekranie
        „Dziś", bez powiadomienia i bez wyjaśnienia, dlaczego się zaczął —
        aplikacja robi się cichsza, a nie gadatliwsza.
      */}
      {endsOn === null ? null : (
        <View className="gap-2">
          <Text variant="caption" tone="tertiary">
            {t('settings.notifications.quietUntil', {
              date: formatFullDay(endsOn, locale),
            })}
          </Text>
          <Button
            label={t('settings.notifications.quietResume')}
            variant="ghost"
            loading={isEnding}
            disabled={isEnding}
            onPress={endNow}
          />
        </View>
      )}

      {status === 'denied' ? (
        <Banner message={t('settings.notifications.permissionDenied')} />
      ) : null}

      {status === 'undetermined' ? (
        <Button
          label={t('settings.notifications.askPermission')}
          variant="secondary"
          loading={isRequesting}
          onPress={() => {
            void request();
          }}
        />
      ) : null}
    </Card>
  );
}
