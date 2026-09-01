import { useCallback, useState } from 'react';

import {
  exportUserDataToFile,
  type ExportOutcome,
} from '@/features/data-export/api/export-api';
import { toDataError, type DataError } from '@/lib/data-error';

export type UseDataExportResult = {
  isExporting: boolean;
  outcome: ExportOutcome | null;
  error: DataError | null;
  exportData: () => Promise<void>;
};

/** Eksport danych do pliku JSON i przekazanie go dalej przez system. */
export function useDataExport(): UseDataExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [error, setError] = useState<DataError | null>(null);

  const exportData = useCallback(async () => {
    setIsExporting(true);
    setOutcome(null);
    setError(null);

    try {
      setOutcome(await exportUserDataToFile());
    } catch (caught) {
      setError(toDataError(caught));
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, outcome, error, exportData };
}
