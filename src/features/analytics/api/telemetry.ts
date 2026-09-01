import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import { createMMKV } from 'react-native-mmkv';

import type {
  AnalyticsEventName,
  AnalyticsEvents,
} from '@/features/analytics/model/events';

/**
 * Klucze telemetrii.
 *
 * Odstępstwo od reguły krytycznej 1 z CLAUDE.md, opisane w niej wprost:
 * DSN Sentry i klucz projektowy PostHog są kluczami *tylko do zapisu*.
 * Pozwalają wysłać zdarzenie i nic więcej — nie da się nimi odczytać
 * żadnych danych, więc ich obecność w bundlu nie tworzy powierzchni ataku.
 * Klucze odczytujące (service_role, Gemini) nadal nie mają tu wstępu.
 *
 * Brak zmiennej wyłącza dane narzędzie. Dzięki temu build deweloperski
 * nie zaśmieca produkcyjnych projektów, a repozytorium nie musi nieść
 * żadnego klucza.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const telemetryStorage = createMMKV({ id: 'tarento.telemetry' });

/** PostHog przyjmuje własny magazyn; używamy MMKV, żeby nie dokładać AsyncStorage. */
const posthogStorage = {
  getItem: (key: string): string | null => telemetryStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    telemetryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    telemetryStorage.remove(key);
  },
};

let posthog: PostHog | null = null;
let isInitialized = false;

export function isTelemetryConfigured(): boolean {
  return SENTRY_DSN !== undefined || POSTHOG_KEY !== undefined;
}

/**
 * Uruchamia telemetrię. Bezpieczne do wielokrotnego wywołania.
 *
 * `sendDefaultPii: false` jest tu kluczowe — bez tego Sentry dołączałby
 * adresy IP i nagłówki żądań do każdego raportu.
 */
export function initTelemetry(): void {
  if (isInitialized) return;
  isInitialized = true;

  if (SENTRY_DSN !== undefined) {
    Sentry.init({
      dsn: SENTRY_DSN,
      sendDefaultPii: false,
      // Ślady wydajności tylko z ułamka sesji — aplikacja jednoosobowa
      // nie potrzebuje pełnego profilu, a limity darmowego planu są niskie.
      tracesSampleRate: 0.1,
      enableAutoSessionTracking: true,
    });
  }

  if (POSTHOG_KEY !== undefined) {
    posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      customStorage: posthogStorage,
      // Zdarzenia ekranów zbieramy sami, nazwanymi zdarzeniami z katalogu.
      captureAppLifecycleEvents: false,
    });
  }
}

/**
 * Wiąże zdarzenia z kontem.
 *
 * Przekazujemy wyłącznie identyfikator (UUID) — bez adresu e-mail, nazwy
 * ani niczego, co dałoby się odczytać wprost.
 */
export function identifyUser(userId: string): void {
  Sentry.setUser({ id: userId });
  posthog?.identify(userId);
}

export function resetUser(): void {
  Sentry.setUser(null);
  void posthog?.reset();
}

/** Wysyła zdarzenie z katalogu. Kształt właściwości pilnuje typ. */
export function trackEvent<TName extends AnalyticsEventName>(
  name: TName,
  properties: AnalyticsEvents[TName],
): void {
  posthog?.capture(name, properties);
}

/** Raportuje wyjątek, który aplikacja obsłużyła sama. */
export function reportError(error: unknown, context?: Record<string, string>): void {
  Sentry.captureException(error, context === undefined ? undefined : { tags: context });
}
