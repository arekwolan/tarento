import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { easeMove } from '@/theme/motion';
import { CONTINUOUS_CURVE } from '@/theme/radii';

const PULSE_MIN = 0.45;
const PULSE_MAX = 1;
const PULSE_DURATION = 900;

export type SkeletonProps = {
  /** Ustaw wymiary klasami, np. "h-6 w-32 rounded-sm". */
  className?: string;
};

/**
 * Spokojny puls zamiast biegnącego shimmera — animacja tylko przez Reanimated.
 * Przy włączonej redukcji ruchu szkielet stoi w połowie skali, bez migotania.
 *
 * className trafia na wewnętrzny <View>, bo Animated.View nie jest
 * zarejestrowany w NativeWind.
 */
export function Skeleton({ className }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? PULSE_MAX : PULSE_MIN);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = PULSE_MAX;
      return;
    }

    opacity.value = withRepeat(
      withTiming(PULSE_MAX, { duration: PULSE_DURATION, easing: easeMove }),
      -1,
      true,
    );
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animatedStyle} accessibilityRole="progressbar">
      <View
        style={CONTINUOUS_CURVE}
        className={cn('h-4 w-full rounded-xs bg-border', className)}
      />
    </Animated.View>
  );
}
