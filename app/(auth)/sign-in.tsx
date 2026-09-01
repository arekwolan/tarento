import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import {
  Banner,
  Button,
  ControlledTextField,
  Divider,
  Screen,
  Text,
} from '@/components/ui';
import {
  sendMagicLink,
  signInWithPassword,
  signInSchema,
  type SignInValues,
} from '@/features/auth';
import { useAuthAction } from '@/features/auth/hooks/use-auth-action';
import { validationMessageKey } from '@/features/auth/model/validation-messages';
import { magicLinkSchema } from '@/features/auth/model/schemas';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPending, errorKey, run, clearError } = useAuthAction();
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const { control, handleSubmit, getValues } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setMagicLinkSent(false);
    await run(() => signInWithPassword(values.email, values.password));
  });

  /**
   * Magic link potrzebuje tylko adresu, więc walidujemy sam ten kawałek
   * zamiast zmuszać do wpisania hasła, którego użytkownik może nie pamiętać.
   */
  const requestMagicLink = async () => {
    const parsed = magicLinkSchema.safeParse({ email: getValues('email') });
    if (!parsed.success) {
      await submit();
      return;
    }

    setMagicLinkSent(false);
    const ok = await run(() => sendMagicLink(parsed.data.email));
    setMagicLinkSent(ok);
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-1">
        <Text variant="titleLg">{t('auth.signIn.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('auth.signIn.subtitle')}
        </Text>
      </View>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
      {magicLinkSent ? (
        <Banner tone="success" message={t('auth.signIn.magicLinkSent')} />
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
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
        />
      </View>

      <Button
        label={t('auth.signIn.submit')}
        size="lg"
        loading={isPending}
        onPress={() => {
          void submit();
        }}
      />

      <View className="flex-row items-center gap-3">
        <Divider className="flex-1" />
        <Text variant="caption" tone="secondary">
          {t('auth.signIn.orDivider')}
        </Text>
        <Divider className="flex-1" />
      </View>

      <Button
        label={t('auth.signIn.magicLink')}
        variant="secondary"
        disabled={isPending}
        onPress={() => {
          void requestMagicLink();
        }}
      />

      <View className="gap-1">
        <Button
          label={t('auth.signIn.forgotPassword')}
          variant="ghost"
          onPress={() => {
            router.push('/forgot-password');
          }}
        />
        <Button
          label={t('auth.signIn.noAccount')}
          variant="ghost"
          onPress={() => {
            router.push('/sign-up');
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
