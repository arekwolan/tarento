import type { ExpoConfig } from 'expo/config';

/**
 * Identyfikator projektu EAS wstrzykiwany ze środowiska.
 *
 * Nie jest zaszyty w repozytorium, bo wiąże build z konkretnym kontem —
 * `eas init` ustawia go lokalnie, a CI dostaje przez zmienną.
 */
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Tarento',
  slug: 'tarento',
  scheme: 'tarento',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // 'automatic' jest wymagane, żeby aplikacja podążała za motywem systemu.
  // Nadpisanie użytkownika obsługuje ThemeProvider (@/theme/theme-provider).
  userInterfaceStyle: 'automatic',
  // Aktualizacje OTA muszą trafiać tylko do buildów o zgodnym kodzie natywnym.
  runtimeVersion: { policy: 'appVersion' },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    // NIE WOLNO tego zmienić po pierwszej publikacji w sklepie.
    // App Store i Google Play traktują identyfikator jako tożsamość aplikacji:
    // po zmianie powstaje NOWA pozycja w sklepie, a dotychczasowi użytkownicy
    // zostają na starej wersji bez możliwości aktualizacji.
    bundleIdentifier: 'com.tarento.app',
    infoPlist: {
      // Powiadomienia planujemy lokalnie, więc tło nie jest potrzebne.
      UIBackgroundModes: [],
    },
  },
  android: {
    // NIE WOLNO tego zmienić po pierwszej publikacji w sklepie — patrz komentarz
    // przy ios.bundleIdentifier. Oba identyfikatory trzymamy takie same.
    package: 'com.tarento.app',
    adaptiveIcon: {
      // Tokeny systemu designu: background (jasny) — patrz global.css.
      backgroundColor: '#F5F6F7',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Jedyne uprawnienie, jakiego aplikacja potrzebuje.
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    // Autolinking bibliotek potrafi wciągnąć uprawnienia, których nie używamy.
    blockedPermissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_CONTACTS',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-localization',
    // Kroje wczytuje useAppFonts() z @/theme/fonts w czasie działania —
    // plugin odpowiada tylko za konfigurację natywną modułu.
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        // Tokeny `background` z obu motywów. Splash musi zgadzać się z tłem
        // pierwszego ekranu, inaczej start miga innym kolorem.
        backgroundColor: '#F5F6F7',
        dark: { backgroundColor: '#131619' },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        // Token `accent-fill` — jedyne miejsce poza aplikacją, gdzie akcent
        // niesie znaczenie (ikona powiadomienia o nawyku).
        color: '#C9922B',
        defaultChannel: 'habit-reminders',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: easProjectId === undefined ? {} : { eas: { projectId: easProjectId } },
};

export default config;
