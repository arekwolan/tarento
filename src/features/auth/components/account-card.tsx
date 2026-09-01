import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Divider, Text } from '@/components/ui';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';
import { useAuth } from '@/features/auth/use-auth';

export function AccountCard() {
  const { t } = useTranslation();
  const { user, isGuest, signOut, deleteAccount } = useAuth();
  const { isPending, errorKey, run } = useAuthAction();

  const confirmSignOut = () => {
    Alert.alert(
      t('settings.account.signOutConfirmTitle'),
      isGuest
        ? t('auth.guest.signOutWarning')
        : t('settings.account.signOutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.account.signOutConfirm'),
          style: 'destructive',
          onPress: () => {
            void run(signOut);
          },
        },
      ],
    );
  };

  /**
   * Podwójne potwierdzenie: kasowanie konta jest nieodwracalne i idzie przez
   * delete_user_account(), która czyści też wiersz w auth.users.
   */
  const confirmDelete = () => {
    Alert.alert(
      t('settings.account.deleteFirstTitle'),
      t('settings.account.deleteFirstMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.account.deleteFirstConfirm'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.account.deleteSecondTitle'),
              t('settings.account.deleteSecondMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('settings.account.deleteSecondConfirm'),
                  style: 'destructive',
                  onPress: () => {
                    void run(deleteAccount);
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <Card className="gap-4">
      <Text variant="title">{t('settings.account.title')}</Text>

      {isGuest ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t('auth.guest.badge')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('settings.account.guestDescription')}
          </Text>
        </View>
      ) : (
        <Text variant="body" tone="secondary">
          {t('settings.account.signedInAs', { email: user?.email ?? '—' })}
        </Text>
      )}

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}

      <Divider />

      <View className="gap-2">
        <Button
          label={t('settings.account.signOut')}
          variant="secondary"
          disabled={isPending}
          onPress={confirmSignOut}
        />
        <Button
          label={t('settings.account.delete')}
          variant="destructive"
          disabled={isPending}
          onPress={confirmDelete}
        />
      </View>
    </Card>
  );
}
