import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { TaskRow } from '@/features/habits/components/task-row';
import {
  groupTasksByTimeOfDay,
  type TaskGroupKey,
} from '@/features/habits/model/grouping';
import type { HabitStreak } from '@/features/habits/model/habit';
import type { TodayTask } from '@/features/habits/model/today-task';
import type { TranslationKey } from '@/i18n/keys';

const GROUP_LABEL: Record<TaskGroupKey, TranslationKey> = {
  morning: 'today.groups.morning',
  afternoon: 'today.groups.afternoon',
  evening: 'today.groups.evening',
  anytime: 'today.groups.anytime',
};

export type TaskGroupListProps = {
  tasks: readonly TodayTask[];
  streaks: ReadonlyMap<string, HabitStreak>;
  onToggle: (task: TodayTask) => void;
  onSkip: (task: TodayTask) => void;
  onOpenDetails: (task: TodayTask) => void;
};

/**
 * Lista zadań w sekcjach po porze dnia.
 *
 * Zwykłe widoki zamiast listy wirtualizowanej: produkt celowo trzyma
 * krótką listę na dziś, a podział na cztery sekcje sprawia, że
 * wirtualizacja kosztowałaby więcej, niż daje.
 */
export function TaskGroupList({
  tasks,
  streaks,
  onToggle,
  onSkip,
  onOpenDetails,
}: TaskGroupListProps) {
  const { t } = useTranslation();
  const groups = groupTasksByTimeOfDay(tasks);

  return (
    <View className="gap-8">
      {groups.map((group) => (
        <View key={group.key} className="gap-1">
          <Text variant="label" tone="secondary" className="mb-1">
            {t(GROUP_LABEL[group.key])}
          </Text>

          {group.tasks.map((task) => (
            <TaskRow
              key={task.habit.id}
              task={task}
              streak={streaks.get(task.habit.id)}
              onToggle={onToggle}
              onSkip={onSkip}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
