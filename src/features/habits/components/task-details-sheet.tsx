import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Text, TextField } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { HabitStreak } from '@/features/habits/model/habit';
import type { TodayTask } from '@/features/habits/model/today-task';
import { usePathOrigin } from '@/features/paths';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type ScheduleType, type SupportedLocale } from '@/lib/date';

const SCHEDULE_LABEL: Record<ScheduleType, TranslationKey> = {
  daily: 'today.details.scheduleDaily',
  weekdays: 'today.details.scheduleWeekdays',
  custom: 'today.details.scheduleCustom',
};

export type TaskDetailsSheetProps = {
  task: TodayTask | null;
  streak: HabitStreak | undefined;
  locale: SupportedLocale;
  onClose: () => void;
  onSaveNote: (task: TodayTask, note: string) => void;
  onOpenFriction: (task: TodayTask) => void;
};

/**
 * Notatka trzymana lokalnie, dopóki użytkownik nie zapisze.
 *
 * Osobny komponent z kluczem po nawyku: otwarcie innej pozycji montuje go od
 * nowa, więc stan startowy bierze się z propsów zamiast z efektu resetującego.
 */
function NoteEditor({
  task,
  onSave,
}: {
  task: TodayTask;
  onSave: (task: TodayTask, note: string) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState(task.log?.note ?? '');

  // Notatka mieszka w wierszu habit_logs, więc bez wpisu nie ma jej gdzie zapisać.
  const canWriteNote = task.log !== null;

  return (
    <>
      <TextField
        label={t('today.details.noteLabel')}
        placeholder={t('today.details.notePlaceholder')}
        hint={canWriteNote ? undefined : t('today.details.noteDisabled')}
        editable={canWriteNote}
        multiline
        numberOfLines={3}
        value={note}
        onChangeText={setNote}
        className={canWriteNote ? undefined : 'opacity-50'}
      />
      <Button
        label={t('today.details.noteSave')}
        variant="secondary"
        disabled={!canWriteNote}
        onPress={() => {
          onSave(task, note);
        }}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="body" tone="secondary" className="flex-1">
        {label}
      </Text>
      <Text variant="num">{value}</Text>
    </View>
  );
}

/** Szczegóły nawyku po długim przytrzymaniu. */
export function TaskDetailsSheet({
  task,
  streak,
  locale,
  onClose,
  onSaveNote,
  onOpenFriction,
}: TaskDetailsSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // Hook przed wczesnym wyjściem: kolejność wywołań nie może zależeć od tego,
  // czy arkusz ma co pokazać.
  const { origin } = usePathOrigin(task?.habit.sourceStageId ?? null);

  if (task === null) return null;

  const { habit } = task;
  const unitKey = targetUnitKey(habit.unit);
  const targetLabel =
    habit.unit === 'none'
      ? '—'
      : `${formatTargetValue(task.target)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={habit.title}
      closeLabel={t('today.details.close')}
    >
      {habit.description === null ? null : (
        <Text variant="body" tone="secondary">
          {habit.description}
        </Text>
      )}

      <Divider />

      <View className="gap-3">
        <DetailRow label={t('today.details.targetToday')} value={targetLabel} />
        <DetailRow
          label={t('today.details.schedule')}
          value={t(SCHEDULE_LABEL[habit.scheduleType])}
        />
        <DetailRow
          label={t('today.details.currentStreak')}
          value={t('today.details.days', { days: streak?.currentStreak ?? 0 })}
        />
        <DetailRow
          label={t('today.details.longestStreak')}
          value={t('today.details.days', { days: streak?.longestStreak ?? 0 })}
        />
        <Text variant="caption" tone="tertiary">
          {t('today.details.startedOn', {
            date: formatFullDay(habit.startedOn, locale),
          })}
        </Text>
        {habit.sourceBook === null ? null : (
          <Text variant="caption" tone="tertiary">
            {t('today.details.source', { book: habit.sourceBook })}
          </Text>
        )}
        {/*
          Jedyne miejsce, w którym widać pochodzenie ze ścieżki. Na liście
          „Dziś" pozycja ze ścieżki niczym się nie różni od dodanej ręcznie —
          bez ikony, bez znacznika, bez grupowania.
        */}
        {origin === null ? null : (
          <Text variant="caption" tone="tertiary">
            {t('path.details.origin', {
              path: origin.pathTitle,
              stage: origin.stageOrdinal,
            })}
          </Text>
        )}
      </View>

      <Divider />

      <Button
        label={t('friction.details.action')}
        variant="secondary"
        onPress={() => {
          onClose();
          onOpenFriction(task);
        }}
      />

      <NoteEditor
        key={task.habit.id}
        task={task}
        onSave={(edited, note) => {
          onSaveNote(edited, note);
          onClose();
        }}
      />
      <Button
        label={t('today.details.edit')}
        variant="secondary"
        onPress={() => {
          onClose();
          router.push(`/habit/${habit.id}`);
        }}
      />
      <Button label={t('today.details.close')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
