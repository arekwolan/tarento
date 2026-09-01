import { Card, Button, Text } from '@/components/ui';
import type { StageTransferCheck } from '@/features/paths/api/use-stage-advance';
import { useTranslation } from 'react-i18next';

export type PathTransferCardProps = {
  ready: StageTransferCheck;
  onPress: () => void;
};

/** Gotowość etapu jest zaproszeniem do sprawdzenia, nie automatyczną promocją. */
export function PathTransferCard({ ready, onPress }: PathTransferCardProps) {
  const { t } = useTranslation();

  return (
    <Card variant="raised" className="gap-3">
      <Text variant="title">{t('path.transfer.readyTitle')}</Text>
      <Text variant="body" tone="secondary">
        {t(
          ready.reason === 'ceiling'
            ? 'path.transfer.readyCeiling'
            : 'path.transfer.readyDescription',
        )}
      </Text>
      <Button label={t('path.transfer.open')} onPress={onPress} />
    </Card>
  );
}
