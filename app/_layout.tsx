// Wejście stylów NativeWind. Jedyny dozwolony import względny w górę —
// global.css leży w korzeniu repo, poza aliasem @/.
import '../global.css';
// Inicjalizacja i18next musi wykonać się przed pierwszym renderem.
import '@/i18n';

import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useTranslation } from 'react-i18next';

import { Banner, ToastProvider } from '@/components/ui';
import { initTelemetry, useAnalyticsIdentity } from '@/features/analytics';
import { AuthProvider, useAuth, useAuthDeepLinks } from '@/features/auth';
import { registerPersonalExperimentMutationDefaults } from '@/features/experiments';
import { registerFrictionMutationDefaults } from '@/features/friction';
import { registerHabitMutationDefaults } from '@/features/habits';
import { registerPathMutationDefaults } from '@/features/paths';
import { registerQuoteMutationDefaults } from '@/features/quotes';
import { registerSelfRuleMutationDefaults } from '@/features/self-knowledge';
import { useNotificationDeepLink, useReminderReconcile } from '@/features/notifications';
import { persistOptions, queryClient, resumeQueuedMutations } from '@/lib/query-client';
import { FontProvider, useAppFonts } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

// Wstrzymane mutacje wczytane z dysku muszą wiedzieć, co wywołać. Rejestracja
// na poziomie modułu wykonuje się przed pierwszym resumeQueuedMutations().
// Telemetria startuje przed pierwszym renderem, żeby złapać też błędy montowania.
initTelemetry();
registerHabitMutationDefaults();
registerPersonalExperimentMutationDefaults();
registerFrictionMutationDefaults();
registerPathMutationDefaults();
registerQuoteMutationDefaults();
registerSelfRuleMutationDefaults();

// Splash trzyma ekran do czasu, aż wstaną fonty i ustali się sesja. Bez tego
// pierwszy render pokazałby krój systemowy, a chwilę później podmienił go na
// właściwy — czyli skok całej typografii na oczach użytkownika.
void SplashScreen.preventAutoHideAsync();

/** Komunikat o feralnym linku z maila, nad nawigacją. */
function DeepLinkError({ message }: { message: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute inset-x-0 top-0 z-10 px-5"
      style={{ paddingTop: insets.top + 8 }}
      pointerEvents="none"
    >
      <Banner tone="danger" message={message} />
    </View>
  );
}

function RootNavigator() {
  const { t } = useTranslation();
  const { color, scheme } = useTheme();
  const { isBootstrapping, isSignedIn, needsOnboarding } = useAuth();
  // Domyka linki z maili niezależnie od tego, na którym ekranie jesteśmy.
  const { errorKey: deepLinkErrorKey } = useAuthDeepLinks();
  // Zaplanowane powiadomienia mają nadążać za nawykami, odhaczeniami i strefą.
  useAnalyticsIdentity();
  useReminderReconcile();
  useNotificationDeepLink();

  useEffect(() => {
    if (isBootstrapping) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [isBootstrapping]);

  // Splash nadal zasłania ekran — nie ma po co renderować nawigatora.
  if (isBootstrapping) return null;

  return (
    <View className="flex-1">
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color('background') },
        }}
      >
        {/*
          Guardy zamiast ręcznych przekierowań: expo-router sam odmontowuje
          niedostępne grupy, więc nie ma mignięcia ekranu, który za chwilę
          zostałby podmieniony.
        */}
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isSignedIn && needsOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={isSignedIn && !needsOnboarding}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="habit" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="paths" />
          <Stack.Screen name="book-lab" />
        </Stack.Protected>
      </Stack>

      {deepLinkErrorKey === null ? null : <DeepLinkError message={t(deepLinkErrorKey)} />}
    </View>
  );
}

export default function RootLayout() {
  const fontStatus = useAppFonts();

  // Nic nie renderujemy, dopóki kroje się nie ustalą — splash zostaje na ekranie.
  if (!fontStatus.isSettled) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <FontProvider status={fontStatus}>
          <ThemeProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={persistOptions}
              onSuccess={resumeQueuedMutations}
            >
              <AuthProvider>
                <ToastProvider>
                  <RootNavigator />
                </ToastProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </ThemeProvider>
        </FontProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
