import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Skeleton, Text } from '@/components/ui';
import { useHabits, type HabitLogStatus } from '@/features/habits';
import { useDayUndo } from '@/features/stats/api/use-day-undo';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type IsoDate, type SupportedLocale } from '@/lib/date';

const STATUS_LABEL: Record<HabitLogStatus, TranslationKey> = {
  done: 'stats.dayUndo.statusDone',
  partial: 'stats.dayUndo.statusDone',
  skipped: 'stats.dayUndo.statusSkipped',
};

export type DayUndoSheetProps = {
  /** `null` zamyka arkusz. */
  date: IsoDate | null;
  locale: SupportedLocale;
  onClose: () => void;
  /** Dostaje cofnięcie do podpięcia pod toast. */
  onCleared: (undo: () => void) => void;
};

/**
 * Cofnięcie dnia.
 *
 * Ludzie okłamują serię, potem czują się źle z tym kłamstwem, a potem
 * rezygnują. Ten arkusz jest czystym sposobem na korektę — i jedynym miejscem
 * w tym przepływie, gdzie wolno użyć koloru `danger` (CLAUDE.md, reguła 7),
 * bo kasowanie wpisów naprawdę jest nieodwracalne po wygaśnięciu toasta.
 *
 * Bez ostrzeżenia o utracie serii i bez oceny tego, po co ktoś to robi.
 */
export function DayUndoSheet({ date, locale, onClose, onCleared }: DayUndoSheetProps) {
  const { t } = useTranslation();
  const { habits } = useHabits();
  const { logs, isLoading, isClearing, clear } = useDayUndo(date);

  if (date === null) return null;

  const titleById = new Map(habits.map((habit) => [habit.id, habit.title]));

  const handleClear = () => {
    void clear().then((undo) => {
      onClose();
      if (undo !== null) onCleared(undo);
    });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={formatFullDay(date, locale)}
      closeLabel={t('stats.dayUndo.close')}
    >
      {isLoading ? (
        <View
          className="gap-2"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Skeleton className="h-6 w-full rounded-sm" />
          <Skeleton className="h-6 w-full rounded-sm" />
        </View>
      ) : null}

      {!isLoading && logs.length === 0 ? (
        <Text variant="body" tone="secondary">
          {t('stats.dayUndo.empty')}
        </Text>
      ) : null}

      {!isLoading && logs.length > 0 ? (
        <>
          <View className="gap-3">
            {logs.map((log, index) => (
              <View key={log.id} className="gap-3">
                {index === 0 ? null : <Divider />}
                <View className="gap-1">
                  <Text variant="bodyLg">{titleById.get(log.habitId) ?? ''}</Text>
                  <Text variant="caption" tone="tertiary">
                    {t(STATUS_LABEL[log.status])}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Button
            label={t('stats.dayUndo.action')}
            variant="destructive"
            size="lg"
            loading={isClearing}
            disabled={isClearing}
            onPress={handleClear}
          />

          <Text variant="caption" tone="tertiary">
            {t('stats.dayUndo.note')}
          </Text>
        </>
      ) : null}
    </Sheet>
  );
}
