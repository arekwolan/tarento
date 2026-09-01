import { useState, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useControlRadius } from '@/components/ui/surface-radius';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useFontFallback } from '@/theme/fonts';
import { CONTINUOUS_CURVE } from '@/theme/radii';
import { useTheme } from '@/theme/theme-provider';

export type TextFieldProps = Omit<TextInputProps, 'placeholderTextColor'> & {
  /** Gotowy tekst — przekazuj wynik t(), nigdy literał. */
  label: string;
  /** Gotowy komunikat błędu. Jego obecność przełącza pole w stan błędu. */
  errorMessage?: string;
  hint?: string;
  containerClassName?: string;
  ref?: Ref<TextInput>;
};

export function TextField({
  label,
  errorMessage,
  hint,
  containerClassName,
  className,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { color } = useTheme();
  const fallbackFamily = useFontFallback('sans');
  const borderRadius = useControlRadius('sm');
  const [isFocused, setIsFocused] = useState(false);
  const hasError = errorMessage !== undefined;

  return (
    <View className={cn('gap-1', containerClassName)}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        allowFontScaling
        placeholderTextColor={color('text-tertiary')}
        selectionColor={color('text-primary')}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        className={cn(
          'min-h-12 border border-hairline bg-surface px-4 py-3 font-sans text-body text-primary',
          isFocused && 'border-border-strong',
          hasError && 'border-danger',
          className,
        )}
        style={[
          CONTINUOUS_CURVE,
          { borderRadius },
          fallbackFamily === undefined ? null : { fontFamily: fallbackFamily },
          style,
        ]}
        {...rest}
      />
      {hasError ? (
        <Text variant="caption" tone="danger">
          {errorMessage}
        </Text>
      ) : null}
      {!hasError && hint !== undefined ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
