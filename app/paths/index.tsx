import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, EmptyState, Screen, Text } from '@/components/ui';
import {
  groupPathCatalog,
  useActiveUserPath,
  useImplementationConfirmations,
  usePaths,
} from '@/features/paths';
import {
  ImplementationConfirmationCard,
  ImplementationConfirmationSheet,
  ImplementationConfirmationSkeleton,
} from '@/features/paths/components/implementation-confirmation';
import { PathCard } from '@/features/paths/components/path-card';
import { PathsSkeleton } from '@/features/paths/components/paths-skeleton';
import { useIsOnline } from '@/lib/network';

/**
 * Katalog ścieżek.
 *
 * Kolejność bierze się z `sortOrder` treści, nie z kodu: najkrótsza
 * i najtrafniejsza ścieżka ma stać pierwsza, a to decyzja redakcyjna.
 */
export default function PathsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isOnline = useIsOnline();

  const { entries, isLoading, error, refetch } = usePaths();
  const { userPath } = useActiveUserPath();
  const confirmations = useImplementationConfirmations();
  const [selectedConfirmationId, setSelectedConfirmationId] = useState<string | null>(
    null,
  );
  const groups = groupPathCatalog(entries);
  const selectedConfirmation =
    confirmations.confirmations.find(
      (confirmation) => confirmation.id === selectedConfirmationId,
    ) ?? null;

  const openPath = (slug: string) => {
    router.push(`/paths/${slug}`);
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-1">
        <Text variant="titleLg" accessibilityRole="header">
          {t('path.title')}
        </Text>
        <Text variant="body" tone="secondary">
          {t('path.subtitle')}
        </Text>
      </View>

      {isOnline ? null : <Banner message={t('path.offline')} />}
      {isOnline && error !== null ? (
        <Banner tone="danger" message={t('path.error')} />
      ) : null}
      {isOnline && confirmations.error !== null ? (
        <Banner tone="danger" message={t('path.confirmation.error')} />
      ) : null}

      {confirmations.isLoading ? <ImplementationConfirmationSkeleton /> : null}

      {confirmations.confirmations.length === 0 ? null : (
        <View className="gap-3">
          <Text variant="title" accessibilityRole="header">
            {t('path.confirmation.sectionTitle')}
          </Text>
          {confirmations.confirmations.map((confirmation) => (
            <ImplementationConfirmationCard
              key={confirmation.id}
              confirmation={confirmation}
              onOpen={() => {
                setSelectedConfirmationId(confirmation.id);
              }}
            />
          ))}
        </View>
      )}

      {isLoading ? <PathsSkeleton /> : null}

      {!isLoading && entries.length === 0 ? (
        <EmptyState
          icon="map-outline"
          title={t('path.empty.title')}
          description={t('path.empty.description')}
          action={
            error === null ? undefined : (
              <Button label={t('common.retry')} variant="secondary" onPress={refetch} />
            )
          }
        />
      ) : null}

      {groups.tarento.length === 0 ? null : (
        <View className="gap-3">
          <Text variant="title" accessibilityRole="header">
            {t('path.catalog.tarento')}
          </Text>
          {groups.tarento.map((entry) => (
            <PathCard
              key={entry.path.id}
              entry={entry}
              note={userPath?.pathId === entry.path.id ? t('path.current') : undefined}
              onPress={openPath}
            />
          ))}
        </View>
      )}

      {groups.books.length === 0 ? null : (
        <View className="gap-3">
          <Text variant="title" accessibilityRole="header">
            {t('path.catalog.books')}
          </Text>
          {groups.books.map((entry) => (
            <PathCard
              key={entry.path.id}
              entry={entry}
              note={userPath?.pathId === entry.path.id ? t('path.current') : undefined}
              onPress={openPath}
            />
          ))}
        </View>
      )}

      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      />

      <ImplementationConfirmationSheet
        confirmation={selectedConfirmation}
        responses={confirmations.responses}
        isDeleting={confirmations.isArchiving}
        onClose={() => {
          setSelectedConfirmationId(null);
        }}
        onDeleteAnswers={() => {
          if (selectedConfirmation === null) return;

          Alert.alert(
            t('path.confirmation.deleteTitle'),
            t('path.confirmation.deleteMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('path.confirmation.deleteConfirm'),
                style: 'destructive',
                onPress: () => {
                  void confirmations.archiveAnswers(selectedConfirmation.userPathId);
                },
              },
            ],
          );
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
