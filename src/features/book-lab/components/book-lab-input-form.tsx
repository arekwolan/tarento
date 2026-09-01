import { useEffect } from 'react';
import { View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, ControlledTextField, Text } from '@/components/ui';
import {
  BOOK_LAB_LIMITS,
  bookLabFormSchema,
  type BookLabFormValues,
} from '@/features/book-lab/model/schemas';
import type { TranslationKey } from '@/i18n/keys';

export type BookLabInputFormProps = {
  initialValues: BookLabFormValues;
  isOnline: boolean;
  isGenerating: boolean;
  errorMessage?: string;
  onValuesChange: (values: BookLabFormValues) => void;
  onSubmit: (values: BookLabFormValues) => void;
  onCancel: () => void;
};

function validationKey(message: string | undefined): TranslationKey | undefined {
  switch (message) {
    case 'bookLab.validation.titleRequired':
    case 'bookLab.validation.titleLong':
    case 'bookLab.validation.authorRequired':
    case 'bookLab.validation.authorLong':
    case 'bookLab.validation.changeRequired':
    case 'bookLab.validation.changeLong':
    case 'bookLab.validation.noteRequired':
    case 'bookLab.validation.noteLong':
    case 'bookLab.validation.locatorLong':
    case 'bookLab.validation.notesMin':
    case 'bookLab.validation.notesMax':
      return message;
    default:
      return undefined;
  }
}

export function BookLabInputForm({
  initialValues,
  isOnline,
  isGenerating,
  errorMessage,
  onValuesChange,
  onSubmit,
  onCancel,
}: BookLabInputFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, getValues, formState } = useForm<BookLabFormValues>({
    resolver: zodResolver(bookLabFormSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'notes' });
  const watchedValues = useWatch({ control });

  useEffect(() => {
    onValuesChange(getValues());
  }, [getValues, onValuesChange, watchedValues]);

  return (
    <View className="gap-5">
      {errorMessage === undefined ? null : (
        <Banner tone="danger" message={errorMessage} />
      )}

      <Card variant="outlined" className="gap-2">
        <Text variant="label" tone="secondary">
          {t('bookLab.privacy.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('bookLab.privacy.description')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('bookLab.privacy.noChapters')}
        </Text>
      </Card>

      <ControlledTextField
        control={control}
        name="sourceTitle"
        messageKey={validationKey}
        label={t('bookLab.fields.title')}
        maxLength={BOOK_LAB_LIMITS.sourceTitle}
        autoCapitalize="sentences"
      />
      <ControlledTextField
        control={control}
        name="sourceAuthor"
        messageKey={validationKey}
        label={t('bookLab.fields.author')}
        maxLength={BOOK_LAB_LIMITS.sourceAuthor}
        autoCapitalize="words"
      />
      <ControlledTextField
        control={control}
        name="desiredChange"
        messageKey={validationKey}
        label={t('bookLab.fields.change')}
        hint={t('bookLab.fields.changeHint')}
        maxLength={BOOK_LAB_LIMITS.desiredChange}
        multiline
        numberOfLines={3}
      />

      <View className="gap-3">
        <View className="gap-1">
          <Text variant="title">{t('bookLab.notes.title')}</Text>
          <Text variant="body" tone="secondary">
            {t('bookLab.notes.description')}
          </Text>
        </View>

        {fields.map((field, index) => (
          <Card key={field.id} className="gap-3">
            <Text variant="label" tone="secondary">
              {t('bookLab.notes.number', { number: index + 1 })}
            </Text>
            <ControlledTextField
              control={control}
              name={`notes.${index}.content`}
              messageKey={validationKey}
              label={t('bookLab.fields.note')}
              hint={t('bookLab.fields.noteLimit', { limit: BOOK_LAB_LIMITS.note })}
              maxLength={BOOK_LAB_LIMITS.note}
              multiline
              numberOfLines={4}
            />
            <ControlledTextField
              control={control}
              name={`notes.${index}.sourceLocator`}
              messageKey={validationKey}
              label={t('bookLab.fields.locator')}
              placeholder={t('bookLab.fields.locatorPlaceholder')}
              maxLength={BOOK_LAB_LIMITS.locator}
            />
            {fields.length <= BOOK_LAB_LIMITS.minNotes ? null : (
              <Button
                label={t('bookLab.notes.remove')}
                variant="ghost"
                onPress={() => {
                  remove(index);
                }}
              />
            )}
          </Card>
        ))}

        {typeof formState.errors.notes?.message !== 'string' ? null : (
          <Text variant="caption" tone="danger">
            {t(
              validationKey(formState.errors.notes.message) ??
                'bookLab.validation.notesMin',
            )}
          </Text>
        )}

        {fields.length >= BOOK_LAB_LIMITS.maxNotes ? null : (
          <Button
            label={t('bookLab.notes.add')}
            variant="secondary"
            onPress={() => {
              append({ content: '', sourceLocator: '' });
            }}
          />
        )}
      </View>

      <Button
        label={t('bookLab.generate')}
        size="lg"
        loading={isGenerating}
        disabled={!isOnline}
        onPress={handleSubmit(onSubmit)}
      />
      <Button label={t('common.back')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
