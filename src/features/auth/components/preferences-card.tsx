import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Card, Chip, Divider, Text } from '@/components/ui';
import { useProfileSettings } from '@/features/auth/hooks/use-profile-settings';
import { supportedLanguages } from '@/i18n';
import type { TranslationKey } from '@/i18n/keys';

const LANGUAGE_LABEL = {
  pl: 'settings.language.pl',
  en: 'settings.language.en',
} as const satisfies Record<string, TranslationKey>;

/** Godziny dopuszczone przez CHECK na profiles.day_start_hour. */
const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Sufit liczby pozycji na dziś. Ostatnia wartość to górna granica CHECK-a
 * na profiles.daily_ceiling — w praktyce brak limitu, bo tylu nawyków na
 * jeden dzień i tak nikt nie prowadzi.
 */
const DAILY_CEILINGS = [3, 5, 8, 12];
const UNLIMITED_CEILING = 12;

/** Ustawienia trzymane w profilu: język, granica doby i sufit listy na dziś. */
export function PreferencesCard() {
  const { t } = useTranslation();
  const {
    language,
    dayStartHour,
    dailyCeiling,
    errorKey,
    setLanguage,
    setDayStartHour,
    setDailyCeiling,
  } = useProfileSettings();

  return (
    <Card className="gap-4">
      <Text variant="title">{t('settings.language.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('settings.language.description')}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {supportedLanguages.map((candidate) => (
          <Chip
            key={candidate}
            label={t(LANGUAGE_LABEL[candidate])}
            selected={language === candidate}
            onPress={() => {
              setLanguage(candidate);
            }}
          />
        ))}
      </View>

      <Divider />

      <Text variant="title">{t('settings.dayStart.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('settings.dayStart.description')}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {DAY_START_HOURS.map((hour) => (
          <Chip
            key={hour}
            label={t('settings.dayStart.hour', { hour })}
            selected={dayStartHour === hour}
            onPress={() => {
              setDayStartHour(hour);
            }}
          />
        ))}
      </View>

      <Divider />

      <Text variant="title">{t('settings.dailyCeiling.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('settings.dailyCeiling.description')}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {DAILY_CEILINGS.map((option) => (
          <Chip
            key={option}
            label={
              option === UNLIMITED_CEILING
                ? t('settings.dailyCeiling.unlimited')
                : String(option)
            }
            selected={dailyCeiling === option}
            onPress={() => {
              setDailyCeiling(option);
            }}
          />
        ))}
      </View>

      {errorKey === null ? null : <Banner tone="danger" message={t(errorKey)} />}
    </Card>
  );
}
