import { useEffect } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Button, Divider, OptionCard, Sheet, Text, TextField } from '@/components/ui';
import type { StageTransferCheck } from '@/features/paths/api/use-stage-advance';
import {
  pathTransferFormSchema,
  TRANSFER_EVIDENCE_MAX_LENGTH,
  type PathTransferFormValues,
  type TransferDecision,
} from '@/features/paths/model/transfer';

export type PathTransferSheetProps = {
  check: StageTransferCheck | null;
  canDownshift: boolean;
  isPending: boolean;
  isQueued: boolean;
  onClose: () => void;
  onSubmit: (input: {
    response: NonNullable<PathTransferFormValues['response']>;
    decision: TransferDecision;
    evidence: string;
  }) => void;
};

export function PathTransferSheet({
  check,
  canDownshift,
  isPending,
  isQueued,
  onClose,
  onSubmit,
}: PathTransferSheetProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm<PathTransferFormValues>({
    resolver: zodResolver(pathTransferFormSchema),
    defaultValues: { response: null, evidence: '' },
  });
  const response = useWatch({ control, name: 'response' });
  const evidence = useWatch({ control, name: 'evidence' });

  useEffect(() => {
    reset({ response: null, evidence: '' });
  }, [check?.stage.id, reset]);

  if (check === null) return null;

  const submitDecision = (decision: TransferDecision) => {
    void handleSubmit((values) => {
      if (values.response === null) return;
      onSubmit({ response: values.response, decision, evidence: values.evidence });
    })();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('path.transfer.question')}
      closeLabel={t('path.transfer.close')}
    >
      <Text variant="body" tone="secondary">
        {t('path.transfer.notQuiz')}
      </Text>

      <Controller
        control={control}
        name="response"
        render={({ field }) => (
          <View accessibilityRole="radiogroup" className="gap-3">
            <OptionCard
              title={t('path.transfer.answerYes')}
              selected={field.value === 'yes'}
              onPress={() => {
                field.onChange('yes');
              }}
            />
            <OptionCard
              title={t('path.transfer.answerNotYet')}
              selected={field.value === 'not_yet'}
              onPress={() => {
                field.onChange('not_yet');
              }}
            />
            <OptionCard
              title={t('path.transfer.answerNoOpportunity')}
              description={t('path.transfer.noOpportunityHint')}
              selected={field.value === 'no_opportunity'}
              onPress={() => {
                field.onChange('no_opportunity');
              }}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="evidence"
        render={({ field, fieldState }) => (
          <TextField
            label={t('path.transfer.evidenceLabel')}
            placeholder={t('path.transfer.evidencePlaceholder')}
            hint={t('path.transfer.evidenceHint', {
              current: evidence.length,
              max: TRANSFER_EVIDENCE_MAX_LENGTH,
            })}
            errorMessage={fieldState.error?.message}
            multiline
            numberOfLines={3}
            maxLength={TRANSFER_EVIDENCE_MAX_LENGTH}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
          />
        )}
      />

      {check.transition === null ? null : (
        <View className="gap-3">
          <Divider />
          <Text variant="label" tone="secondary">
            {t('path.transfer.afterAdvance')}
          </Text>
          <Text variant="bodyLg">
            {t('path.stage', {
              ordinal: check.transition.nextStage.ordinal,
              name: check.transition.nextStage.name,
            })}
          </Text>
          {check.transition.adds.map((practice) => (
            <Text key={practice.id} variant="caption" tone="secondary">
              {t('path.transfer.addsPractice', { practice: practice.title })}
            </Text>
          ))}
          {check.transition.removes.map((practice) => (
            <Text key={practice.id} variant="caption" tone="secondary">
              {t('path.transfer.retiresPractice', { practice: practice.title })}
            </Text>
          ))}
        </View>
      )}

      {isQueued ? <Text variant="caption">{t('path.transfer.queued')}</Text> : null}

      {response === 'not_yet' ? (
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            {t('path.transfer.notYetNeutral')}
          </Text>
          <Button
            label={t('path.transfer.stay')}
            loading={isPending}
            onPress={() => {
              submitDecision('stay');
            }}
          />
          <Button
            label={t('path.transfer.downshift')}
            variant="secondary"
            disabled={!canDownshift || isPending}
            onPress={() => {
              submitDecision('downshift');
            }}
          />
          <Button
            label={t('path.transfer.advanceConsciously')}
            variant="ghost"
            disabled={isPending}
            onPress={() => {
              submitDecision('advance');
            }}
          />
        </View>
      ) : response === 'no_opportunity' ? (
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            {t('path.transfer.noOpportunityNeutral')}
          </Text>
          <Button
            label={t('path.transfer.extend')}
            loading={isPending}
            onPress={() => {
              submitDecision('stay');
            }}
          />
          <Button
            label={t('path.transfer.advanceConsciously')}
            variant="ghost"
            disabled={isPending}
            onPress={() => {
              submitDecision('advance');
            }}
          />
        </View>
      ) : response === 'yes' ? (
        <View className="gap-3">
          <Button
            label={
              check.isFinalStage ? t('path.transfer.finish') : t('path.transfer.advance')
            }
            loading={isPending}
            onPress={() => {
              submitDecision('advance');
            }}
          />
          <Button
            label={t('path.transfer.stay')}
            variant="ghost"
            disabled={isPending}
            onPress={() => {
              submitDecision('stay');
            }}
          />
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          {t('path.transfer.chooseAnswer')}
        </Text>
      )}
    </Sheet>
  );
}
