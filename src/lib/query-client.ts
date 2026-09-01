import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import type {
  PersistedClient,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import { createMMKV } from 'react-native-mmkv';

import { persistReplacer, persistReviver } from '@/lib/persist-map';

/**
 * Czasy świeżości. Trzymane w jednym miejscu, żeby hooki nie rozjeżdżały się
 * z intencją: dane referencyjne można trzymać, dane z dzisiaj — nie.
 */
export const STALE_TIME = {
  /** Katalogi i cytaty: zmieniają się rzadko, warto oszczędzić zapytania. */
  reference: 5 * 60 * 1000,
  /** Nawyki użytkownika: zmieniają się przez UI, ale nie co sekundę. */
  habits: 60 * 1000,
  /** Wszystko, co dotyczy dzisiejszego dnia — zawsze uznawane za nieświeże. */
  today: 0,
} as const;

/** Cache musi przeżyć dłużej niż okno persystencji, inaczej GC go wyczyści. */
const GC_TIME = 24 * 60 * 60 * 1000;
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Wersja formatu cache'u. Podbij, gdy zmieni się kształt danych w kluczach —
 * stary snapshot zostanie wtedy odrzucony zamiast wczytany do nowego kodu.
 *
 * v2: dodano (de)serializację Map — patrz komentarz przy MAP_MARKER.
 * v3: ścieżki dostały prywatne provenance i pola etapów Laboratorium.
 * v4: odpowiedzi transferu i potwierdzenia wdrożenia są persystowane offline.
 * v5: historia wersji i kolejka przywrócenia nawyku mają własne klucze.
 * v6: enumy mapy tarcia oraz ich odpowiedzi mają persystowane mutacje.
 * v7: prywatne reguły W3 i ich audytowalne decyzje mają własne klucze.
 * v8: osobiste eksperymenty W4 i ich idempotentne akcje są persystowane.
 * v9: aktywacja prywatnego protokołu niesie idempotentny review konfliktów W5.
 * v10: historia ścieżek i doręczonych listów ma dane dla nowej Biblioteki.
 * v11: setupy etapów i ich wstrzymane decyzje mają osobny persystowany klucz.
 */
const CACHE_BUSTER = 'v11';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME.reference,
      gcTime: GC_TIME,
      retry: 2,
      refetchOnReconnect: true,
      // Ekran ma pokazać dane z cache'u od razu, nawet gdy są przeterminowane.
      // Odświeżenie doleci w tle.
      placeholderData: undefined,
    },
    mutations: {
      // networkMode 'online' (domyślny) wstrzymuje mutację bez sieci, ale
      // onMutate zdąży się wykonać — optimistic update zostaje na ekranie,
      // a żądanie czeka w kolejce do powrotu połączenia.
      retry: 3,
      gcTime: GC_TIME,
    },
  },
});

const cacheStorage = createMMKV({ id: 'tarento.query-cache' });

/** MMKV jest synchroniczne, więc wystarczy persister synchroniczny. */
export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string): string | null => cacheStorage.getString(key) ?? null,
    setItem: (key: string, value: string): void => {
      cacheStorage.set(key, value);
    },
    removeItem: (key: string): void => {
      cacheStorage.remove(key);
    },
  },
  key: 'tarento.query-cache',
  throttleTime: 1000,
  serialize: (client: PersistedClient) => JSON.stringify(client, persistReplacer),
  deserialize: (cached: string) => JSON.parse(cached, persistReviver) as PersistedClient,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    // Zapisujemy wstrzymane mutacje, żeby odhaczenie zrobione w metrze
    // przetrwało zamknięcie aplikacji i poszło na serwer po powrocie sieci.
    shouldDehydrateMutation: (mutation) => mutation.state.isPaused,
  },
};

/**
 * Stan sieci z NetInfo zamiast domyślnego detektora, który w React Native
 * nie ma czego nasłuchiwać. Bez tego mutacje nigdy nie zostałyby wstrzymane
 * i zamiast kolejki offline dostalibyśmy serię błędów.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  }),
);

/** Powrót aplikacji na wierzch traktujemy jak focus okna w przeglądarce. */
function handleAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

AppState.addEventListener('change', handleAppStateChange);

/**
 * Wołane po odtworzeniu cache'u z dysku: wypycha mutacje, które czekały
 * w kolejce od poprzedniego uruchomienia.
 */
export function resumeQueuedMutations(): void {
  void queryClient.resumePausedMutations();
}
