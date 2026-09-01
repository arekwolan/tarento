import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Banner, Button, ControlledTextField, Screen, Text } from '@/components/ui';
import { signUpSchema, signUpWithPassword, type SignUpValues } from '@/features/auth';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';
import { validationMessageKey } from '@/features/auth/model/validation-messages';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPending, errorKey, run, clearError } = useAuthAction();
  const [confirmationSent, setConfirmationSent] = useState(false);

  const { control, handleSubmit } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordConfirmation: '' },
  });

  const submit = handleSubmit(async (values) => {
    setConfirmationSent(false);
    await run(async () => {
      const { needsEmailConfirmation } = await signUpWithPassword(
        values.email,
        values.password,
      );
      // Gdy potwierdzenie nie jest wymagane, sesja pojawia się od razu
      // i route guard sam przeniesie użytkownika dalej.
      setConfirmationSent(needsEmailConfirmation);
    });
  });

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-1">
        <Text variant="titleLg">{t('auth.signUp.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('auth.signUp.subtitle')}
        </Text>
      </View>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
      {confirmationSent ? (
        <Banner tone="success" message={t('auth.signUp.confirmationSent')} />
      ) : null}

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
        <ControlledTextField
          control={control}
          messageKey={validationMessageKey}
          name="passwordConfirmation"
          label={t('auth.fields.passwordConfirmation')}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
        />
      </View>

      <Button
        label={t('auth.signUp.submit')}
        size="lg"
        loading={isPending}
        onPress={() => {
          void submit();
        }}
      />

      <Button
        label={t('auth.signUp.haveAccount')}
        variant="ghost"
        onPress={() => {
          router.push('/sign-in');
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
