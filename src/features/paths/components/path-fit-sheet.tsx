import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Sheet, Text } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { PathFit, PathPractice } from '@/features/paths/model/schemas';

export type PathFitSheetProps = {
  /** `null` zamyka arkusz. */
  fit: PathFit | null;
  practices: readonly PathPractice[];
  isPending: boolean;
  /** Zapis z dopasowaniem. */
  onConfirm: () => void;
  /** Zapis bez dopasowania — pełna ścieżka z katalogu. */
  onSkipFit: () => void;
  onClose: () => void;
};

/**
 * Przegląd dopasowania przed zapisem.
 *
 * Wynik modelu nigdy nie stosuje się automatycznie: użytkownik widzi każdą
 * różnicę jako osobną linię i ma obok siebie dwie drogi — z dopasowaniem
 * i bez niego. „Bez dopasowania" jest ghostem, nie dlatego, że jest gorsze,
 * tylko dlatego, że na ekran jedna akcja główna.
 */
export function PathFitSheet({
  fit,
  practices,
  isPending,
  onConfirm,
  onSkipFit,
  onClose,
}: PathFitSheetProps) {
  const { t } = useTranslation();

  if (fit === null) return null;

  const byId = new Map(practices.map((practice) => [practice.id, practice]));

  const describeValue = (practice: PathPractice, value: number): string => {
    const unitKey = targetUnitKey(practice.unit);
    const unit = unitKey === null ? '' : ` ${t(unitKey)}`;

    return `${formatTargetValue(value)}${unit}`;
  };

  const skipLines = fit.skip.flatMap((id) => {
    const practice = byId.get(id);
    return practice === undefined
      ? []
      : [{ key: `skip-${id}`, text: t('path.fit.skip', { title: practice.title }) }];
  });

  const adjustLines = fit.adjust.flatMap((entry) => {
    const practice = byId.get(entry.practiceId);
    if (practice === undefined) return [];

    return [
      {
        key: `adjust-${entry.practiceId}`,
        text: t('path.fit.adjust', {
          title: practice.title,
          value: describeValue(practice, entry.startValue),
          original: describeValue(practice, practice.startValue),
        }),
      },
    ];
  });

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('path.fit.title')}
      closeLabel={t('path.fit.close')}
    >
      {fit.note === '' ? null : (
        <Text variant="body" tone="secondary">
          {fit.note}
        </Text>
      )}

      <View className="gap-2">
        {fit.lite ? <Text variant="bodyLg">{t('path.fit.lite')}</Text> : null}
        {[...skipLines, ...adjustLines].map((line) => (
          <Text key={line.key} variant="bodyLg">
            {line.text}
          </Text>
        ))}
      </View>

      <Button
        label={t('path.fit.confirm')}
        size="lg"
        loading={isPending}
        disabled={isPending}
        onPress={onConfirm}
      />
      <Button
        label={t('path.fit.withoutFit')}
        variant="ghost"
        disabled={isPending}
        onPress={onSkipFit}
      />
    </Sheet>
  );
}
