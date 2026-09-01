import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Text } from '@/components/ui';
import { useDataExport } from '@/features/data-export/hooks/use-data-export';

/** Kopia wszystkich danych użytkownika w jednym pliku. */
export function ExportCard() {
  const { t } = useTranslation();
  const { isExporting, outcome, error, exportData } = useDataExport();

  return (
    <Card className="gap-4">
      <Text variant="title">{t('settings.export.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('settings.export.description')}
      </Text>

      {error !== null ? (
        <Banner tone="danger" message={t('settings.export.error')} />
      ) : null}
      {outcome === 'shared' ? (
        <Banner tone="success" message={t('settings.export.shared')} />
      ) : null}
      {outcome === 'unavailable' ? (
        <Banner message={t('settings.export.unavailable')} />
      ) : null}

      <Button
        label={t('settings.export.action')}
        variant="secondary"
        loading={isExporting}
        onPress={() => {
          void exportData();
        }}
      />
    </Card>
  );
}
