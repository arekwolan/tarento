import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useFontFallback } from '@/theme/fonts';
import {
  TABULAR_VARIANTS,
  textMetrics,
  textVariantClass,
  type TextVariant,
} from '@/theme/typography';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'on-accent'
  | 'on-action'
  | 'success'
  | 'warning'
  | 'danger';

const toneClass: Record<TextTone, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  accent: 'text-accent',
  'on-accent': 'text-on-accent',
  'on-action': 'text-on-action',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

/**
 * Jedyny sposób renderowania tekstu w aplikacji — nie używaj RN <Text> wprost
 * (pilnuje tego reguła ESLint).
 *
 * `allowFontScaling` zostaje włączone: układ musi przetrwać fontScale 1.3.
 * Warianty monospace dostają cyfry tabelaryczne, żeby zmieniająca się wartość
 * nie zmieniała szerokości ciągu.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  className,
  style,
  ...rest
}: TextProps) {
  const fallbackFamily = useFontFallback(textMetrics[variant].font);
  const isTabular = TABULAR_VARIANTS.includes(variant);

  return (
    <RNText
      allowFontScaling
      className={cn(textVariantClass[variant], toneClass[tone], className)}
      style={[
        fallbackFamily === undefined ? null : { fontFamily: fallbackFamily },
        isTabular ? { fontVariant: ['tabular-nums' as const] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
