import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text, usePressClass } from '@/components/ui';
import { formatTargetValue, targetUnitKey } from '@/features/habits/model/grouping';
import type { HabitStreak } from '@/features/habits/model/habit';
import type { TodayTask } from '@/features/habits/model/today-task';
import { cn } from '@/lib/cn';
import { checkSpring, duration, easeEnter } from '@/theme/motion';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

/** Cały wiersz jest celem dotyku, nie sam znacznik. Minimum 48dp, z zapasem. */
const ROW_MIN_HEIGHT = 56;
const STREAK_VISIBLE_FROM = 2;
const CHECK_OVERSHOOT = 1.18;

export type TaskRowProps = {
  task: TodayTask;
  streak: HabitStreak | undefined;
  onToggle: (task: TodayTask) => void;
  onSkip: (task: TodayTask) => void;
  onOpenDetails: (task: TodayTask) => void;
};

function SkipAction({ label, onPress }: { label: string; onPress: () => void }) {
  const pressClass = usePressClass();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        'my-1 ml-2 items-center justify-center rounded-md border border-border bg-surface-elevated px-5',
        pressClass,
      )}
      style={[CONTINUOUS_CURVE, { minHeight: ROW_MIN_HEIGHT }]}
    >
      <Text variant="label" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Znacznik wykonania.
 *
 * Jedyna sprężyna w aplikacji: potwierdzenie odhaczenia. Przy włączonej
 * redukcji ruchu zostaje sama zmiana wypełnienia, bez skoku skali.
 */
function CheckIndicator({
  isCompleted,
  isSkipped,
}: {
  isCompleted: boolean;
  isSkipped: boolean;
}) {
  const { color } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const wasCompleted = useRef(isCompleted);

  useEffect(() => {
    if (isCompleted && !wasCompleted.current && !reducedMotion) {
      scale.value = withSequence(
        withTiming(CHECK_OVERSHOOT, { duration: duration.fast, easing: easeEnter }),
        withSpring(1, checkSpring),
      );
    }
    wasCompleted.current = isCompleted;
  }, [isCompleted, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        className={cn(
          'size-6 items-center justify-center rounded-full',
          isCompleted ? 'bg-accent-fill' : 'border border-border-strong',
        )}
      >
        {isCompleted ? (
          <Ionicons name="checkmark" size={16} color={color('on-accent')} />
        ) : null}
        {!isCompleted && isSkipped ? (
          <Ionicons name="remove" size={14} color={color('text-tertiary')} />
        ) : null}
      </View>
    </Animated.View>
  );
}

export function TaskRow({ task, streak, onToggle, onSkip, onOpenDetails }: TaskRowProps) {
  const { t } = useTranslation();
  const pressClass = usePressClass();

  const { habit } = task;
  const unitKey = targetUnitKey(habit.unit);
  const targetLabel =
    habit.unit === 'none'
      ? null
      : `${formatTargetValue(task.target)}${unitKey === null ? '' : ` ${t(unitKey)}`}`;

  const showProgression = habit.incrementValue > 0 && task.targetDelta > 0;
  const deltaLabel = `${formatTargetValue(task.targetDelta)}${
    unitKey === null ? '' : ` ${t(unitKey)}`
  }`;

  const currentStreak = streak?.currentStreak ?? 0;
  const showStreak = currentStreak >= STREAK_VISIBLE_FROM;

  const handleToggle = () => {
    // Odhaczenie potwierdzamy stuknięciem, cofnięcie — samym zaznaczeniem.
    void (task.isCompleted
      ? Haptics.selectionAsync()
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    onToggle(task);
  };

  const renderSkipAction = (
    _progress: unknown,
    _translation: unknown,
    methods: SwipeableMethods,
  ) => (
    <SkipAction
      label={task.isSkipped ? t('today.task.unskip') : t('today.task.skip')}
      onPress={() => {
        methods.close();
        void Haptics.selectionAsync();
        onSkip(task);
      }}
    />
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderSkipAction}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.isCompleted }}
        accessibilityLabel={habit.title}
        accessibilityHint={t('today.task.toggleHint')}
        onPress={handleToggle}
        onLongPress={() => {
          onOpenDetails(task);
        }}
        style={[CONTINUOUS_CURVE, { minHeight: ROW_MIN_HEIGHT }]}
        className={cn(
          'my-1 flex-row items-center gap-4 rounded-md border border-border bg-surface px-4 py-3',
          pressClass,
        )}
      >
        <CheckIndicator isCompleted={task.isCompleted} isSkipped={task.isSkipped} />

        <View className="flex-1 gap-1">
          {/* Polskie nazwy bywają długie — dwie linie zamiast ucinania. */}
          <Text
            variant="bodyLg"
            tone={task.isCompleted || task.isSkipped ? 'secondary' : 'primary'}
            numberOfLines={2}
            className={cn(task.isCompleted && 'line-through')}
          >
            {habit.title}
          </Text>

          <View className="flex-row flex-wrap items-center gap-2">
            {targetLabel === null ? null : (
              <Text variant="num" tone="tertiary">
                {targetLabel}
              </Text>
            )}
            {showProgression ? (
              <Text variant="caption" tone="tertiary">
                {t('today.task.progression', { delta: deltaLabel })}
              </Text>
            ) : null}
            {task.isSkipped ? (
              <Text variant="caption" tone="tertiary">
                {t('today.task.skipped')}
              </Text>
            ) : null}
          </View>
        </View>

        {showStreak ? (
          <Text
            variant="num"
            tone="accent"
            accessibilityLabel={t('today.task.streak', { days: currentStreak })}
          >
            {t('today.task.streakShort', { days: currentStreak })}
          </Text>
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
