import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePressClass } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/elevation';
import { concentricRadius, CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

/**
 * Akcja siedzi 8 dp od prawej krawędzi toasta (`pr-2`), więc jej promień
 * wynika z promienia toasta, a nie ze skali kontrolek.
 */
const ACTION_RADIUS = concentricRadius('md', 8);

/**
 * Toast z akcją „Cofnij".
 *
 * Reguła systemu: akcję odwracalną wykonujemy od razu i dajemy 5 sekund na
 * wycofanie. Dialog potwierdzenia zostaje wyłącznie dla operacji, których
 * cofnąć się nie da.
 */
const TOAST_DURATION_MS = 5000;

export type ToastRequest = {
  /** Gotowy tekst — przekazuj wynik t(), nigdy literał. */
  message: string;
  action?: {
    /** Gotowa etykieta, zwykle t('common.undo'). */
    label: string;
    onPress: () => void;
  };
};

type ToastContextValue = {
  show: (toast: ToastRequest) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Odsłonięty toast plus licznik, żeby ten sam komunikat renderował się od nowa. */
type ToastState = { toast: ToastRequest; sequence: number };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setState(null);
  }, [clearTimer]);

  const show = useCallback(
    (toast: ToastRequest) => {
      clearTimer();
      sequence.current += 1;
      setState({ toast, sequence: sequence.current });
      timer.current = setTimeout(() => {
        setState(null);
        timer.current = null;
      }, TOAST_DURATION_MS);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {state === null ? null : (
        <ToastView key={state.sequence} toast={state.toast} onDismiss={dismiss} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error('useToast() wymaga <ToastProvider> wyżej w drzewie.');
  }
  return value;
}

function ToastView({ toast, onDismiss }: { toast: ToastRequest; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const pressClass = usePressClass();
  const reducedMotion = useReducedMotion();

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-5"
      style={{ paddingBottom: insets.bottom + 16 }}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={reducedMotion ? FadeIn : FadeInDown}
        exiting={FadeOut}
        style={elevation(scheme, 'sheet')}
      >
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={CONTINUOUS_CURVE}
          className="flex-row items-center gap-4 rounded-md border border-border bg-surface-elevated py-2 pl-4 pr-2"
        >
          <Text variant="body" className="flex-1">
            {toast.message}
          </Text>

          {toast.action === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              onPress={() => {
                toast.action?.onPress();
                onDismiss();
              }}
              style={[CONTINUOUS_CURVE, { borderRadius: ACTION_RADIUS }]}
              className={cn(
                'min-h-12 min-w-12 items-center justify-center px-4',
                pressClass,
              )}
            >
              <Text variant="label">{toast.action.label}</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
