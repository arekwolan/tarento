import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components/ui';
import type { Recall, RecallOffset } from '@/features/journal/model/day-note';
import type { TranslationKey } from '@/i18n/keys';

const HEADING: Record<RecallOffset, TranslationKey> = {
  365: 'journal.recall.year',
  90: 'journal.recall.quarter',
  30: 'journal.recall.month',
};

export type RecallCardProps = {
  recall: Recall | null;
};

/**
 * Zdanie sprzed miesiąca, kwartału albo roku.
 *
 * Właściwy produkt dziennika. Bez akcji, bez „odpowiedz", bez porównania
 * z dzisiaj — przypomnienie ma tylko wrócić, a co z nim zrobić, należy do
 * użytkownika i do jego głowy, nie do aplikacji.
 */
export function RecallCard({ recall }: RecallCardProps) {
  const { t } = useTranslation();

  if (recall === null) return null;

  return (
    <Card className="gap-2">
      <Text variant="caption" tone="tertiary">
        {t(HEADING[recall.offset])}
      </Text>
      <Text variant="body">{recall.note.body}</Text>
    </Card>
  );
}
