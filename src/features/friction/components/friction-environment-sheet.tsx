import { useTranslation } from 'react-i18next';

import { Button, Sheet, Text } from '@/components/ui';
import type { FrictionSuggestion } from '@/features/friction/model/friction';

export type FrictionEnvironmentSheetProps = {
  suggestion: FrictionSuggestion | null;
  habitTitle: string | null;
  isPending: boolean;
  onClose: () => void;
  onPrepared: () => void;
};

/** Jednorazowe przygotowanie otoczenia, bez tworzenia kolejnego trackera. */
export function FrictionEnvironmentSheet({
  suggestion,
  habitTitle,
  isPending,
  onClose,
  onPrepared,
}: FrictionEnvironmentSheetProps) {
  const { t } = useTranslation();

  if (suggestion === null || habitTitle === null) return null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('friction.prepare.title')}
      closeLabel={t('friction.prepare.close')}
    >
      <Text variant="body" tone="secondary">
        {t('friction.prepare.description', { habit: habitTitle })}
      </Text>
      <Text variant="body">{t('friction.prepare.step')}</Text>
      <Button
        label={t('friction.prepare.done')}
        loading={isPending}
        onPress={onPrepared}
      />
      <Button label={t('friction.prepare.close')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
