import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { z } from 'zod';

import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  OptionCard,
  ProgressBar,
  Sheet,
  Skeleton,
  Text,
  TextField,
} from '@/components/ui';
import { usePersonalExperiment } from '@/features/experiments/api/use-personal-experiment';
import {
  comparePersonalExperiment,
  personalExperimentTargetFormSchema,
  personalExperimentTimeFormSchema,
  toPersonalExperimentDraftInput,
  type CreatePersonalExperimentDraftInput,
  type PersonalExperiment,
  type PersonalExperimentHypothesis,
} from '@/features/experiments/model/personal-experiment';
import {
  formatTargetValue,
  targetUnitKey,
  type Habit,
  type TimeOfDay,
} from '@/features/habits';
import type { TranslationKey } from '@/i18n/keys';
import { formatFullDay, type SupportedLocale } from '@/lib/date';
import type { DataError } from '@/lib/data-error';

const TIME_OPTIONS = [
  { value: 'morning', label: 'today.groups.morning' },
  { value: 'afternoon', label: 'today.groups.afternoon' },
  { value: 'evening', label: 'today.groups.evening' },
] as const satisfies readonly { value: TimeOfDay; label: TranslationKey }[];

const TIME_LABELS = {
  morning: 'today.groups.morning',
  afternoon: 'today.groups.afternoon',
  evening: 'today.groups.evening',
} as const satisfies Record<TimeOfDay, TranslationKey>;

function experimentErrorKey(error: DataError | null): TranslationKey | null {
  if (error === null) return null;
  if (error.isOffline) return 'experiments.errors.offline';
  if (error.message.includes('quiet week')) return 'experiments.errors.quietWeek';
  if (error.message.includes('not enough opportunities')) {
    return 'experiments.errors.notEnoughOpportunities';
  }
  if (error.message.includes('path conflict')) return 'experiments.errors.pathConflict';
  if (error.message.includes('another experiment open')) {
    return 'experiments.errors.anotherOpen';
  }
  if (error.message.includes('reminder opt-in')) {
    return 'experiments.errors.reminderUnavailable';
  }
  return 'experiments.errors.generic';
}

function variantLabel(
  experiment: PersonalExperiment,
  variant: PersonalExperiment['variantA'],
  habit: Habit,
  t: TFunction,
): string {
  if (experiment.hypothesis === 'time_of_day') {
    const time = variant.time_of_day;
    return time === null || time === undefined
      ? t('habits.form.timeOfDayNone')
      : t(TIME_LABELS[time]);
  }

  const value = variant.start_value ?? habit.startValue;
  const unitKey = targetUnitKey(habit.unit);
  return unitKey === null
    ? formatTargetValue(value)
    : t('experiments.targetWithUnit', {
        value: formatTargetValue(value),
        unit: t(unitKey),
      });
}

function TimeDraftForm({
  habit,
  isSubmitting,
  onSubmit,
}: {
  habit: Habit;
  isSubmitting: boolean;
  onSubmit: (values: CreatePersonalExperimentDraftInput) => void;
}) {
  const { t } = useTranslation();
  const initialA = habit.timeOfDay ?? 'morning';
  const initialB = initialA === 'evening' ? 'morning' : 'evening';
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isValid },
  } = useForm<z.input<typeof personalExperimentTimeFormSchema>>({
    resolver: zodResolver(personalExperimentTimeFormSchema),
    mode: 'onChange',
    defaultValues: {
      hypothesis: 'time_of_day',
      aTimeOfDay: initialA,
      bTimeOfDay: initialB,
      reminderOptIn: false,
    },
  });
  const aTime = useWatch({ control, name: 'aTimeOfDay' });
  const bTime = useWatch({ control, name: 'bTimeOfDay' });
  const reminderOptIn = useWatch({ control, name: 'reminderOptIn' });

  return (
    <View className="gap-4">
      <Text variant="label" tone="secondary">
        {t('experiments.form.variantA')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {TIME_OPTIONS.map((option) => (
          <Chip
            key={`a-${option.value}`}
            label={t(option.label)}
            selected={aTime === option.value}
            onPress={() => {
              setValue('aTimeOfDay', option.value, { shouldValidate: true });
            }}
          />
        ))}
      </View>

      <Text variant="label" tone="secondary">
        {t('experiments.form.variantB')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {TIME_OPTIONS.map((option) => (
          <Chip
            key={`b-${option.value}`}
            label={t(option.label)}
            selected={bTime === option.value}
            onPress={() => {
              setValue('bTimeOfDay', option.value, { shouldValidate: true });
            }}
          />
        ))}
      </View>

      <Divider />
      <Text variant="label" tone="secondary">
        {t('experiments.form.reminderQuestion')}
      </Text>
      <OptionCard
        title={t('experiments.form.reminderKeep')}
        description={t('experiments.form.reminderKeepDescription')}
        selected={!reminderOptIn}
        onPress={() => {
          setValue('reminderOptIn', false, { shouldValidate: true });
        }}
      />
      <OptionCard
        title={t('experiments.form.reminderAdjust')}
        description={t(
          habit.reminderTime === null
            ? 'experiments.form.reminderDisabledDescription'
            : 'experiments.form.reminderAdjustDescription',
        )}
        selected={reminderOptIn}
        disabled={habit.reminderTime === null}
        onPress={() => {
          setValue('reminderOptIn', true, { shouldValidate: true });
        }}
      />

      <Button
        label={t('experiments.form.preview')}
        loading={isSubmitting}
        disabled={!isValid}
        onPress={() => {
          void handleSubmit((values) => {
            onSubmit(toPersonalExperimentDraftInput(values));
          })();
        }}
      />
    </View>
  );
}

function TargetDraftForm({
  habit,
  isSubmitting,
  onSubmit,
}: {
  habit: Habit;
  isSubmitting: boolean;
  onSubmit: (values: CreatePersonalExperimentDraftInput) => void;
}) {
  const { t } = useTranslation();
  const smaller = Math.max(1, Math.round(habit.startValue / 2));
  const defaultB = smaller === habit.startValue ? habit.startValue + 1 : smaller;
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<z.input<typeof personalExperimentTargetFormSchema>>({
    resolver: zodResolver(personalExperimentTargetFormSchema),
    mode: 'onChange',
    defaultValues: {
      hypothesis: 'target_size',
      aTarget: String(habit.startValue),
      bTarget: String(defaultB),
    },
  });

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="aTarget"
        render={({ field, fieldState }) => (
          <TextField
            label={t('experiments.form.variantATarget')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            inputMode="decimal"
            errorMessage={
              fieldState.error === undefined
                ? undefined
                : t('experiments.form.targetError')
            }
          />
        )}
      />
      <Controller
        control={control}
        name="bTarget"
        render={({ field, fieldState }) => (
          <TextField
            label={t('experiments.form.variantBTarget')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            inputMode="decimal"
            errorMessage={
              fieldState.error === undefined
                ? undefined
                : t('experiments.form.targetDifferentError')
            }
          />
        )}
      />
      <Text variant="caption" tone="secondary">
        {t('experiments.form.oneVariableOnly')}
      </Text>
      <Button
        label={t('experiments.form.preview')}
        loading={isSubmitting}
        disabled={!isValid}
        onPress={() => {
          void handleSubmit((values) => {
            onSubmit(toPersonalExperimentDraftInput(values));
          })();
        }}
      />
    </View>
  );
}

function Configuration({
  habit,
  isSubmitting,
  onSubmit,
}: {
  habit: Habit;
  isSubmitting: boolean;
  onSubmit: (values: CreatePersonalExperimentDraftInput) => void;
}) {
  const { t } = useTranslation();
  const [hypothesis, setHypothesis] =
    useState<PersonalExperimentHypothesis>('time_of_day');

  return (
    <View className="gap-4">
      <Text variant="body" tone="secondary">
        {t('experiments.form.description')}
      </Text>
      <OptionCard
        title={t('experiments.hypothesis.time')}
        description={t('experiments.hypothesis.timeDescription')}
        selected={hypothesis === 'time_of_day'}
        onPress={() => {
          setHypothesis('time_of_day');
        }}
      />
      <OptionCard
        title={t('experiments.hypothesis.target')}
        description={t('experiments.hypothesis.targetDescription')}
        selected={hypothesis === 'target_size'}
        onPress={() => {
          setHypothesis('target_size');
        }}
      />
      <Divider />
      {hypothesis === 'time_of_day' ? (
        <TimeDraftForm habit={habit} isSubmitting={isSubmitting} onSubmit={onSubmit} />
      ) : (
        <TargetDraftForm habit={habit} isSubmitting={isSubmitting} onSubmit={onSubmit} />
      )}
    </View>
  );
}

function ExperimentPlan({
  experiment,
  habit,
  locale,
  isActing,
  onStart,
  onCancel,
}: {
  experiment: PersonalExperiment;
  habit: Habit;
  locale: SupportedLocale;
  isActing: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <Text variant="body" tone="secondary">
        {t('experiments.plan.description')}
      </Text>
      <Card>
        <View className="gap-2">
          <Text variant="label">{t('experiments.plan.blockA')}</Text>
          <Text variant="bodyLg">
            {variantLabel(experiment, experiment.variantA, habit, t)}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('experiments.plan.range', {
              count: experiment.opportunityTarget,
              from: formatFullDay(experiment.plannedAStart, locale),
              to: formatFullDay(experiment.plannedAEnd, locale),
            })}
          </Text>
        </View>
      </Card>
      <Card>
        <View className="gap-2">
          <Text variant="label">{t('experiments.plan.blockB')}</Text>
          <Text variant="bodyLg">
            {variantLabel(experiment, experiment.variantB, habit, t)}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('experiments.plan.range', {
              count: experiment.opportunityTarget,
              from: formatFullDay(experiment.plannedBStart, locale),
              to: formatFullDay(experiment.plannedBEnd, locale),
            })}
          </Text>
        </View>
      </Card>
      <Banner message={t('experiments.plan.neutralDays')} />
      <Button
        label={t('experiments.actions.start')}
        loading={isActing}
        onPress={onStart}
      />
      <Button
        label={t('experiments.actions.cancelDraft')}
        variant="ghost"
        disabled={isActing}
        onPress={onCancel}
      />
    </View>
  );
}

function ExperimentResult({
  experiment,
  isActing,
  onAction,
}: {
  experiment: PersonalExperiment;
  isActing: boolean;
  onAction: (action: 'choose_a' | 'choose_b' | 'choose_original') => void;
}) {
  const { t } = useTranslation();
  const comparison = comparePersonalExperiment(experiment);
  const resultKey = {
    a: 'experiments.result.aMoreOften',
    b: 'experiments.result.bMoreOften',
    tie: 'experiments.result.tie',
    too_early: 'experiments.result.tooEarly',
  } as const satisfies Record<typeof comparison.lead, TranslationKey>;

  return (
    <View className="gap-4">
      <Card variant="outlined">
        <View className="gap-3">
          <View className="flex-row justify-between gap-3">
            <Text variant="label">{t('experiments.plan.blockA')}</Text>
            <Text variant="num">
              {t('experiments.result.score', {
                completed: experiment.aCompleted,
                expected: experiment.aExpected,
              })}
            </Text>
          </View>
          <View className="flex-row justify-between gap-3">
            <Text variant="label">{t('experiments.plan.blockB')}</Text>
            <Text variant="num">
              {t('experiments.result.score', {
                completed: experiment.bCompleted,
                expected: experiment.bExpected,
              })}
            </Text>
          </View>
        </View>
      </Card>
      <Text variant="bodyLg">
        {t(resultKey[comparison.lead], {
          difference: comparison.differencePercentagePoints,
        })}
      </Text>
      <Text variant="caption" tone="secondary">
        {t('experiments.result.orderLimitation')}
      </Text>
      <Text variant="caption" tone="secondary">
        {t('experiments.result.sampleLimitation')}
      </Text>
      <Text variant="caption" tone="secondary">
        {t('experiments.result.conditionsLimitation')}
      </Text>
      {experiment.decision === null ? (
        <>
          <Divider />
          <Text variant="label">{t('experiments.result.choose')}</Text>
          <Button
            label={t('experiments.actions.chooseA')}
            loading={isActing}
            onPress={() => {
              onAction('choose_a');
            }}
          />
          <Button
            label={t('experiments.actions.chooseB')}
            variant="secondary"
            disabled={isActing}
            onPress={() => {
              onAction('choose_b');
            }}
          />
          <Button
            label={t('experiments.actions.chooseOriginal')}
            variant="ghost"
            disabled={isActing}
            onPress={() => {
              onAction('choose_original');
            }}
          />
        </>
      ) : (
        <Banner tone="success" message={t('experiments.result.decisionSaved')} />
      )}
    </View>
  );
}

function ActiveExperiment({
  experiment,
  isActing,
  isQueued,
  onPause,
  onResume,
  onCancel,
}: {
  experiment: PersonalExperiment;
  isActing: boolean;
  isQueued: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isA = experiment.currentBlock === 'a';
  const expected = isA ? experiment.aExpected : experiment.bExpected;

  return (
    <View className="gap-4">
      {isQueued ? <Banner message={t('experiments.status.queued')} /> : null}
      <Text variant="body" tone="secondary">
        {t('experiments.status.activeDescription')}
      </Text>
      <ProgressBar
        value={expected / experiment.opportunityTarget}
        accessibilityLabel={t('experiments.status.progressAccessibility', {
          current: expected,
          total: experiment.opportunityTarget,
        })}
      />
      <Text variant="num">
        {t('experiments.status.opportunities', {
          current: expected,
          total: experiment.opportunityTarget,
        })}
      </Text>
      <Banner message={t('experiments.plan.neutralDays')} />
      {experiment.state === 'paused' ? (
        <Button
          label={t('experiments.actions.resume')}
          loading={isActing}
          onPress={onResume}
        />
      ) : (
        <Button
          label={t('experiments.actions.pause')}
          variant="secondary"
          loading={isActing}
          onPress={onPause}
        />
      )}
      <Button
        label={t('experiments.actions.cancel')}
        variant="ghost"
        disabled={isActing}
        onPress={onCancel}
      />
    </View>
  );
}

export function PersonalExperimentCard({
  habit,
  isOnline,
}: {
  habit: Habit;
  isOnline: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale: SupportedLocale = i18n.language.startsWith('en') ? 'en' : 'pl';
  const [isOpen, setIsOpen] = useState(false);
  const experimentState = usePersonalExperiment(habit);
  const experiment = experimentState.experiment;
  const queryErrorKey = experimentErrorKey(experimentState.error);
  const mutationErrorKey = experimentErrorKey(experimentState.mutationError);
  const isClosed =
    experiment?.state === 'cancelled' ||
    (experiment?.state === 'completed' && experiment.decision !== null);
  const currentExpected =
    experiment?.currentBlock === 'b'
      ? experiment.bExpected
      : (experiment?.aExpected ?? 0);

  const createDraft = (values: CreatePersonalExperimentDraftInput) => {
    void experimentState.createDraft(values);
  };

  const run = (
    action:
      | 'start'
      | 'pause'
      | 'resume'
      | 'cancel'
      | 'choose_a'
      | 'choose_b'
      | 'choose_original',
  ) => {
    void experimentState.runAction(action).then((saved) => {
      if (saved && (action === 'cancel' || action.startsWith('choose_'))) {
        setIsOpen(false);
      }
    });
  };

  if (experimentState.isLoading) {
    return (
      <Card>
        <View className="gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
        </View>
      </Card>
    );
  }

  if (experimentState.error !== null && experiment === null) {
    return (
      <Card>
        <View className="gap-3">
          <Text variant="title">{t('experiments.title')}</Text>
          <Banner message={t(queryErrorKey ?? 'experiments.errors.generic')} />
          <Button
            label={t('common.retry')}
            variant="secondary"
            onPress={experimentState.refetch}
          />
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text variant="title">{t('experiments.title')}</Text>
              <Text variant="caption" tone="secondary">
                {experiment === null || isClosed
                  ? t('experiments.empty')
                  : experiment.state === 'draft'
                    ? t('experiments.status.draft')
                    : experiment.state === 'completed'
                      ? t('experiments.status.completed')
                      : t('experiments.status.block', {
                          block: experiment.currentBlock?.toUpperCase() ?? 'A',
                          current: currentExpected,
                          total: experiment.opportunityTarget,
                        })}
              </Text>
            </View>
          </View>
          {experiment !== null && !isClosed && experiment.state !== 'draft' ? (
            <ProgressBar
              value={currentExpected / experiment.opportunityTarget}
              accessibilityLabel={t('experiments.status.progressAccessibility', {
                current: currentExpected,
                total: experiment.opportunityTarget,
              })}
            />
          ) : null}
          <Button
            label={t(
              experiment === null || isClosed
                ? 'experiments.actions.create'
                : experiment.state === 'completed'
                  ? 'experiments.actions.seeResult'
                  : 'experiments.actions.details',
            )}
            variant="secondary"
            onPress={() => {
              setIsOpen(true);
            }}
          />
        </View>
      </Card>

      <Sheet
        visible={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        title={t('experiments.title')}
        closeLabel={t('experiments.actions.close')}
      >
        {!isOnline ? <Banner message={t('experiments.errors.offline')} /> : null}
        {mutationErrorKey === null ? null : <Banner message={t(mutationErrorKey)} />}

        {experiment === null || isClosed ? (
          <Configuration
            habit={habit}
            isSubmitting={experimentState.isCreating}
            onSubmit={createDraft}
          />
        ) : experiment.state === 'draft' ? (
          <ExperimentPlan
            experiment={experiment}
            habit={habit}
            locale={locale}
            isActing={experimentState.isActing}
            onStart={() => {
              run('start');
            }}
            onCancel={() => {
              run('cancel');
            }}
          />
        ) : experiment.state === 'completed' ? (
          <ExperimentResult
            experiment={experiment}
            isActing={experimentState.isActing}
            onAction={run}
          />
        ) : (
          <ActiveExperiment
            experiment={experiment}
            isActing={experimentState.isActing}
            isQueued={experimentState.isQueued}
            onPause={() => {
              run('pause');
            }}
            onResume={() => {
              run('resume');
            }}
            onCancel={() => {
              run('cancel');
            }}
          />
        )}
        <Button
          label={t('experiments.actions.close')}
          variant="ghost"
          onPress={() => {
            setIsOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}
