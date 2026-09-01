import { useMemo } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DayAxis } from '@/features/day-budget/model/day-shape';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { easeMove, motionDuration } from '@/theme/motion';

/** Szerokość uchwytu w dp — ta sama liczba co klasa `w-6` na jego wypełnieniu. */
const HANDLE_WIDTH = 24;

/** 24 dp uchwytu + 12 dp z każdej strony daje cel dotykowy 48 dp. */
const HANDLE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** Pan wygrywa z przewijaniem dopiero po ruchu w poziomie. */
const HORIZONTAL_ACTIVATION: [number, number] = [-6, 6];

const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export type DayStripProps = {
  /** Granice doby czuwania w minutach. */
  axis: DayAxis;
  start: number;
  end: number;
  /** Skok przyciągania w minutach. */
  step: number;
  /** Najkrótszy dopuszczalny pas — uchwyty nie przechodzą przez siebie. */
  minLength: number;
  /** Gotowe teksty — przekazuj wynik t(), nigdy literał. */
  startLabel: string;
  endLabel: string;
  startValueLabel: string;
  endValueLabel: string;
  onChange: (start: number, end: number) => void;
};

/**
 * Pas doby z jednym zajętym blokiem i dwoma uchwytami.
 *
 * Uchwyty stoją po zewnętrznej stronie bloku, nie na jego krawędziach: przy
 * krótkim pasie krawędzie dzieli kilkanaście pikseli i uchwyty nachodziłyby na
 * siebie. Kontener ma dlatego margines szerokości uchwytu z obu stron.
 *
 * Pozycja bloku idzie za wartością z propsów, nie za palcem: przy skoku
 * 15 minut różnica to kilka pikseli, a dzięki temu pasek pokazuje dokładnie to,
 * co jest w stanie. Przyciąganie animuje `withTiming`, więc przy włączonej
 * redukcji ruchu czas spada do zera i zostaje sama zmiana wartości.
 * Haptyka odzywa się raz na skok, nigdy w trakcie samego przeciągania.
 */
export function DayStrip({
  axis,
  start,
  end,
  step,
  minLength,
  startLabel,
  endLabel,
  startValueLabel,
  endValueLabel,
  onChange,
}: DayStripProps) {
  const reducedMotion = useReducedMotion();

  const trackWidth = useSharedValue(0);
  const dragOrigin = useSharedValue(0);
  /** Ostatnia wysłana wartość przeciąganej krawędzi — chroni przed powtórkami. */
  const dragLast = useSharedValue(0);

  const axisStart = axis.start;
  const axisLength = Math.max(1, axis.end - axis.start);

  const timing = useMemo(
    () => ({ duration: motionDuration('fast', reducedMotion), easing: easeMove }),
    [reducedMotion],
  );

  const startAt = useDerivedValue(() => withTiming(start, timing));
  const endAt = useDerivedValue(() => withTiming(end, timing));

  const toX = (minutes: number) => {
    'worklet';
    return ((minutes - axisStart) / axisLength) * trackWidth.value;
  };

  const toMinutes = (translationX: number) => {
    'worklet';
    const width = trackWidth.value;
    return width <= 0 ? 0 : (translationX / width) * axisLength;
  };

  const commit = (nextStart: number, nextEnd: number) => {
    void Haptics.selectionAsync();
    onChange(nextStart, nextEnd);
  };

  const startPan = Gesture.Pan()
    .activeOffsetX(HORIZONTAL_ACTIVATION)
    .onBegin(() => {
      dragOrigin.value = start;
      dragLast.value = start;
    })
    .onUpdate((event) => {
      const moved = dragOrigin.value + toMinutes(event.translationX);
      const next = Math.min(
        Math.max(axisStart, Math.round(moved / step) * step),
        end - minLength,
      );

      if (next === dragLast.value) return;

      dragLast.value = next;
      runOnJS(commit)(next, end);
    });

  const endPan = Gesture.Pan()
    .activeOffsetX(HORIZONTAL_ACTIVATION)
    .onBegin(() => {
      dragOrigin.value = end;
      dragLast.value = end;
    })
    .onUpdate((event) => {
      const moved = dragOrigin.value + toMinutes(event.translationX);
      const next = Math.max(
        Math.min(axis.end, Math.round(moved / step) * step),
        start + minLength,
      );

      if (next === dragLast.value) return;

      dragLast.value = next;
      runOnJS(commit)(start, next);
    });

  const blockStyle = useAnimatedStyle(() => {
    const left = toX(startAt.value);

    return { left, width: Math.max(0, toX(endAt.value) - left) };
  });

  const startHandleStyle = useAnimatedStyle(() => ({
    left: toX(startAt.value) - HANDLE_WIDTH,
  }));

  const endHandleStyle = useAnimatedStyle(() => ({ left: toX(endAt.value) }));

  const measure = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  const adjust = (edge: 'start' | 'end', delta: number) => {
    onChange(
      edge === 'start' ? start + delta : start,
      edge === 'end' ? end + delta : end,
    );
  };

  return (
    <View className="px-6">
      <View
        onLayout={measure}
        style={CONTINUOUS_CURVE}
        className="h-12 justify-center rounded-sm bg-surface-sunken"
      >
        <Animated.View
          style={[blockStyle, { position: 'absolute' }]}
          pointerEvents="none"
        >
          <View
            style={CONTINUOUS_CURVE}
            className="h-12 w-full rounded-sm border border-border-strong bg-surface-elevated"
          />
        </Animated.View>

        <GestureDetector gesture={startPan}>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={startLabel}
            accessibilityValue={{ text: startValueLabel }}
            accessibilityActions={ADJUST_ACTIONS}
            onAccessibilityAction={(event) => {
              adjust(
                'start',
                event.nativeEvent.actionName === 'increment' ? step : -step,
              );
            }}
            hitSlop={HANDLE_HIT_SLOP}
            style={[startHandleStyle, { position: 'absolute' }]}
          >
            <View style={CONTINUOUS_CURVE} className="h-12 w-6 rounded-sm bg-action" />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={endPan}>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={endLabel}
            accessibilityValue={{ text: endValueLabel }}
            accessibilityActions={ADJUST_ACTIONS}
            onAccessibilityAction={(event) => {
              adjust('end', event.nativeEvent.actionName === 'increment' ? step : -step);
            }}
            hitSlop={HANDLE_HIT_SLOP}
            style={[endHandleStyle, { position: 'absolute' }]}
          >
            <View style={CONTINUOUS_CURVE} className="h-12 w-6 rounded-sm bg-action" />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}
