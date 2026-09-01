import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Divider, Text } from '@/components/ui';
import type { Path, PathReviewStatus } from '@/features/paths/model/schemas';
import type { TranslationKey } from '@/i18n/keys';

export type BookProtocolProvenanceProps = {
  path: Path;
};

const REVIEW_LABEL = {
  not_applicable: 'path.protocol.review.notApplicable',
  draft: 'path.protocol.review.draft',
  editorial_reviewed: 'path.protocol.review.editorial',
  legal_reviewed: 'path.protocol.review.legal',
} as const satisfies Record<PathReviewStatus, TranslationKey>;

/** Jawne provenance protokołu, widoczne przed praktykami i akcją startu. */
export function BookProtocolProvenance({ path }: BookProtocolProvenanceProps) {
  const { t } = useTranslation();

  if (
    path.pathKind !== 'book_protocol' ||
    path.sourceTitle === null ||
    path.sourceAuthor === null ||
    path.curatedBy === null ||
    path.disclaimer === null
  ) {
    return null;
  }

  return (
    <Card variant="outlined" className="gap-3">
      <View className="gap-1">
        <Text variant="label" tone="secondary">
          {t('path.protocol.provenance')}
        </Text>
        <Text variant="title">{path.sourceTitle}</Text>
        <Text variant="body" tone="secondary">
          {path.sourceAuthor}
        </Text>
      </View>

      <View className="gap-1">
        <Text variant="caption" tone="secondary">
          {t('path.protocol.sourceType.book')}
        </Text>
        {path.sourceEdition === null ? null : (
          <Text variant="caption" tone="secondary">
            {t('path.protocol.edition', { edition: path.sourceEdition })}
          </Text>
        )}
        {path.sourceIdentifier === null ? null : (
          <Text variant="caption" tone="secondary">
            {t('path.protocol.identifier', { identifier: path.sourceIdentifier })}
          </Text>
        )}
      </View>

      <Divider />

      <View className="gap-1">
        <Text variant="body">
          {path.originKind === 'private'
            ? t('path.protocol.privateCuratedBy')
            : t('path.protocol.curatedBy', { curator: path.curatedBy })}
        </Text>
        <Text variant="caption" tone="secondary">
          {t(REVIEW_LABEL[path.reviewStatus])}
        </Text>
      </View>

      <Text variant="caption" tone="secondary">
        {path.disclaimer}
      </Text>
    </Card>
  );
}
