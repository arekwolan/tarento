import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Text } from '@/components/ui';
import {
  ConflictRadarSection,
  type ProtocolConflict,
  type ProtocolConflictContext,
  type ProtocolConflictDecision,
  type ProtocolConflictReview,
} from '@/features/conflict-radar';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import { buildBookProtocolStartPreview } from '@/features/paths/model/book-protocol';
import type { PathPractice, PathStage } from '@/features/paths/model/schemas';
import { AcceptedRuleContext } from '@/features/self-knowledge';

export type BookProtocolPreviewSheetProps = {
  visible: boolean;
  stages: readonly PathStage[];
  practices: readonly PathPractice[];
  skipPracticeIds: readonly string[];
  skipSetupStageIds: readonly string[];
  lite: boolean;
  windowMinutes: number | null;
  isPending: boolean;
  requiresConflictReview: boolean;
  conflictReview: ProtocolConflictReview | null;
  isConflictLoading: boolean;
  isConflictResolving: boolean;
  hasConflictError: boolean;
  canConfirm: boolean;
  onRetryConflicts: () => void;
  onResolveConflict: (
    conflict: ProtocolConflict,
    decision: ProtocolConflictDecision,
    contextA?: ProtocolConflictContext | null,
    contextB?: ProtocolConflictContext | null,
  ) => void;
  onToggleSetup: (stageId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

/** Podgląd całego kontrolowanego cyklu add/replace przed uruchomieniem. */
export function BookProtocolPreviewSheet({
  visible,
  stages,
  practices,
  skipPracticeIds,
  skipSetupStageIds,
  lite,
  windowMinutes,
  isPending,
  requiresConflictReview,
  conflictReview,
  isConflictLoading,
  isConflictResolving,
  hasConflictError,
  canConfirm,
  onRetryConflicts,
  onResolveConflict,
  onToggleSetup,
  onConfirm,
  onClose,
}: BookProtocolPreviewSheetProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  const preview = buildBookProtocolStartPreview(
    stages,
    practices,
    skipPracticeIds,
    lite,
    windowMinutes,
  );

  const describeFrequency = (practice: PathPractice): string => {
    if (practice.scheduleType === 'daily') {
      return t('path.protocol.preview.frequency.daily');
    }
    if (practice.scheduleType === 'weekdays') {
      return t('path.protocol.preview.frequency.weekdays');
    }

    return t('path.protocol.preview.frequency.custom', {
      count: practice.scheduleDays?.length ?? 0,
    });
  };

  const describeValue = (practice: PathPractice): string => {
    const unitKey = targetUnitKey(practice.unit);
    const value = formatTargetValue(practice.startValue);

    return unitKey === null ? value : `${value} ${t(unitKey)}`;
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('path.protocol.preview.title')}
      closeLabel={t('path.protocol.preview.close')}
    >
      <Text variant="body" tone="secondary">
        {t('path.protocol.preview.description')}
      </Text>

      <View className="gap-4">
        {preview.stages.map((stagePreview) => (
          <View key={stagePreview.stage.id} className="gap-2">
            <View className="gap-1">
              <Text variant="label" tone="secondary">
                {t('path.protocol.preview.stage', {
                  ordinal: stagePreview.stage.ordinal,
                  name: stagePreview.stage.name,
                })}
              </Text>
              <Text variant="caption" tone="tertiary">
                {t('path.protocol.preview.minutes', {
                  minutes: stagePreview.dailyMinutes,
                })}
              </Text>
            </View>

            {stagePreview.stage.environmentSetup === null ? null : (
              <View className="gap-2">
                <Text variant="label" tone="secondary">
                  {t(
                    skipSetupStageIds.includes(stagePreview.stage.id)
                      ? 'path.protocol.preview.setupRemoved'
                      : 'path.protocol.preview.setupAdded',
                  )}
                </Text>
                <Text
                  variant="body"
                  tone={
                    skipSetupStageIds.includes(stagePreview.stage.id)
                      ? 'tertiary'
                      : 'primary'
                  }
                >
                  {stagePreview.stage.environmentSetup}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {t('path.protocol.preview.setupMeta')}
                </Text>
                <Button
                  label={t(
                    skipSetupStageIds.includes(stagePreview.stage.id)
                      ? 'path.protocol.preview.setupRestore'
                      : 'path.protocol.preview.setupRemove',
                  )}
                  variant="ghost"
                  onPress={() => {
                    onToggleSetup(stagePreview.stage.id);
                  }}
                />
              </View>
            )}

            {stagePreview.additions.length === 0 ? (
              <Text variant="body" tone="secondary">
                {t('path.protocol.preview.noRecurringPractice')}
              </Text>
            ) : (
              stagePreview.additions.map((practice) => (
                <View key={practice.id} className="gap-1">
                  <Text variant="label" tone="secondary">
                    {t('path.protocol.preview.diff.add')}
                  </Text>
                  <Text variant="bodyLg">
                    {t('path.protocol.preview.adds', { title: practice.title })}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {t('path.protocol.preview.practiceMeta', {
                      value: describeValue(practice),
                      frequency: describeFrequency(practice),
                    })}
                  </Text>
                </View>
              ))
            )}

            {stagePreview.retirements.map((practice) => (
              <View key={practice.id} className="gap-1">
                <Text variant="label" tone="secondary">
                  {t('path.protocol.preview.diff.replace')}
                </Text>
                <Text variant="body" tone="secondary">
                  {t('path.protocol.preview.retires', { title: practice.title })}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Divider />

      <View className="gap-1">
        <Text variant="label" tone="secondary">
          {t('path.protocol.preview.budgetTitle')}
        </Text>
        {preview.availableMinutes === null ? (
          <Text variant="body" tone="secondary">
            {t('path.protocol.preview.budgetUnknown', {
              start: preview.startMinutes,
              peak: preview.peakMinutes,
            })}
          </Text>
        ) : (
          <Text variant="body" tone="secondary">
            {t('path.protocol.preview.budget', {
              start: preview.startMinutes,
              peak: preview.peakMinutes,
              available: preview.availableMinutes,
              remaining: preview.remainingAtPeak ?? 0,
            })}
          </Text>
        )}
      </View>

      <Text variant="caption" tone="secondary">
        {t('path.protocol.preview.singleActive')}
      </Text>

      <AcceptedRuleContext />

      <ConflictRadarSection
        required={requiresConflictReview}
        review={conflictReview}
        isLoading={isConflictLoading}
        isResolving={isConflictResolving}
        hasError={hasConflictError}
        onRetry={onRetryConflicts}
        onResolve={onResolveConflict}
      />

      <Button
        label={t('path.protocol.preview.confirm')}
        size="lg"
        loading={isPending}
        disabled={isPending || !canConfirm}
        onPress={onConfirm}
      />
    </Sheet>
  );
}
