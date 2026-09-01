import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import {
  clearBookLabLocalDraft,
  loadBookLabLocalDraft,
  saveBookLabLocalDraft,
} from '@/features/book-lab/api/storage';
import { BookLabDiffEditor } from '@/features/book-lab/components/book-lab-diff-editor';
import { BookLabInputForm } from '@/features/book-lab/components/book-lab-input-form';
import {
  canSaveBookLabDraft,
  selectedBookLabDraft,
} from '@/features/book-lab/model/diff';
import { createBookLabRequestId } from '@/features/book-lab/model/request-id';
import {
  bookLabDraftSchema,
  EMPTY_BOOK_LAB_FORM,
  type BookLabDraft,
  type BookLabFormValues,
} from '@/features/book-lab/model/schemas';
import { useBookLab } from '@/features/book-lab/hooks/use-book-lab';
import { useAuth } from '@/features/auth';
import { usePrivateBookProtocols } from '@/features/paths';
import type { TranslationKey } from '@/i18n/keys';
import { useIsOnline } from '@/lib/network';

export function BookLabScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isOnline = useIsOnline();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const persisted = useMemo(
    () => (userId === '' ? null : loadBookLabLocalDraft(userId)),
    [userId],
  );
  const [requestId, setRequestId] = useState(
    () => persisted?.requestId ?? createBookLabRequestId(),
  );
  const [formValues, setFormValues] = useState<BookLabFormValues>(
    () => persisted?.form ?? EMPTY_BOOK_LAB_FORM,
  );
  const [basePathId, setBasePathId] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState<BookLabDraft | null>(null);
  const [selectedOrdinals, setSelectedOrdinals] = useState<number[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const lab = useBookLab();
  const { paths: privatePaths, error: privatePathsError } = usePrivateBookProtocols();

  useEffect(() => {
    if (lab.savedPathId !== null && userId !== '') clearBookLabLocalDraft(userId);
  }, [lab.savedPathId, userId]);

  const finishDiscard = () => {
    if (userId !== '') clearBookLabLocalDraft(userId);
    setEditedDraft(null);
    setSelectedOrdinals([]);
    setConfirmDiscard(false);
    setBasePathId(null);
    setFormValues(EMPTY_BOOK_LAB_FORM);
    setRequestId(createBookLabRequestId());
  };

  const persistValues = useCallback(
    (values: BookLabFormValues) => {
      setFormValues(values);
      if (userId !== '') saveBookLabLocalDraft(userId, { requestId, form: values });
    },
    [requestId, userId],
  );

  const selectedDraft = useMemo(
    () =>
      editedDraft === null ? null : selectedBookLabDraft(editedDraft, selectedOrdinals),
    [editedDraft, selectedOrdinals],
  );
  const selectedIsValid =
    selectedDraft !== null && bookLabDraftSchema.safeParse(selectedDraft).success;
  const canSave =
    selectedDraft !== null &&
    lab.response !== null &&
    selectedIsValid &&
    canSaveBookLabDraft(selectedDraft, lab.response.context) &&
    isOnline;

  const startFreshRequest = (
    nextBasePathId: string | null,
    nextFormValues: BookLabFormValues = formValues,
  ) => {
    lab.reset();
    setEditedDraft(null);
    setSelectedOrdinals([]);
    setBasePathId(nextBasePathId);
    setFormValues(nextFormValues);
    const nextRequestId = createBookLabRequestId();
    setRequestId(nextRequestId);
    if (userId !== '') {
      saveBookLabLocalDraft(userId, {
        requestId: nextRequestId,
        form: nextFormValues,
      });
    }
  };

  const discardProject = () => {
    const projectId = lab.response?.project_id;
    if (projectId === null || projectId === undefined) {
      lab.reset();
      if (userId !== '') clearBookLabLocalDraft(userId);
      setEditedDraft(null);
      setConfirmDiscard(false);
      setFormValues(EMPTY_BOOK_LAB_FORM);
      setRequestId(createBookLabRequestId());
      return;
    }
    lab.archive(projectId, finishDiscard);
  };

  const errorMessage =
    lab.saveError !== null
      ? t('bookLab.errors.save')
      : lab.archiveError !== null
        ? t('bookLab.errors.archive')
        : undefined;

  let content: ReactNode;
  if (lab.savedPathId !== null) {
    content = (
      <View className="gap-4">
        <EmptyState
          icon="document-text-outline"
          title={t('bookLab.saved.title')}
          description={t('bookLab.saved.description')}
        />
        <Button
          label={t('bookLab.saved.open')}
          size="lg"
          onPress={() => {
            router.push({
              pathname: '/paths/[slug]',
              params: { slug: 'private', pathId: lab.savedPathId ?? '' },
            });
          }}
        />
        <Button
          label={t('bookLab.saved.newVersion')}
          variant="secondary"
          onPress={() => {
            startFreshRequest(lab.savedPathId);
          }}
        />
        <Button
          label={t('bookLab.diff.discard')}
          variant="destructive"
          onPress={() => {
            setConfirmDiscard(true);
          }}
        />
      </View>
    );
  } else if (
    lab.response?.status === 'ok' &&
    editedDraft !== null &&
    selectedDraft !== null
  ) {
    content = (
      <BookLabDiffEditor
        draft={editedDraft}
        context={lab.response.context}
        noteCount={formValues.notes.length}
        selectedOrdinals={selectedOrdinals}
        isSaving={lab.isSaving}
        canSave={canSave}
        errorMessage={errorMessage}
        onDraftChange={setEditedDraft}
        onToggleStage={(ordinal) => {
          setSelectedOrdinals((current) =>
            current.includes(ordinal)
              ? current.filter((value) => value !== ordinal)
              : [...current, ordinal].sort((left, right) => left - right),
          );
        }}
        onSave={() => {
          const projectId = lab.response?.project_id;
          if (projectId !== null && projectId !== undefined && canSave) {
            lab.save({ projectId, draft: selectedDraft });
          }
        }}
        onEditNotes={() => {
          const projectId = lab.response?.project_id;
          if (projectId !== null && projectId !== undefined) {
            lab.archive(projectId, () => {
              startFreshRequest(basePathId);
            });
          }
        }}
        onDiscard={() => {
          setConfirmDiscard(true);
        }}
      />
    );
  } else if (lab.response !== null) {
    const statusKey: TranslationKey =
      lab.response.status === 'out_of_scope'
        ? 'bookLab.fallback.outOfScope'
        : lab.response.status === 'unsafe'
          ? 'bookLab.fallback.unsafe'
          : 'bookLab.fallback.insufficientBudget';
    content = (
      <View className="gap-4">
        <EmptyState
          icon="document-text-outline"
          title={t('bookLab.fallback.title')}
          description={t(statusKey)}
        />
        <Button
          label={t('bookLab.diff.editNotes')}
          variant="secondary"
          onPress={() => {
            const projectId = lab.response?.project_id;
            if (projectId === null || projectId === undefined) {
              startFreshRequest(basePathId);
            } else {
              lab.archive(projectId, () => {
                startFreshRequest(basePathId);
              });
            }
          }}
        />
        {lab.response.project_id === null ? null : (
          <Button
            label={t('bookLab.diff.discard')}
            variant="destructive"
            onPress={() => {
              setConfirmDiscard(true);
            }}
          />
        )}
      </View>
    );
  } else {
    content = (
      <BookLabInputForm
        key={requestId}
        initialValues={formValues}
        isOnline={isOnline}
        isGenerating={lab.isGenerating}
        errorMessage={lab.generateErrorKey === null ? undefined : t(lab.generateErrorKey)}
        onValuesChange={persistValues}
        onSubmit={(values) => {
          persistValues(values);
          lab.generate(
            {
              requestId,
              form: values,
              locale: i18n.language.startsWith('en') ? 'en' : 'pl',
              basePathId,
            },
            (response) => {
              if (response.status !== 'ok' || response.draft === null) return;
              setEditedDraft(response.draft);
              setSelectedOrdinals(response.draft.stages.map((stage) => stage.ordinal));
            },
          );
        }}
        onCancel={() => {
          router.back();
        }}
      />
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-1">
        <Text variant="titleLg" accessibilityRole="header">
          {t('bookLab.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('bookLab.subtitle')}
        </Text>
      </View>

      {isOnline ? null : <Banner message={t('bookLab.offline')} />}
      {basePathId === null || lab.savedPathId !== null ? null : (
        <Banner message={t('bookLab.versioning')} />
      )}

      {lab.response !== null ||
      lab.savedPathId !== null ||
      basePathId !== null ||
      privatePaths.length === 0 ? null : (
        <Card variant="outlined" className="gap-3">
          <View className="gap-1">
            <Text variant="title">{t('bookLab.own.title')}</Text>
            <Text variant="body" tone="secondary">
              {t('bookLab.own.description')}
            </Text>
          </View>
          {privatePaths.map((privatePath) => (
            <View key={privatePath.id} className="gap-2">
              <Text variant="bodyLg">{privatePath.title}</Text>
              <Text variant="caption" tone="secondary">
                {privatePath.sourceAuthor}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  label={t('bookLab.own.open')}
                  variant="secondary"
                  onPress={() => {
                    router.push({
                      pathname: '/paths/[slug]',
                      params: { slug: 'private', pathId: privatePath.id },
                    });
                  }}
                />
                <Button
                  label={t('bookLab.own.newVersion')}
                  variant="ghost"
                  onPress={() => {
                    startFreshRequest(privatePath.id, {
                      ...formValues,
                      sourceTitle: privatePath.sourceTitle ?? '',
                      sourceAuthor: privatePath.sourceAuthor ?? '',
                    });
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      {privatePathsError === null ||
      lab.response !== null ||
      lab.savedPathId !== null ||
      basePathId !== null ? null : (
        <Banner tone="danger" message={t('bookLab.own.error')} />
      )}

      {content}

      {!confirmDiscard ? null : (
        <Card variant="outlined" className="gap-3">
          <Text variant="title">{t('bookLab.discard.title')}</Text>
          <Text variant="body" tone="secondary">
            {t('bookLab.discard.description')}
          </Text>
          <Button
            label={t('bookLab.discard.confirm')}
            variant="destructive"
            loading={lab.isArchiving}
            onPress={discardProject}
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => {
              setConfirmDiscard(false);
            }}
          />
        </Card>
      )}
    </Screen>
  );
}
