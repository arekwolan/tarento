import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '@/components/ui';
import type { Letter } from '@/features/letters/model/letter';
import { formatFullDay, type SupportedLocale } from '@/lib/date';

export type LetterCardProps = {
  letter: Letter;
  locale: SupportedLocale;
  onDismiss: () => void;
};

/**
 * List sprzed roku, na górze ekranu „Dziś".
 *
 * Karta, nie arkusz i nie powiadomienie: rzecz, która wraca po roku, ma
 * zaczekać, aż użytkownik sam otworzy aplikację. Bez akcentu, bez ikony
 * i bez gratulacji — to jego własny tekst, nie nagroda od aplikacji.
 */
export function LetterCard({ letter, locale, onDismiss }: LetterCardProps) {
  const { t } = useTranslation();

  return (
    <Card variant="raised" className="gap-3">
      <Text variant="title">{t('letter.delivered.title')}</Text>
      <Text variant="caption" tone="tertiary">
        {formatFullDay(letter.writtenOn, locale)}
      </Text>
      <Text variant="quote">{letter.body}</Text>
      <Button
        label={t('letter.delivered.close')}
        variant="secondary"
        onPress={onDismiss}
      />
    </Card>
  );
}
