import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Banner, Button, ControlledTextField, Screen, Text } from '@/components/ui';
import {
  forgotPasswordSchema,
  sendPasswordReset,
  type ForgotPasswordValues,
} from '@/features/auth';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';
import { validationMessageKey } from '@/features/auth/model/validation-messages';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPending, errorKey, run, clearError } = useAuthAction();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSent(false);
    const ok = await run(() => sendPasswordReset(values.email));
    setSent(ok);
  });

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-1">
        <Text variant="titleLg">{t('auth.forgotPassword.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('auth.forgotPassword.subtitle')}
        </Text>
      </View>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
      {sent ? <Banner tone="success" message={t('auth.forgotPassword.sent')} /> : null}

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

      <Button
        label={t('auth.forgotPassword.submit')}
        size="lg"
        loading={isPending}
        onPress={() => {
          void submit();
        }}
      />

      <Button
        label={t('auth.forgotPassword.backToSignIn')}
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
