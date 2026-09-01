import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Divider, Sheet, Skeleton, Text } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { Habit } from '@/features/habits/model/habit';
import {
  habitRevisionChanges,
  type HabitRevision,
  type HabitRevisionChange,
  type HabitRevisionReason,
  type HabitRevisionRestorePreview,
  type HabitRevisionSnapshot,
} from '@/features/habits/model/revision';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type SupportedLocale } from '@/lib/date';

const REASON_KEYS: Record<HabitRevisionReason, TranslationKey> = {
  initial_snapshot: 'habits.history.reasons.initialSnapshot',
  created: 'habits.history.reasons.created',
  user_edit: 'habits.history.reasons.userEdit',
  difficult_period: 'habits.history.reasons.difficultPeriod',
  path_materialized: 'habits.history.reasons.pathMaterialized',
  path_stage: 'habits.history.reasons.pathStage',
  path_pause: 'habits.history.reasons.pathPause',
  path_end: 'habits.history.reasons.pathEnd',
  time_calibration: 'habits.history.reasons.timeCalibration',
  reentry: 'habits.history.reasons.reentry',
  reentry_complete: 'habits.history.reasons.reentryComplete',
  retired: 'habits.history.reasons.retired',
  restored: 'habits.history.reasons.restored',
  archived: 'habits.history.reasons.archived',
  rollback: 'habits.history.reasons.rollback',
  day_fit: 'habits.history.reasons.dayFit',
  experiment_a: 'habits.history.reasons.experimentA',
  experiment_b: 'habits.history.reasons.experimentB',
  experiment_pause: 'habits.history.reasons.experimentPause',
  experiment_resume: 'habits.history.reasons.experimentResume',
  experiment_cancel: 'habits.history.reasons.experimentCancel',
  experiment_choice: 'habits.history.reasons.experimentChoice',
};

const TIME_KEYS: Record<
  Exclude<HabitRevisionSnapshot['time_of_day'], null>,
  TranslationKey
> = {
  morning: 'today.groups.morning',
  afternoon: 'today.groups.afternoon',
  evening: 'today.groups.evening',
};

const SCHEDULE_KEYS: Record<HabitRevisionSnapshot['schedule_type'], TranslationKey> = {
  daily: 'habits.form.scheduleDaily',
  weekdays: 'habits.form.scheduleWeekdays',
  custom: 'habits.form.scheduleCustom',
};

const STATUS_KEYS: Record<'active' | 'retired' | 'archived', TranslationKey> = {
  active: 'habits.history.status.active',
  retired: 'habits.history.status.retired',
  archived: 'habits.history.status.archived',
};

function ChangeLine({ change }: { change: HabitRevisionChange }) {
  const { t } = useTranslation();

  const amount = (entry: {
    value: number | null;
    unit: HabitRevisionSnapshot['unit'];
  }) => {
    if (entry.value === null) return t('habits.history.none');
    const unitKey = targetUnitKey(entry.unit);
    const unit = unitKey === null ? '' : ` ${t(unitKey)}`;
    return `${formatTargetValue(entry.value)}${unit}`;
  };

  const time = (value: HabitRevisionSnapshot['time_of_day']) =>
    value === null ? t('habits.form.timeOfDayNone') : t(TIME_KEYS[value]);

  switch (change.kind) {
    case 'created':
      return <Text variant="body">{t('habits.history.changes.created')}</Text>;
    case 'title':
      return (
        <Text variant="body">
          {t('habits.history.changes.title', {
            before: change.before,
            after: change.after,
          })}
        </Text>
      );
    case 'amount':
    case 'increment':
    case 'target':
      return (
        <Text variant="body">
          {t(`habits.history.changes.${change.kind}`, {
            before: amount(change.before),
            after: amount(change.after),
          })}
        </Text>
      );
    case 'schedule':
      return (
        <Text variant="body">
          {t('habits.history.changes.schedule', {
            before: t(SCHEDULE_KEYS[change.before.schedule_type]),
            after: t(SCHEDULE_KEYS[change.after.schedule_type]),
          })}
        </Text>
      );
    case 'time_of_day':
      return (
        <Text variant="body">
          {t('habits.history.changes.timeOfDay', {
            before: time(change.before),
            after: time(change.after),
          })}
        </Text>
      );
    case 'reminder':
      return (
        <Text variant="body">
          {t('habits.history.changes.reminder', {
            before: change.before?.slice(0, 5) ?? t('habits.history.none'),
            after: change.after?.slice(0, 5) ?? t('habits.history.none'),
          })}
        </Text>
      );
    case 'status':
      return (
        <Text variant="body">
          {t('habits.history.changes.status', {
            before: t(STATUS_KEYS[change.before]),
            after: t(STATUS_KEYS[change.after]),
          })}
        </Text>
      );
    case 'details':
      return <Text variant="body">{t('habits.history.changes.details')}</Text>;
  }
}

export type HabitRevisionHistoryProps = {
  habit: Habit;
  revisions: readonly HabitRevision[];
  isLoading: boolean;
  isOffline: boolean;
  error: boolean;
  onRetry: () => void;
  onRestore: (revision: HabitRevision) => void;
};

export function HabitRevisionHistory({
  habit,
  revisions,
  isLoading,
  isOffline,
  error,
  onRetry,
  onRestore,
}: HabitRevisionHistoryProps) {
  const { t, i18n } = useTranslation();
  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="title" accessibilityRole="header">
          {t('habits.history.title')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('habits.history.description')}
        </Text>
      </View>

      {isOffline ? <Banner message={t('habits.history.offline')} /> : null}

      {isLoading ? (
        <Card className="gap-3" accessibilityElementsHidden>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-12 w-full rounded-md" />
        </Card>
      ) : null}

      {!isLoading && error ? (
        <Card className="gap-3">
          <Text variant="body" tone="secondary">
            {t('habits.history.error')}
          </Text>
          <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />
        </Card>
      ) : null}

      {!isLoading && !error && revisions.length === 0 ? (
        <Card>
          <Text variant="body" tone="secondary">
            {t('habits.history.empty')}
          </Text>
        </Card>
      ) : null}

      {!isLoading && !error
        ? revisions.map((revision, index) => {
            const changes = habitRevisionChanges(
              revision.beforeSnapshot,
              revision.afterSnapshot,
            );
            const isCurrent = index === 0;
            const canRestore =
              !isCurrent && habit.archivedAt === null && habit.retiredAt === null;

            return (
              <Card key={revision.id} className="gap-3">
                <View className="gap-1">
                  <Text variant="label" tone="secondary">
                    {formatFullDay(revision.effectiveOn, locale)}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {t(REASON_KEYS[revision.reason])}
                  </Text>
                </View>

                <Divider />

                <View className="gap-2">
                  {changes.map((change, changeIndex) => (
                    <ChangeLine
                      key={`${revision.id}:${change.kind}:${changeIndex}`}
                      change={change}
                    />
                  ))}
                </View>

                {isCurrent ? (
                  <Text variant="caption" tone="tertiary">
                    {t('habits.history.current')}
                  </Text>
                ) : null}

                {canRestore ? (
                  <Button
                    label={t('habits.history.restoreAction')}
                    variant="secondary"
                    onPress={() => {
                      onRestore(revision);
                    }}
                  />
                ) : null}
              </Card>
            );
          })
        : null}
    </View>
  );
}

export type HabitRevisionRestoreSheetProps = {
  revision: HabitRevision | null;
  preview: HabitRevisionRestorePreview | null;
  isLoading: boolean;
  isRestoring: boolean;
  isQueued: boolean;
  hasPreviewError: boolean;
  hasRestoreError: boolean;
  onClose: () => void;
  onRestore: () => void;
};

export function HabitRevisionRestoreSheet({
  revision,
  preview,
  isLoading,
  isRestoring,
  isQueued,
  hasPreviewError,
  hasRestoreError,
  onClose,
  onRestore,
}: HabitRevisionRestoreSheetProps) {
  const { t } = useTranslation();

  if (revision === null) return null;

  const changes =
    preview === null
      ? []
      : habitRevisionChanges(preview.currentSnapshot, preview.targetSnapshot);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('habits.history.preview.title')}
      closeLabel={t('habits.history.preview.close')}
    >
      <Text variant="body" tone="secondary">
        {t('habits.history.preview.description')}
      </Text>

      {isLoading ? (
        <View className="gap-3" accessibilityElementsHidden>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-12 w-full rounded-md" />
        </View>
      ) : null}

      {!isLoading && hasPreviewError ? (
        <Banner message={t('habits.history.preview.error')} />
      ) : null}

      {preview === null ? null : (
        <>
          <View className="gap-2">
            {changes.map((change, index) => (
              <ChangeLine key={`${change.kind}:${index}`} change={change} />
            ))}
          </View>

          <Divider />

          <View className="gap-1">
            <Text variant="label" tone="secondary">
              {t('habits.history.preview.budgetTitle')}
            </Text>
            <Text variant="body">
              {t('habits.history.preview.minutes', {
                before: formatTargetValue(preview.currentMinutes),
                after: formatTargetValue(preview.restoredMinutes),
              })}
            </Text>
            <Text variant="caption" tone="tertiary">
              {preview.budgetMinutes === null
                ? t('habits.history.preview.noBudget')
                : t('habits.history.preview.budget', {
                    used: formatTargetValue(preview.usedOtherMinutes),
                    total: preview.budgetMinutes,
                  })}
            </Text>
          </View>

          {preview.pathConflict ? (
            <Banner message={t('habits.history.preview.pathConflict')} />
          ) : null}

          {!preview.canRestore ? (
            <Banner message={t('habits.history.preview.blocked')} />
          ) : null}

          {isQueued ? <Banner message={t('habits.history.preview.queued')} /> : null}
          {hasRestoreError ? (
            <Banner message={t('habits.history.preview.restoreError')} />
          ) : null}

          <Button
            label={t('habits.history.preview.confirm')}
            size="lg"
            loading={isRestoring && !isQueued}
            disabled={!preview.canRestore || isRestoring}
            onPress={onRestore}
          />
        </>
      )}
    </Sheet>
  );
}
