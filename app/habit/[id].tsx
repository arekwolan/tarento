import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Screen, Text, useToast } from '@/components/ui';
import {
  FrictionAdjustmentSheet,
  type FrictionAdjustmentMode,
} from '@/features/friction';
import { PersonalExperimentCard } from '@/features/experiments';
import {
  toHabitFormValues,
  useArchiveHabit,
  useDownshift,
  useHabit,
  useHabitRevisions,
  useRetirement,
  useSaveHabit,
} from '@/features/habits';
import { DownshiftCard } from '@/features/habits/components/downshift-card';
import { DownshiftSheet } from '@/features/habits/components/downshift-sheet';
import { HabitForm } from '@/features/habits/components/habit-form';
import {
  HabitRevisionHistory,
  HabitRevisionRestoreSheet,
} from '@/features/habits/components/habit-revision-history';
import { RetirementCard } from '@/features/habits/components/retirement-card';
import { useActiveUserPath } from '@/features/paths';
import { useNotificationPermission, useRemindersEnabled } from '@/features/notifications';
import { useIsOnline } from '@/lib/network';
import { useTheme } from '@/theme/theme-provider';

/**
 * Szczegóły nawyku.
 *
 * Zapis zmienia wyłącznie wiersz w `habits`. Wpisy w `habit_logs` zostają
 * nietknięte — każdy z nich niesie własny snapshot celu, więc podniesienie
 * poprzeczki dziś nie przepisuje tego, co zrobione w zeszłym tygodniu. Tak
 * samo działa zmniejszenie nawyku: historia zostaje taka, jaka była.
 */
export default function EditHabitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const { show: showToast } = useToast();
  const { id, transferDownshift, frictionAction } = useLocalSearchParams<{
    id: string;
    transferDownshift?: string;
    frictionAction?: string;
  }>();
  const isOnline = useIsOnline();

  const habitId = typeof id === 'string' ? id : null;
  const { habit, isLoading } = useHabit(habitId);
  const { update, isPending, error } = useSaveHabit();
  const { archive, unarchive, isPending: isArchiving } = useArchiveHabit();

  // Tydzień wejściowy ścieżki wchodzi do propozycji zmniejszenia parametrem:
  // feature nawyków nie zna ścieżek, a ekran zna oba.
  const { userPath } = useActiveUserPath();
  const downshift = useDownshift(habit, {
    reentryUntil: userPath?.reentryUntil ?? null,
  });
  const downshiftHandled = useRef(false);
  const retirement = useRetirement(habit);
  const history = useHabitRevisions(habit);
  const permission = useNotificationPermission();
  const reminders = useRemindersEnabled();
  const initialAdjustmentMode: FrictionAdjustmentMode | null =
    frictionAction === 'time' || frictionAction === 'reminder' ? frictionAction : null;
  const [adjustmentMode, setAdjustmentMode] = useState<FrictionAdjustmentMode | null>(
    initialAdjustmentMode,
  );

  useEffect(() => {
    if ((transferDownshift !== '1' && frictionAction !== 'downshift') || habit === null) {
      return;
    }
    if (downshiftHandled.current) return;
    downshiftHandled.current = true;
    downshift.request();
  }, [transferDownshift, frictionAction, habit, downshift]);

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={color('text-secondary')} />
          <Text variant="caption" tone="secondary">
            {t('habits.edit.loading')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (habit === null || habitId === null) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 items-center justify-center gap-4">
          <Text variant="body" tone="secondary">
            {t('habits.edit.notFound')}
          </Text>
          <Button
            label={t('habits.form.cancel')}
            variant="secondary"
            onPress={() => {
              router.back();
            }}
          />
        </View>
      </Screen>
    );
  }

  /**
   * Archiwizacja jest odwracalna (miękkie usunięcie), więc idzie od razu,
   * a użytkownik dostaje „Cofnij" zamiast dialogu potwierdzenia.
   */
  const handleArchive = () => {
    void archive(habit).then((archived) => {
      if (archived === null) return;

      router.back();
      showToast({
        message: t('habits.toast.archived'),
        action: {
          label: t('common.undo'),
          onPress: () => {
            void unarchive(archived);
          },
        },
      });
    });
  };

  /**
   * Zdjęcie z listy idzie od razu, z pięcioma sekundami na wycofanie.
   * Historia i seria zostają — znika wyłącznie prośba o odhaczanie.
   */
  const handleRetire = () => {
    void retirement.retire().then((undo) => {
      if (undo === null) return;

      showToast({
        message: t('habits.retirement.toast'),
        action: { label: t('common.undo'), onPress: undo },
      });
    });
  };

  const handleDownshift = () => {
    const previousRevision = history.revisions[0] ?? null;

    void downshift.apply().then((applied) => {
      if (!applied) return;

      showToast({
        message: t('habits.downshift.toast'),
        action:
          previousRevision === null
            ? undefined
            : {
                label: t('common.undo'),
                onPress: () => {
                  history.openPreview(previousRevision);
                },
              },
      });
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <Text variant="titleLg" accessibilityRole="header">
        {t('habits.edit.title')}
      </Text>

      {isOnline ? null : <Banner message={t('path.transfer.downshiftOffline')} />}

      <HabitForm
        initialValues={toHabitFormValues(habit)}
        submitLabel={t('habits.form.saveChanges')}
        isSubmitting={isPending}
        errorMessage={error === null ? undefined : t('habits.form.saveError')}
        onCancel={() => {
          router.back();
        }}
        onSubmit={(values) => {
          void update(habit, values).then((saved) => {
            if (saved !== null) router.back();
          });
        }}
        footer={
          <Button
            label={t('habits.form.archiveAction')}
            variant="destructive"
            disabled={isArchiving}
            onPress={handleArchive}
          />
        }
      />

      <PersonalExperimentCard habit={habit} isOnline={isOnline} />

      {retirement.isVisible ? (
        <RetirementCard
          completed={retirement.completed}
          scheduled={retirement.scheduled}
          isPending={retirement.isPending}
          onRetire={handleRetire}
          onKeep={retirement.decline}
        />
      ) : null}

      {downshift.isVisible ? (
        <DownshiftCard
          completed={downshift.completed}
          scheduled={downshift.scheduled}
          isPending={downshift.isRequesting}
          onPress={downshift.request}
        />
      ) : null}

      <DownshiftSheet
        habit={habit}
        proposal={downshift.proposal}
        isApplying={downshift.isApplying}
        onApply={handleDownshift}
        onClose={downshift.dismiss}
      />

      <FrictionAdjustmentSheet
        key={`${habit.id}:${adjustmentMode ?? 'closed'}`}
        mode={adjustmentMode}
        habit={habit}
        isSaving={isPending}
        hasError={error !== null}
        canEnableReminder={reminders.isEnabled && permission.status !== 'denied'}
        isPermissionLoading={permission.isRequesting}
        onClose={() => {
          setAdjustmentMode(null);
        }}
        onApplyTime={(timeOfDay) => {
          const values = { ...toHabitFormValues(habit), timeOfDay };
          void update(habit, values, {
            source: 'calibration',
            reason: 'time_calibration',
          }).then((saved) => {
            if (saved === null) return;
            setAdjustmentMode(null);
            showToast({ message: t('friction.adjustment.saved') });
          });
        }}
        onApplyReminder={(reminderTime) => {
          void (async () => {
            if (!reminders.isEnabled || permission.status === 'denied') return;
            if (permission.status !== 'granted') {
              const next = await permission.request();
              if (next !== 'granted') return;
            }

            const values = { ...toHabitFormValues(habit), reminderTime };
            const saved = await update(habit, values);
            if (saved === null) return;
            setAdjustmentMode(null);
            showToast({ message: t('friction.adjustment.saved') });
          })();
        }}
        onOpenSettings={() => {
          setAdjustmentMode(null);
          router.push('/settings');
        }}
      />

      <HabitRevisionHistory
        habit={habit}
        revisions={history.revisions}
        isLoading={history.isLoading}
        isOffline={!isOnline}
        error={history.error !== null}
        onRetry={history.refetch}
        onRestore={history.openPreview}
      />

      <HabitRevisionRestoreSheet
        revision={history.selectedRevision}
        preview={history.preview}
        isLoading={history.isPreviewLoading}
        isRestoring={history.isRestoring}
        isQueued={history.isQueued}
        hasPreviewError={history.previewError !== null}
        hasRestoreError={history.restoreError !== null}
        onClose={history.closePreview}
        onRestore={history.restore}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
