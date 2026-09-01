import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import type { PathCatalogEntry } from '@/features/paths/api/paths-api';
import { pathMinutes, type FitVerdict } from '@/features/paths/model/fit';
import type { PathStage } from '@/features/paths/model/schemas';

export type EnrollGateProps = {
  verdict: FitVerdict;
  stages: readonly PathStage[];
  /** Okno użytkownika w minutach. `null`, gdy nie ma jeszcze kształtu dnia. */
  windowMinutes: number | null;
  /**
   * Najkrótsza ścieżka z katalogu, która mieści się w oknie. `null`, gdy
   * takiej nie ma — wtedy zamiast propozycji zostaje droga powrotna.
   */
  alternative: PathCatalogEntry | null;
  isPending: boolean;
  /** `lite` mówi, czy zapisać wariant lekki. */
  onStart: (lite: boolean) => void;
  onOpenAlternative: (slug: string) => void;
  onBackToCatalog: () => void;
};

/**
 * Bramka budżetowa: ścieżka proponuje, budżet rozstrzyga.
 *
 * Przy werdykcie `blocked` nie ma przygaszonego przycisku bez wyjaśnienia —
 * jest konkretna liczba i jedna alternatywa. „Nie da się" bez powodu wygląda
 * jak awaria, a nie jak decyzja.
 */
export function EnrollGate({
  verdict,
  stages,
  windowMinutes,
  alternative,
  isPending,
  onStart,
  onOpenAlternative,
  onBackToCatalog,
}: EnrollGateProps) {
  const { t } = useTranslation();
  const minutes = pathMinutes(stages);

  // Bez kształtu dnia nie ma czego przycinać ani o czym informować:
  // zostaje sama akcja.
  if (windowMinutes === null) {
    return (
      <Button
        label={t('path.enroll.start')}
        size="lg"
        loading={isPending}
        onPress={() => {
          onStart(false);
        }}
      />
    );
  }

  if (verdict === 'blocked') {
    const alternativeMinutes =
      alternative === null ? null : pathMinutes(alternative.stages);

    return (
      <View className="gap-3">
        <Text variant="body" tone="secondary">
          {t('path.enroll.blocked', {
            peak: minutes.max,
            minutes: windowMinutes,
          })}
        </Text>

        {alternative === null || alternativeMinutes === null ? (
          <>
            <Text variant="body" tone="secondary">
              {t('path.enroll.blockedNoAlternative')}
            </Text>
            <Button
              label={t('path.enroll.backToCatalog')}
              variant="secondary"
              size="lg"
              onPress={onBackToCatalog}
            />
          </>
        ) : (
          <>
            <Text variant="body" tone="secondary">
              {t('path.enroll.blockedAlternative', {
                title: alternative.path.title,
                minutes: alternativeMinutes.max,
                days: alternative.path.durationDays,
              })}
            </Text>
            <Button
              label={t('path.enroll.blockedAction', { title: alternative.path.title })}
              size="lg"
              onPress={() => {
                onOpenAlternative(alternative.path.slug);
              }}
            />
          </>
        )}
      </View>
    );
  }

  const explanation =
    verdict === 'fits'
      ? t('path.enroll.fits', {
          start: minutes.start,
          peak: minutes.max,
          minutes: windowMinutes,
        })
      : verdict === 'tight'
        ? t('path.enroll.tight', { peak: minutes.max, minutes: windowMinutes })
        : t('path.enroll.lite', { peak: minutes.max, minutes: windowMinutes });

  // Przy werdykcie `lite` budżet już rozstrzygnął: pełna wersja nie zmieści
  // się w oknie, więc jedyną akcją jest wariant lekki.
  const isLite = verdict === 'lite';

  return (
    <View className="gap-3">
      <Text variant="body" tone="secondary">
        {explanation}
      </Text>
      <Button
        label={t(isLite ? 'path.enroll.startLite' : 'path.enroll.start')}
        size="lg"
        loading={isPending}
        onPress={() => {
          onStart(isLite);
        }}
      />
    </View>
  );
}
