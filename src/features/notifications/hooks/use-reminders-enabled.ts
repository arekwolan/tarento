import { useCallback } from 'react';
import { createMMKV, useMMKVBoolean } from 'react-native-mmkv';

const REMINDERS_ENABLED_KEY = 'notifications.remindersEnabled';

/**
 * Globalny przełącznik powiadomień.
 *
 * Trzymany lokalnie, nie w profilu: zgoda systemowa i zaplanowane
 * powiadomienia są własnością urządzenia, więc wyciszenie na telefonie
 * nie powinno wyłączać przypomnień na tablecie.
 */
export const notificationsStorage = createMMKV({ id: 'tarento.notifications' });

export type UseRemindersEnabledResult = {
  isEnabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
};

export function useRemindersEnabled(): UseRemindersEnabledResult {
  const [stored, setStored] = useMMKVBoolean(REMINDERS_ENABLED_KEY, notificationsStorage);

  // Domyślnie włączone — użytkownik, który przeszedł przez zgodę systemową,
  // nie musi jeszcze raz potwierdzać tego samego w aplikacji.
  const isEnabled = stored ?? true;

  const setEnabled = useCallback(
    (value: boolean) => {
      setStored(value);
    },
    [setStored],
  );

  const toggle = useCallback(() => {
    setStored((current) => !(current ?? true));
  }, [setStored]);

  return { isEnabled, setEnabled, toggle };
}

/** Odczyt poza Reactem — dla kodu uzgadniającego plan powiadomień. */
export function readRemindersEnabled(): boolean {
  return notificationsStorage.getBoolean(REMINDERS_ENABLED_KEY) ?? true;
}
