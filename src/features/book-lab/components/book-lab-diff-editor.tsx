import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Chip, Divider, Text, TextField } from '@/components/ui';
import { buildBookLabDiff } from '@/features/book-lab/model/diff';
import type {
  BookLabCategory,
  BookLabContext,
  BookLabDraft,
  BookLabScheduleType,
  BookLabStage,
  BookLabTimeOfDay,
} from '@/features/book-lab/model/schemas';
import type { TranslationKey } from '@/i18n/keys';

const TIME_OPTIONS = [
  { value: 'morning', label: 'today.groups.morning' },
  { value: 'afternoon', label: 'today.groups.afternoon' },
  { value: 'evening', label: 'today.groups.evening' },
] as const satisfies readonly { value: BookLabTimeOfDay; label: TranslationKey }[];

const CATEGORY_OPTIONS = [
  { value: 'focus', label: 'categories.focus' },
  { value: 'mindfulness', label: 'categories.mindfulness' },
  { value: 'health', label: 'categories.health' },
  { value: 'learning', label: 'categories.learning' },
  { value: 'relationships', label: 'categories.relationships' },
] as const satisfies readonly { value: BookLabCategory; label: TranslationKey }[];

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'habits.form.scheduleDaily' },
  { value: 'weekdays', label: 'habits.form.scheduleWeekdays' },
  { value: 'custom', label: 'habits.form.scheduleCustom' },
] as const satisfies readonly { value: BookLabScheduleType; label: TranslationKey }[];

const DAY_LABELS = [
  'dayShort.sun',
  'dayShort.mon',
  'dayShort.tue',
  'dayShort.wed',
  'dayShort.thu',
  'dayShort.fri',
  'dayShort.sat',
] as const satisfies readonly TranslationKey[];

function numberValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function NoteReferenceChips({
  values,
  noteCount,
  onChange,
}: {
  values: readonly number[];
  noteCount: number;
  onChange: (values: number[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <Text variant="caption" tone="tertiary">
        {t('bookLab.diff.fromNotes', { notes: values.join(', ') })}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {Array.from({ length: noteCount }, (_, index) => index + 1).map((ordinal) => {
          const selected = values.includes(ordinal);
          return (
            <Chip
              key={ordinal}
              label={t('bookLab.diff.noteRef', { number: ordinal })}
              selected={selected}
              onPress={() => {
                if (selected && values.length === 1) return;
                onChange(
                  selected
                    ? values.filter((value) => value !== ordinal)
                    : [...values, ordinal].sort((left, right) => left - right),
                );
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export type BookLabDiffEditorProps = {
  draft: BookLabDraft;
  context: BookLabContext;
  noteCount: number;
  selectedOrdinals: readonly number[];
  isSaving: boolean;
  canSave: boolean;
  errorMessage?: string;
  onDraftChange: (draft: BookLabDraft) => void;
  onToggleStage: (ordinal: number) => void;
  onSave: () => void;
  onEditNotes: () => void;
  onDiscard: () => void;
};

export function BookLabDiffEditor({
  draft,
  context,
  noteCount,
  selectedOrdinals,
  isSaving,
  canSave,
  errorMessage,
  onDraftChange,
  onToggleStage,
  onSave,
  onEditNotes,
  onDiscard,
}: BookLabDiffEditorProps) {
  const { t } = useTranslation();
  const selected = new Set(selectedOrdinals);
  const diffs = buildBookLabDiff(draft, context, selectedOrdinals);

  const updateStage = (
    ordinal: number,
    update: (stage: BookLabStage) => BookLabStage,
  ) => {
    onDraftChange({
      ...draft,
      stages: draft.stages.map((stage) =>
        stage.ordinal === ordinal ? update(stage) : stage,
      ),
    });
  };

  return (
    <View className="gap-5">
      {errorMessage === undefined ? null : (
        <Banner tone="danger" message={errorMessage} />
      )}
      {context.activePath.exists ? (
        <Banner message={t('bookLab.diff.activePath')} />
      ) : null}

      <Card variant="outlined" className="gap-2">
        <Text variant="title">{t('bookLab.diff.budgetTitle')}</Text>
        <Text variant="body" tone="secondary">
          {t('bookLab.diff.budget', {
            allocated: context.allocatedMinutes,
            used: context.usedMinutes,
            free: context.freeMinutes,
            safe: context.safeMinutes,
          })}
        </Text>
      </Card>

      <TextField
        label={t('bookLab.diff.protocolTitle')}
        value={draft.title}
        maxLength={120}
        onChangeText={(title) => {
          onDraftChange({ ...draft, title });
        }}
      />
      <TextField
        label={t('bookLab.diff.summary')}
        value={draft.summary}
        maxLength={240}
        multiline
        onChangeText={(summary) => {
          onDraftChange({ ...draft, summary });
        }}
      />

      {diffs.map(({ stage, kind, bandCollision }) => {
        const isSelected = selected.has(stage.ordinal);
        if (!isSelected) {
          return (
            <Card key={stage.ordinal} variant="outlined" className="gap-3">
              <Text variant="title">
                {t('bookLab.diff.stage', { ordinal: stage.ordinal })}
              </Text>
              <Text variant="body" tone="secondary">
                {t('bookLab.diff.rejected')}
              </Text>
              <Button
                label={t('bookLab.diff.restore')}
                variant="secondary"
                onPress={() => {
                  onToggleStage(stage.ordinal);
                }}
              />
            </Card>
          );
        }

        return (
          <Card key={stage.ordinal} className="gap-4">
            <View className="gap-1">
              <Text variant="label" tone="secondary">
                {t(`bookLab.diff.kind.${kind}`)}
              </Text>
              <Text variant="title">
                {t('bookLab.diff.stage', { ordinal: stage.ordinal })}
              </Text>
            </View>

            {kind === 'does_not_fit' ? (
              <Banner
                tone="danger"
                message={t('bookLab.diff.doesNotFit', {
                  minutes: stage.dailyMinutes,
                  safe: context.safeMinutes,
                })}
              />
            ) : null}
            {bandCollision ? <Banner message={t('bookLab.diff.bandCollision')} /> : null}

            <TextField
              label={t('bookLab.diff.stageName')}
              value={stage.name}
              maxLength={80}
              onChangeText={(name) => {
                updateStage(stage.ordinal, (current) => ({ ...current, name }));
              }}
            />
            <TextField
              label={t('bookLab.diff.stageDescription')}
              value={stage.description}
              maxLength={240}
              multiline
              onChangeText={(description) => {
                updateStage(stage.ordinal, (current) => ({ ...current, description }));
              }}
            />
            <TextField
              label={t('bookLab.diff.minutes')}
              value={String(stage.dailyMinutes)}
              keyboardType="number-pad"
              onChangeText={(value) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  dailyMinutes: numberValue(value),
                }));
              }}
            />

            <Divider />
            <Text variant="label" tone="secondary">
              {t('bookLab.diff.practice')}
            </Text>
            <TextField
              label={t('bookLab.diff.practiceTitle')}
              value={stage.practice.title}
              maxLength={80}
              onChangeText={(title) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  practice: { ...current.practice, title },
                }));
              }}
            />
            <TextField
              label={t('bookLab.diff.why')}
              value={stage.practice.why}
              maxLength={240}
              multiline
              onChangeText={(why) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  practice: { ...current.practice, why },
                }));
              }}
            />
            <TextField
              label={t('bookLab.diff.how')}
              value={stage.practice.how}
              maxLength={240}
              multiline
              onChangeText={(how) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  practice: { ...current.practice, how },
                }));
              }}
            />
            <TextField
              label={t('bookLab.diff.whenHard')}
              value={stage.practice.whenHard}
              maxLength={180}
              multiline
              onChangeText={(whenHard) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  practice: { ...current.practice, whenHard },
                }));
              }}
            />

            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('bookLab.diff.frequency')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SCHEDULE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.label)}
                    selected={stage.practice.scheduleType === option.value}
                    onPress={() => {
                      updateStage(stage.ordinal, (current) => ({
                        ...current,
                        practice: {
                          ...current.practice,
                          scheduleType: option.value,
                          scheduleDays: option.value === 'custom' ? [1] : [],
                        },
                      }));
                    }}
                  />
                ))}
              </View>
            </View>

            {stage.practice.scheduleType !== 'custom' ? null : (
              <View className="flex-row flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => {
                  const daySelected = stage.practice.scheduleDays.includes(day);
                  return (
                    <Chip
                      key={label}
                      label={t(label)}
                      selected={daySelected}
                      onPress={() => {
                        updateStage(stage.ordinal, (current) => ({
                          ...current,
                          practice: {
                            ...current.practice,
                            scheduleDays: daySelected
                              ? current.practice.scheduleDays.filter(
                                  (currentDay) => currentDay !== day,
                                )
                              : [...current.practice.scheduleDays, day].sort(
                                  (left, right) => left - right,
                                ),
                          },
                        }));
                      }}
                    />
                  );
                })}
              </View>
            )}

            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('bookLab.diff.band')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TIME_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.label)}
                    selected={stage.practice.timeOfDay === option.value}
                    onPress={() => {
                      updateStage(stage.ordinal, (current) => ({
                        ...current,
                        practice: { ...current.practice, timeOfDay: option.value },
                      }));
                    }}
                  />
                ))}
              </View>
            </View>

            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('bookLab.diff.category')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.label)}
                    selected={stage.practice.category === option.value}
                    onPress={() => {
                      updateStage(stage.ordinal, (current) => ({
                        ...current,
                        practice: { ...current.practice, category: option.value },
                      }));
                    }}
                  />
                ))}
              </View>
            </View>

            <NoteReferenceChips
              values={stage.practice.noteOrdinals}
              noteCount={noteCount}
              onChange={(noteOrdinals) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  practice: { ...current.practice, noteOrdinals },
                }));
              }}
            />

            {stage.environmentSetup === null ? null : (
              <View className="gap-2">
                <Divider />
                <TextField
                  label={t('bookLab.diff.setup')}
                  value={stage.environmentSetup.text}
                  maxLength={240}
                  multiline
                  onChangeText={(text) => {
                    updateStage(stage.ordinal, (current) => ({
                      ...current,
                      environmentSetup:
                        current.environmentSetup === null
                          ? null
                          : { ...current.environmentSetup, text },
                    }));
                  }}
                />
                <NoteReferenceChips
                  values={stage.environmentSetup.noteOrdinals}
                  noteCount={noteCount}
                  onChange={(noteOrdinals) => {
                    updateStage(stage.ordinal, (current) => ({
                      ...current,
                      environmentSetup:
                        current.environmentSetup === null
                          ? null
                          : { ...current.environmentSetup, noteOrdinals },
                    }));
                  }}
                />
                <Button
                  label={t('bookLab.diff.rejectSetup')}
                  variant="ghost"
                  onPress={() => {
                    updateStage(stage.ordinal, (current) => ({
                      ...current,
                      environmentSetup: null,
                    }));
                  }}
                />
              </View>
            )}

            <Divider />
            <TextField
              label={t('bookLab.diff.criterion')}
              value={stage.transition.criterion}
              maxLength={240}
              multiline
              onChangeText={(criterion) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  transition: { ...current.transition, criterion },
                }));
              }}
            />
            <NoteReferenceChips
              values={stage.transition.noteOrdinals}
              noteCount={noteCount}
              onChange={(noteOrdinals) => {
                updateStage(stage.ordinal, (current) => ({
                  ...current,
                  transition: { ...current.transition, noteOrdinals },
                }));
              }}
            />
            <View className="flex-row gap-3">
              <TextField
                containerClassName="flex-1"
                label={t('bookLab.diff.minDays')}
                value={String(stage.transition.minDays)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  updateStage(stage.ordinal, (current) => ({
                    ...current,
                    transition: {
                      ...current.transition,
                      minDays: numberValue(value),
                    },
                  }));
                }}
              />
              <TextField
                containerClassName="flex-1"
                label={t('bookLab.diff.maxDays')}
                value={String(stage.transition.maxDays)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  updateStage(stage.ordinal, (current) => ({
                    ...current,
                    transition: {
                      ...current.transition,
                      maxDays: numberValue(value),
                    },
                  }));
                }}
              />
            </View>

            <Button
              label={t('bookLab.diff.rejectStage')}
              variant="ghost"
              onPress={() => {
                onToggleStage(stage.ordinal);
              }}
            />
          </Card>
        );
      })}

      {!canSave ? (
        <Banner tone="danger" message={t('bookLab.diff.fixBeforeSave')} />
      ) : null}
      <Button
        label={t('bookLab.diff.save')}
        size="lg"
        loading={isSaving}
        disabled={!canSave}
        onPress={onSave}
      />
      <Button
        label={t('bookLab.diff.editNotes')}
        variant="secondary"
        onPress={onEditNotes}
      />
      <Button
        label={t('bookLab.diff.discard')}
        variant="destructive"
        onPress={onDiscard}
      />
    </View>
  );
}
