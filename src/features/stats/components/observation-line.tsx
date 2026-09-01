import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { Observation } from '@/features/stats/model/observation';

export type ObservationLineProps = {
  observation: Observation;
};

/**
 * Zdanie otwierające ekran postępów.
 *
 * Wariant `title`, bez ikony i bez akcentu: akcent niesie postęp, a to jest
 * obserwacja, nie wynik. Zdanie ma prawo zająć trzy linie przy powiększonej
 * czcionce — dlatego nie stoi obok niczego, co musiałoby się przy nim zmieścić.
 *
 * Parametry, które są tekstem interfejsu (nazwa dnia tygodnia, pora dnia),
 * tłumaczymy tutaj i podajemy do interpolacji. Nigdzie w tym przepływie nie
 * ma sklejania stringów.
 */
export function ObservationLine({ observation }: ObservationLineProps) {
  const { t } = useTranslation();

  const translated = Object.fromEntries(
    Object.entries(observation.keys ?? {}).map(([name, key]) => [name, t(key)]),
  );

  return (
    <Text variant="title" accessibilityRole="summary">
      {t(observation.key, { ...observation.values, ...translated })}
    </Text>
  );
}
