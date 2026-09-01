import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { updateProfileSettings } from '@/features/auth/api/auth-api';
import { useAuth } from '@/features/auth/use-auth';
import { authErrorKeyOf, type AuthErrorKey } from '@/features/auth/model/errors';
import { supportedLanguages, type SupportedLanguage } from '@/i18n';

export type UseProfileSettingsResult = {
  language: SupportedLanguage;
  dayStartHour: number;
  /** Ile pozycji maksymalnie widać na liście „Dziś". */
  dailyCeiling: number;
  isSaving: boolean;
  errorKey: AuthErrorKey | null;
  setLanguage: (language: SupportedLanguage) => void;
  setDayStartHour: (hour: number) => void;
  setDailyCeiling: (ceiling: number) => void;
};

/** Ta sama wartość co domyślna w kolumnie profiles.day_start_hour. */
const DEFAULT_DAY_START_HOUR = 4;

/** Ta sama wartość co domyślna w kolumnie profiles.daily_ceiling. */
const DEFAULT_DAILY_CEILING = 5;

function toSupportedLanguage(value: string | undefined): SupportedLanguage {
  return supportedLanguages.find((candidate) => candidate === value) ?? 'pl';
}

/**
 * Ustawienia trzymane w profilu: język, godzina rozpoczęcia doby i sufit
 * liczby pozycji na dziś.
 *
 * Zmiana języka przestawia i18next od razu, a zapis do bazy leci w tle —
 * interfejs nie ma czekać na sieć, żeby przełączyć etykiety.
 */
export function useProfileSettings(): UseProfileSettingsResult {
  const { i18n } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);

  const userId = user?.id ?? null;

  const save = useCallback(
    (input: Parameters<typeof updateProfileSettings>[1]) => {
      if (userId === null) return;

      setIsSaving(true);
      setErrorKey(null);

      void updateProfileSettings(userId, input)
        .then(() => refreshProfile())
        .catch((error: unknown) => {
          setErrorKey(authErrorKeyOf(error));
        })
        .finally(() => {
          setIsSaving(false);
        });
    },
    [userId, refreshProfile],
  );

  const setLanguage = useCallback(
    (language: SupportedLanguage) => {
      void i18n.changeLanguage(language);
      save({ locale: language });
    },
    [i18n, save],
  );

  const setDayStartHour = useCallback(
    (hour: number) => {
      save({ dayStartHour: hour });
    },
    [save],
  );

  const setDailyCeiling = useCallback(
    (ceiling: number) => {
      save({ dailyCeiling: ceiling });
    },
    [save],
  );

  return {
    language: toSupportedLanguage(profile?.locale ?? i18n.language),
    dayStartHour: profile?.dayStartHour ?? DEFAULT_DAY_START_HOUR,
    dailyCeiling: profile?.dailyCeiling ?? DEFAULT_DAILY_CEILING,
    isSaving,
    errorKey,
    setLanguage,
    setDayStartHour,
    setDailyCeiling,
  };
}
