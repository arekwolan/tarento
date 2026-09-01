import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Chip, Skeleton, Text } from '@/components/ui';
import type {
  ProtocolConflict,
  ProtocolConflictContext,
  ProtocolConflictDecision,
  ProtocolConflictReview,
} from '@/features/conflict-radar/model/schemas';
import type { TranslationKey } from '@/i18n/keys';

const CONTEXTS = [
  { value: 'workday', label: 'conflictRadar.context.workday' },
  { value: 'free', label: 'conflictRadar.context.free' },
  { value: 'night_shift', label: 'conflictRadar.context.nightShift' },
  { value: 'care', label: 'conflictRadar.context.care' },
  { value: 'custom', label: 'conflictRadar.context.custom' },
  { value: 'morning', label: 'conflictRadar.context.morning' },
  { value: 'afternoon', label: 'conflictRadar.context.afternoon' },
  { value: 'evening', label: 'conflictRadar.context.evening' },
] as const satisfies readonly {
  value: ProtocolConflictContext;
  label: TranslationKey;
}[];

type ContextDraft = { a: ProtocolConflictContext | null; b: ProtocolConflictContext | null };

export type ConflictRadarSectionProps = {
  required: boolean;
  review: ProtocolConflictReview | null;
  isLoading: boolean;
  isResolving: boolean;
  hasError: boolean;
  onRetry: () => void;
  onResolve: (
    conflict: ProtocolConflict,
    decision: ProtocolConflictDecision,
    contextA?: ProtocolConflictContext | null,
    contextB?: ProtocolConflictContext | null,
  ) => void;
};

function ConflictDecision({
  conflict,
  isResolving,
  onResolve,
}: {
  conflict: ProtocolConflict;
  isResolving: boolean;
  onResolve: ConflictRadarSectionProps['onResolve'];
}) {
  const { t } = useTranslation();
  const [context, setContext] = useState<ContextDraft>({ a: null, b: null });

  if (conflict.decision !== null) {
    if (conflict.decision === 'context_split') {
      const contextA = CONTEXTS.find((item) => item.value === conflict.contextA);
      const contextB = CONTEXTS.find((item) => item.value === conflict.contextB);
      return (
        <Text variant="caption" tone="secondary">
          {t('conflictRadar.resolved.context', {
            contextA: contextA === undefined ? '' : t(contextA.label),
            contextB: contextB === undefined ? '' : t(contextB.label),
          })}
        </Text>
      );
    }
    const title =
      conflict.decision === 'reject_existing'
        ? conflict.existingTitle
        : conflict.incomingTitle;
    return (
      <Text variant="caption" tone="secondary">
        {t('conflictRadar.diff.remove', { title: title ?? '' })}
      </Text>
    );
  }

  return (
    <View className="gap-3">
      {conflict.type !== 'rule' ? null : (
        <>
          <Text variant="body">{t('conflictRadar.rule.question')}</Text>
          {conflict.noteAText === null ? null : (
            <Text variant="body" tone="secondary">
              {t('conflictRadar.rule.noteA', { note: conflict.noteAText })}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            {CONTEXTS.map((item) => (
              <Chip
                key={`a:${item.value}`}
                label={t(item.label)}
                selected={context.a === item.value}
                onPress={() => {
                  setContext((current) => ({ ...current, a: item.value }));
                }}
              />
            ))}
          </View>
          {conflict.noteBText === null ? null : (
            <Text variant="body" tone="secondary">
              {t('conflictRadar.rule.noteB', { note: conflict.noteBText })}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            {CONTEXTS.map((item) => (
              <Chip
                key={`b:${item.value}`}
                label={t(item.label)}
                selected={context.b === item.value}
                onPress={() => {
                  setContext((current) => ({ ...current, b: item.value }));
                }}
              />
            ))}
          </View>
          <Button
            label={t('conflictRadar.rule.saveContext')}
            variant="secondary"
            loading={isResolving}
            disabled={
              context.a === null || context.b === null || context.a === context.b
            }
            onPress={() => {
              onResolve(conflict, 'context_split', context.a, context.b);
            }}
          />
        </>
      )}

      {conflict.existingHabitId === null ? null : (
        <Button
          label={t('conflictRadar.rejectExisting', {
            title: conflict.existingTitle ?? '',
          })}
          variant="secondary"
          loading={isResolving}
          onPress={() => {
            onResolve(conflict, 'reject_existing');
          }}
        />
      )}
      <Button
        label={t('conflictRadar.rejectIncoming', {
          title: conflict.incomingTitle ?? '',
        })}
        variant="ghost"
        loading={isResolving}
        onPress={() => {
          onResolve(conflict, 'reject_incoming');
        }}
      />
    </View>
  );
}

export function ConflictRadarSection({
  required,
  review,
  isLoading,
  isResolving,
  hasError,
  onRetry,
  onResolve,
}: ConflictRadarSectionProps) {
  const { t } = useTranslation();
  if (!required) return null;

  if (isLoading) {
    return (
      <Card variant="outlined" className="gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4" />
        <Skeleton className="h-12" />
      </Card>
    );
  }

  if (hasError || review === null) {
    return (
      <View className="gap-3">
        <Banner tone="danger" message={t('conflictRadar.error')} />
        <Button
          label={t('common.retry')}
          variant="secondary"
          onPress={onRetry}
        />
      </View>
    );
  }

  if (review.conflicts.length === 0) {
    return <Banner tone="success" message={t('conflictRadar.clear')} />;
  }

  return (
    <View className="gap-3">
      <Text variant="title">{t('conflictRadar.title')}</Text>
      <Text variant="caption" tone="secondary">
        {t('conflictRadar.localOnly')}
      </Text>
      {review.conflicts.map((conflict) => (
        <Card key={conflict.id} variant="outlined" className="gap-3">
          <Text variant="label" tone="secondary">
            {t('conflictRadar.diff.collision')}
          </Text>
          <Text variant="bodyLg">
            {t(`conflictRadar.type.${conflict.type}`)}
          </Text>
          {conflict.type === 'capacity' ? (
            <Text variant="body" tone="secondary">
              {t('conflictRadar.capacity.detail', {
                required: conflict.requiredMinutes ?? 0,
                available: conflict.availableMinutes ?? 0,
              })}
            </Text>
          ) : conflict.type === 'execution' ? (
            <Text variant="body" tone="secondary">
              {t('conflictRadar.execution.detail', {
                incoming: conflict.incomingTitle ?? '',
                existing: conflict.existingTitle ?? '',
              })}
            </Text>
          ) : conflict.description === null ? null : (
            <Text variant="body" tone="secondary">
              {conflict.description}
            </Text>
          )}
          <ConflictDecision
            conflict={conflict}
            isResolving={isResolving}
            onResolve={onResolve}
          />
        </Card>
      ))}
    </View>
  );
}
