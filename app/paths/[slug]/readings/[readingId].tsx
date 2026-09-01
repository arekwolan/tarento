import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, EmptyState, Screen } from '@/components/ui';
import { trackEvent } from '@/features/analytics';
import {
  findPathReading,
  parseReadingRouteParams,
  PathReadingContent,
  PathReadingSkeleton,
  usePath,
  usePathReadings,
} from '@/features/paths';
import { useIsOnline } from '@/lib/network';
import { READER_MAX_WIDTH } from '@/theme/spacing';

export default function PathReadingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isOnline = useIsOnline();
  const routeParams = parseReadingRouteParams(useLocalSearchParams());

  const {
    path,
    stages,
    isLoading: isPathLoading,
    error: pathError,
    refetch: refetchPath,
  } = usePath(routeParams.slug, routeParams.pathId ?? null);
  const {
    readings,
    isLoading: areReadingsLoading,
    error: readingsError,
    refetch: refetchReadings,
  } = usePathReadings(path?.id ?? null);

  const reading = findPathReading(readings, routeParams.readingId);
  const stage =
    reading === null
      ? null
      : (stages.find((candidate) => candidate.id === reading.stageId) ?? null);
  const openedReadingId = useRef<string | null>(null);
  const finishedReadingIds = useRef(new Set<string>());

  useEffect(() => {
    if (reading === null || openedReadingId.current === reading.id) return;

    openedReadingId.current = reading.id;
    trackEvent('path_reading_opened', {
      source_kind: reading.sourceKind,
      week: reading.week,
      has_body: reading.body !== null && reading.body.trim().length > 0,
    });
  }, [reading]);

  const retry = () => {
    refetchPath();
    refetchReadings();
  };

  const hasNoCachedContent =
    path === null || (areReadingsLoading && readings.length === 0);

  if (!isOnline && hasNoCachedContent) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <Banner message={t('path.readings.offline')} />
        <EmptyState
          icon="cloud-offline-outline"
          title={t('path.readings.offlineEmpty.title')}
          description={t('path.readings.offlineEmpty.description')}
          action={
            <Button
              label={t('common.back')}
              variant="secondary"
              onPress={() => {
                router.back();
              }}
            />
          }
        />
      </Screen>
    );
  }

  if (isPathLoading || areReadingsLoading) {
    return (
      <Screen
        scroll
        edges={['top', 'bottom', 'left', 'right']}
        contentClassName="items-center"
      >
        <View className="w-full" style={{ maxWidth: READER_MAX_WIDTH }}>
          <PathReadingSkeleton />
        </View>
      </Screen>
    );
  }

  const hasError = pathError !== null || readingsError !== null;

  if (reading === null) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        {isOnline ? null : <Banner message={t('path.readings.offline')} />}
        <EmptyState
          icon={hasError ? 'cloud-offline-outline' : 'book-outline'}
          title={
            hasError
              ? t('path.readings.readerError.title')
              : t('path.readings.notFound.title')
          }
          description={
            hasError
              ? t('path.readings.readerError.description')
              : t('path.readings.notFound.description')
          }
          action={
            <Button
              label={hasError ? t('common.retry') : t('common.back')}
              variant="secondary"
              onPress={hasError ? retry : () => router.back()}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentClassName="items-center"
    >
      <View className="w-full gap-3" style={{ maxWidth: READER_MAX_WIDTH }}>
        {isOnline ? null : <Banner message={t('path.readings.offline')} />}
        {hasError && isOnline ? (
          <Banner tone="danger" message={t('path.readings.readerError.cached')} />
        ) : null}
        <PathReadingContent
          reading={reading}
          stage={stage}
          onFinish={() => {
            if (!finishedReadingIds.current.has(reading.id)) {
              finishedReadingIds.current.add(reading.id);
              trackEvent('path_reading_finished', {
                source_kind: reading.sourceKind,
                week: reading.week,
                has_body: reading.body !== null && reading.body.trim().length > 0,
              });
            }
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
