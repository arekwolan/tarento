import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import type { TranslationKey } from '@/i18n/keys';

export type ControlledTextFieldProps<TValues extends FieldValues> = Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'onBlur' | 'errorMessage'
> & {
  control: Control<TValues>;
  name: Path<TValues>;
  /**
   * Zamienia surowy komunikat z react-hook-form na typowany klucz i18n.
   * To jedyne przejście z nietypowanego świata RHF — dzięki niemu żaden
   * nieznany string nie trafia na ekran.
   */
  messageKey: (message: string | undefined) => TranslationKey | undefined;
  /** Wołane dodatkowo przy każdej zmianie — np. do czyszczenia błędu formularza. */
  onValueChange?: (value: string) => void;
};

/** Pole formularza spięte z react-hook-form, z komunikatem błędu przez i18n. */
export function ControlledTextField<TValues extends FieldValues>({
  control,
  name,
  messageKey,
  onValueChange,
  ...fieldProps
}: ControlledTextFieldProps<TValues>) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorKey = messageKey(fieldState.error?.message);

        return (
          <TextField
            value={typeof field.value === 'string' ? field.value : ''}
            onChangeText={(text) => {
              field.onChange(text);
              onValueChange?.(text);
            }}
            onBlur={field.onBlur}
            errorMessage={errorKey === undefined ? undefined : t(errorKey)}
            {...fieldProps}
          />
        );
      }}
    />
  );
}
