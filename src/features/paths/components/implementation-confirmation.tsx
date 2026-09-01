import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Divider, Sheet, Skeleton, Text } from '@/components/ui';
import type {
  PathImplementationConfirmation,
  PathTransferResponse,
  TransferResponse,
} from '@/features/paths/model/transfer';
import type { TranslationKey } from '@/i18n/keys';

const RESPONSE_KEYS: Record<TransferResponse, TranslationKey> = {
  yes: 'path.transfer.answerYes',
  not_yet: 'path.transfer.answerNotYet',
  no_opportunity: 'path.transfer.answerNoOpportunity',
};

export type ImplementationConfirmationCardProps = {
  confirmation: PathImplementationConfirmation;
  onOpen: () => void;
};

export function ImplementationConfirmationCard({
  confirmation,
  onOpen,
}: ImplementationConfirmationCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="bodyLg">{confirmation.sourceTitle}</Text>
        {confirmation.sourceAuthor === null ? null : (
          <Text variant="caption" tone="secondary">
            {confirmation.sourceAuthor}
          </Text>
        )}
      </View>
      <Text variant="caption" tone="tertiary">
        {t('path.confirmation.completedStagesCount', {
          count: confirmation.completedStages.length,
        })}
      </Text>
      <Button label={t('path.confirmation.open')} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export function ImplementationConfirmationSkeleton() {
  return (
    <Card className="gap-3">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-full rounded-md" />
    </Card>
  );
}

export type ImplementationConfirmationSheetProps = {
  confirmation: PathImplementationConfirmation | null;
  responses: readonly PathTransferResponse[];
  isDeleting: boolean;
  onClose: () => void;
  onDeleteAnswers: () => void;
};

export function ImplementationConfirmationSheet({
  confirmation,
  responses,
  isDeleting,
  onClose,
  onDeleteAnswers,
}: ImplementationConfirmationSheetProps) {
  const { t } = useTranslation();

  if (confirmation === null) return null;

  const ownResponses = responses.filter(
    (response) => response.userPathId === confirmation.userPathId,
  );
  const hasPrivateAnswers =
    confirmation.answersArchivedAt === null &&
    (ownResponses.length > 0 || confirmation.userSentence !== null);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('path.confirmation.title')}
      closeLabel={t('path.confirmation.close')}
    >
      <View className="gap-1">
        <Text variant="label" tone="secondary">
          {t('path.confirmation.source')}
        </Text>
        <Text variant="title">{confirmation.sourceTitle}</Text>
        {confirmation.sourceAuthor === null ? null : (
          <Text variant="body" tone="secondary">
            {confirmation.sourceAuthor}
          </Text>
        )}
      </View>

      <Divider />

      <View className="gap-3">
        <Text variant="title">{t('path.confirmation.stages')}</Text>
        {confirmation.completedStages.map((stage) => (
          <Text key={stage.stageId} variant="body">
            {t('path.stage', { ordinal: stage.ordinal, name: stage.name })}
          </Text>
        ))}
      </View>

      <Divider />

      <View className="gap-3">
        <Text variant="title">{t('path.confirmation.execution')}</Text>
        {confirmation.practiceOutcomes.map((practice) => (
          <View key={practice.practiceId} className="gap-1">
            <Text variant="bodyLg">{practice.title}</Text>
            <Text variant="caption" tone="secondary">
              {t('path.confirmation.frequency', {
                completed: practice.completed,
                scheduled: practice.scheduled,
              })}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t(
                practice.state === 'kept'
                  ? 'path.confirmation.kept'
                  : 'path.confirmation.retired',
              )}
            </Text>
          </View>
        ))}
      </View>

      <Divider />

      <View className="gap-3">
        <Text variant="title">{t('path.confirmation.transfer')}</Text>
        {ownResponses.length === 0 ? (
          <Text variant="body" tone="secondary">
            {t('path.confirmation.answersRemoved')}
          </Text>
        ) : (
          ownResponses.map((response) => {
            const stage = confirmation.completedStages.find(
              (candidate) => candidate.stageId === response.stageId,
            );

            return (
              <View key={response.id} className="gap-1">
                <Text variant="label" tone="secondary">
                  {stage === undefined
                    ? t('path.confirmation.stageFallback')
                    : t('path.stage', { ordinal: stage.ordinal, name: stage.name })}
                </Text>
                <Text variant="body">{t(RESPONSE_KEYS[response.response])}</Text>
                {response.evidence === null ? null : (
                  <Text variant="body" tone="secondary">
                    {response.evidence}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {confirmation.userSentence === null ? null : (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t('path.confirmation.userSentence')}
          </Text>
          <Text variant="body">{confirmation.userSentence}</Text>
        </View>
      )}

      <Text variant="caption" tone="tertiary">
        {t('path.confirmation.noCausality')}
      </Text>

      {hasPrivateAnswers ? (
        <Button
          label={t('path.confirmation.deleteAnswers')}
          variant="destructive"
          loading={isDeleting}
          onPress={onDeleteAnswers}
        />
      ) : null}
    </Sheet>
  );
}
