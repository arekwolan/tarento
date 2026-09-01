import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '@/components/ui';

export type RetirementCardProps = {
  /** Ile dni z próbki zostało odhaczonych. */
  completed: number;
  /** Wielkość próbki w dniach z harmonogramu. */
  scheduled: number;
  isPending: boolean;
  onRetire: () => void;
  onKeep: () => void;
};

/**
 * Propozycja zdjęcia nawyku z listy.
 *
 * Wyłącznie w szczegółach nawyku: nigdy powiadomienie, nigdy modal. To nie
 * jest nagroda ani ukończenie poziomu — nie ma tu słowa „opanowany", odznaki
 * ani propozycji, żeby w to miejsce dodać coś nowego. Jest jedna informacja
 * i dwie drogi.
 */
export function RetirementCard({
  completed,
  scheduled,
  isPending,
  onRetire,
  onKeep,
}: RetirementCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Text variant="title">{t('habits.retirement.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('habits.retirement.body', { completed, scheduled })}
      </Text>
      <Button
        label={t('habits.retirement.retire')}
        loading={isPending}
        disabled={isPending}
        onPress={onRetire}
      />
      <Button
        label={t('habits.retirement.keep')}
        variant="ghost"
        disabled={isPending}
        onPress={onKeep}
      />
    </Card>
  );
}
