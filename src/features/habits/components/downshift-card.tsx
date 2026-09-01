import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '@/components/ui';

export type DownshiftCardProps = {
  /** Ile dni z próbki zostało odhaczonych. */
  completed: number;
  /** Wielkość próbki w dniach z harmonogramu. */
  scheduled: number;
  isPending: boolean;
  onPress: () => void;
};

/**
 * Propozycja zmniejszenia nawyku.
 *
 * Wyłącznie tutaj: nie powiadomienie, nie baner na ekranie „Dziś", nie modal
 * przy starcie. Użytkownik przychodzi po ten nawyk sam, a wtedy zdanie o nim
 * jest informacją, a nie zaczepką.
 *
 * Bez `danger` i bez `warning` — to nie jest ostrzeżenie (CLAUDE.md, reguła 7).
 * Ton karty jest opisowy: prośba była za duża i tyle z tego wynika.
 */
export function DownshiftCard({
  completed,
  scheduled,
  isPending,
  onPress,
}: DownshiftCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Text variant="title">{t('habits.downshift.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('habits.downshift.body', { completed, scheduled })}
      </Text>
      <Button
        label={t('habits.downshift.action')}
        variant="secondary"
        loading={isPending}
        disabled={isPending}
        onPress={onPress}
      />
    </Card>
  );
}
