import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Chip, Sheet, Text } from '@/components/ui';
import {
  FRICTION_REASON_ORDER,
  type FrictionReason,
} from '@/features/friction/model/friction';
import type { TodayTask } from '@/features/habits';
import type { TranslationKey } from '@/i18n/keys';

export const FRICTION_REASON_KEYS: Record<FrictionReason, TranslationKey> = {
  forgot: 'friction.reasons.forgot',
  no_time: 'friction.reasons.noTime',
  too_big: 'friction.reasons.tooBig',
  wrong_time: 'friction.reasons.wrongTime',
  environment: 'friction.reasons.environment',
  not_today: 'friction.reasons.notToday',
};

export type FrictionReasonSheetProps = {
  task: TodayTask | null;
  selectedReason: FrictionReason | null;
  isOffline: boolean;
  isQueued: boolean;
  hasError: boolean;
  onClose: () => void;
  onSelect: (reason: FrictionReason) => void;
  onRemove: () => void;
};

/** Jeden tap zapisuje enum. Zamknięcie nie zapisuje niczego. */
export function FrictionReasonSheet({
  task,
  selectedReason,
  isOffline,
  isQueued,
  hasError,
  onClose,
  onSelect,
  onRemove,
}: FrictionReasonSheetProps) {
  const { t } = useTranslation();

  if (task === null) return null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('friction.picker.title')}
      closeLabel={t('friction.picker.skip')}
    >
      <Text variant="body" tone="secondary">
        {t('friction.picker.description', { habit: task.habit.title })}
      </Text>

      {isOffline ? <Banner message={t('friction.offline')} /> : null}
      {isQueued ? <Banner message={t('friction.queued')} /> : null}
      {hasError ? <Banner message={t('friction.saveError')} /> : null}

      <View className="flex-row flex-wrap gap-2">
        {FRICTION_REASON_ORDER.map((reason) => (
          <Chip
            key={reason}
            label={t(FRICTION_REASON_KEYS[reason])}
            selected={selectedReason === reason}
            onPress={() => {
              onSelect(reason);
            }}
          />
        ))}
      </View>

      {selectedReason === null ? null : (
        <Button label={t('friction.picker.remove')} variant="ghost" onPress={onRemove} />
      )}

      <Button label={t('friction.picker.skip')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
