import { useState } from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, ControlledTextField, Text } from '@/components/ui';
import { linkEmailToCurrentUser } from '@/features/auth/api/auth-api';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';
import { validationMessageKey } from '@/features/auth/model/validation-messages';
import { linkEmailSchema, type LinkEmailValues } from '@/features/auth/model/schemas';

/**
 * Wyjście z trybu gościa: konto anonimowe dostaje adres i hasło.
 *
 * To ten sam wiersz w auth.users, więc nawyki, wpisy i serie zostają —
 * bez tej ścieżki tryb gościa byłby pułapką na dane.
 */
export function GuestUpgradeCard() {
  const { t } = useTranslation();
  const { isPending, errorKey, run, clearError } = useAuthAction();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, reset } = useForm<LinkEmailValues>({
    resolver: zodResolver(linkEmailSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSent(false);
    const ok = await run(() => linkEmailToCurrentUser(values.email, values.password));
    if (ok) {
      setSent(true);
      reset({ email: values.email, password: '' });
    }
  });

  return (
    <Card className="gap-4">
      <Text variant="title">{t('auth.guest.upgradeTitle')}</Text>
      <Text variant="body" tone="secondary">
        {t('auth.guest.upgradeDescription')}
      </Text>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
      {sent ? <Banner tone="success" message={t('auth.guest.upgradeSent')} /> : null}

      <View className="gap-4">
        <ControlledTextField
          control={control}
          messageKey={validationMessageKey}
          name="email"
          label={t('auth.fields.email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          onValueChange={clearError}
        />
        <ControlledTextField
          control={control}
          messageKey={validationMessageKey}
          name="password"
          label={t('auth.fields.password')}
          hint={t('auth.fields.passwordHint')}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
        />
      </View>

      <Button
        label={t('auth.guest.upgradeSubmit')}
        loading={isPending}
        onPress={() => {
          void submit();
        }}
      />
    </Card>
  );
}
