import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Divider, Skeleton, Text } from '@/components/ui';
import { readingSourceKey } from '@/features/paths/components/reading-source';
import { readingParagraphs } from '@/features/paths/model/reading';
import type { PathReading, PathStage } from '@/features/paths/model/schemas';

export type PathReadingContentProps = {
  reading: PathReading;
  stage: PathStage | null;
  onFinish: () => void;
};

function Bibliography({ reading }: { reading: PathReading }) {
  const { t } = useTranslation();

  return (
    <Card variant="outlined" className="gap-3">
      <Text variant="label" tone="secondary">
        {t('path.readings.pointer.bibliography')}
      </Text>
      <View className="gap-1">
        <Text variant="bodyLg">{reading.title}</Text>
        {reading.author === null ? null : (
          <Text variant="body" tone="secondary">
            {reading.author}
          </Text>
        )}
      </View>
      {reading.sourceLocator === null ? null : (
        <Text variant="body" tone="secondary">
          {reading.sourceLocator}
        </Text>
      )}
      {reading.attribution === null ? null : (
        <Text variant="caption" tone="secondary">
          {reading.attribution}
        </Text>
      )}
      <Text variant="caption" tone="secondary">
        {t('path.readings.pointer.notice')}
      </Text>
    </Card>
  );
}

function SourceQuote({ reading }: { reading: PathReading }) {
  const { t } = useTranslation();

  if (reading.quoteText === null || reading.quoteSource === null) return null;

  return (
    <Card variant="outlined" className="gap-3">
      <Text variant="label" tone="secondary">
        {t('path.readings.quote')}
      </Text>
      <Text variant="quote">{reading.quoteText}</Text>
      <Text variant="caption" tone="secondary">
        {reading.quoteSource}
      </Text>
    </Card>
  );
}

export function PathReadingContent({
  reading,
  stage,
  onFinish,
}: PathReadingContentProps) {
  const { t } = useTranslation();
  const framing = readingParagraphs(reading.framing);
  const body = readingParagraphs(reading.body);

  return (
    <View className="w-full gap-8">
      <View className="gap-3">
        <Text variant="titleLg" accessibilityRole="header">
          {reading.title}
        </Text>
        {reading.author === null ? null : (
          <Text variant="body" tone="secondary">
            {reading.author}
          </Text>
        )}
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          <Text variant="caption" tone="tertiary">
            {t('path.readings.week', { week: reading.week })}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t(readingSourceKey(reading.sourceKind))}
          </Text>
          {stage === null ? null : (
            <Text variant="caption" tone="tertiary">
              {t('path.readings.stageOrdinal', { ordinal: stage.ordinal })}
            </Text>
          )}
        </View>
      </View>

      <View className="gap-4">
        <Text variant="label" tone="secondary">
          {t('path.readings.framing')}
        </Text>
        {framing.map((paragraph, index) => (
          <Text key={`${reading.id}-framing-${index}`} variant="bodyLg">
            {paragraph}
          </Text>
        ))}
      </View>

      <Divider />

      {reading.sourceKind === 'pointer' ? (
        <Bibliography reading={reading} />
      ) : body.length === 0 ? (
        <View className="gap-3">
          <Banner message={t('path.readings.bodyUnavailable')} />
          {reading.attribution === null ? null : (
            <Text variant="caption" tone="secondary">
              {reading.attribution}
            </Text>
          )}
        </View>
      ) : (
        <View className="gap-4">
          <Text variant="label" tone="secondary">
            {t('path.readings.sourceText')}
          </Text>
          {body.map((paragraph, index) => (
            <Text key={`${reading.id}-body-${index}`} variant="bodyLg">
              {paragraph}
            </Text>
          ))}
          {reading.attribution === null ? null : (
            <Text variant="caption" tone="secondary">
              {reading.attribution}
            </Text>
          )}
        </View>
      )}

      <SourceQuote reading={reading} />

      <Button label={t('path.readings.finish')} onPress={onFinish} />
    </View>
  );
}

export function PathReadingSkeleton() {
  return (
    <View className="w-full gap-8">
      <View className="gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-32" />
      </View>
      <View className="gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-32" />
      </View>
    </View>
  );
}
