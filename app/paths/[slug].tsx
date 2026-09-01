import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner, Button, EmptyState, Screen, Text, useToast } from '@/components/ui';
import { requestPathFit } from '@/features/ai-plan';
import { useLogicalToday } from '@/features/auth';
import {
  canActivateConflictReview,
  createConflictRequestId,
  useProtocolConflictRadar,
} from '@/features/conflict-radar';
import { useDayBudget } from '@/features/day-budget';
import { useWriteLetter } from '@/features/letters';
import {
  BookProtocolPreviewSheet,
  BookProtocolProvenance,
  deterministicPathFit,
  hasFitChanges,
  isRepeatBlocked,
  parsePathRouteParams,
  readingsForStage,
  StageReadings,
  useActiveUserPath,
  useEndedPaths,
  useEnrollInPath,
  usePath,
  usePathReadings,
  usePathLifecycle,
  usePaths,
} from '@/features/paths';
import type { PracticesDecision } from '@/features/paths/api/path-actions-api';
import type { PathCatalogEntry } from '@/features/paths/api/paths-api';
import { EnrollGate } from '@/features/paths/components/enroll-gate';
import { OptionalPractices } from '@/features/paths/components/optional-practices';
import { PathFitSheet } from '@/features/paths/components/path-fit-sheet';
import { PathEndSheet } from '@/features/paths/components/path-end-sheet';
import { PathsSkeleton } from '@/features/paths/components/paths-skeleton';
import { StageCard } from '@/features/paths/components/stage-card';
import { checkPathFit, pathMinutes } from '@/features/paths/model/fit';
import type { PathFit } from '@/features/paths/model/schemas';
import { useIsOnline } from '@/lib/network';

/**
 * Ekran ścieżki.
 *
 * Akapit o uczciwości wobec źródeł stoi bezpośrednio pod hookiem, wariantem
 * body — nie drobnym drukiem i nie w akordeonie. Ludzie, którzy kupują
 * cepelię, mają odpaść tutaj, a nie w drugim tygodniu.
 *
 * Na dole jedna akcja główna, zależna od stanu zapisu: „Zacznij" przed
 * startem, „Wstrzymaj" w trakcie, „Wznów" po pauzie. Zakończenie stoi obok
 * jako ghost — porzucenie nie ma być gestem, który krzyczy.
 */
export default function PathScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isOnline = useIsOnline();
  const { show: showToast } = useToast();
  const today = useLogicalToday();
  const routeParams = parsePathRouteParams(useLocalSearchParams());

  const { path, stages, practices, isLoading, error } = usePath(
    routeParams.slug,
    routeParams.pathId ?? null,
  );
  const { allocatedWindow } = useDayBudget(today);
  const { userPath, openPaths } = useActiveUserPath();
  const { endedPaths } = useEndedPaths();
  const { entries } = usePaths();
  const { enroll, isPending, isQueued, error: enrollError } = useEnrollInPath();
  const {
    pause,
    resume,
    undoPause,
    end,
    isPending: isLifecyclePending,
    error: lifecycleError,
  } = usePathLifecycle();
  const { write: writeLetter } = useWriteLetter();
  const conflictRadar = useProtocolConflictRadar();

  /**
   * Praktyki odznaczone przed startem. Stan trzymamy na ekranie, bo dotyczy
   * jednej decyzji: tego zapisu i niczego więcej.
   */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [skippedSetups, setSkippedSetups] = useState<string[]>([]);
  const [isEnding, setEnding] = useState(false);

  /**
   * Dopasowanie czekające na przegląd. Model podpowiada raz, przy zapisie —
   * a użytkownik i tak widzi każdą różnicę, zanim cokolwiek powstanie.
   */
  const [fitProposal, setFitProposal] = useState<PathFit | null>(null);
  const [protocolPreview, setProtocolPreview] = useState<{
    lite: boolean;
    fit: PathFit;
    conflictRequestId: string | null;
  } | null>(null);
  const [wantsLite, setWantsLite] = useState(false);
  const [isFitting, setFitting] = useState(false);

  /** Zapis na tę dokładną wersję ścieżki: aktywny albo wstrzymany. */
  const enrollment =
    path === null ? null : (openPaths.find((open) => open.pathId === path.id) ?? null);
  const currentStage = stages.find((stage) => stage.id === enrollment?.currentStageId);
  // Przed zapisem pierwszy etap jest naturalnym podglądem. Po zapisie zawsze
  // wygrywa etap przypięty w user_paths — także po wznowieniu i zmianie wersji.
  const readingStage = currentStage ?? stages[0];
  const {
    readings,
    isLoading: areReadingsLoading,
    error: readingsError,
  } = usePathReadings(readingStage !== undefined && path !== null ? path.id : null);
  const currentReadings =
    readingStage === undefined ? [] : readingsForStage(readings, readingStage.id);

  const windowMinutes = allocatedWindow?.minutes ?? null;
  const fit = checkPathFit(stages, windowMinutes ?? Number.POSITIVE_INFINITY);

  /**
   * Najlżejsza ścieżka, która mieści się w oknie — alternatywa pokazywana
   * zamiast przygaszonego przycisku. Liczona z katalogu, a nie wpisana
   * na sztywno: ścieżka „na pocieszenie" musi istnieć naprawdę.
   */
  const alternative = useMemo<PathCatalogEntry | null>(() => {
    if (windowMinutes === null || path === null) return null;

    return (
      entries
        .filter((entry) => entry.path.id !== path.id && entry.stages.length > 0)
        .filter((entry) => checkPathFit(entry.stages, windowMinutes).verdict === 'fits')
        .sort(
          (left, right) => pathMinutes(left.stages).max - pathMinutes(right.stages).max,
        )
        .at(0) ?? null
    );
  }, [entries, path, windowMinutes]);

  if (isLoading) {
    return (
      <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
        <PathsSkeleton />
      </Screen>
    );
  }

  if (path === null) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        {isOnline ? null : <Banner message={t('path.offline')} />}
        <EmptyState
          icon="map-outline"
          title={error === null ? t('path.notFound.title') : t('path.error')}
          description={error === null ? t('path.notFound.description') : undefined}
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

  const minutes = pathMinutes(stages);
  const optional = practices.filter((practice) => practice.isOptional);

  const isActive = enrollment?.state === 'active';
  const isPaused = enrollment?.state === 'paused';
  const hasOtherActive = userPath !== null && userPath.pathId !== path.id;

  const startEnrollment = (
    lite: boolean,
    pathFit: PathFit,
    conflictReviewId: string | null = null,
  ) => {
    setFitProposal(null);
    setProtocolPreview(null);
    enroll({
      path,
      stages,
      practices,
      lite: lite || pathFit.lite,
      skipPracticeIds: skipped,
      skipSetupStageIds: skippedSetups,
      fit: pathFit,
      conflictReviewId,
    });
    showToast({ message: t('path.enroll.started') });
  };

  /**
   * Jedno wywołanie modelu na całą ścieżkę: tutaj i nigdzie indziej.
   *
   * Gdy model milczy albo nie ma nic do dopasowania, zapis idzie od razu
   * wariantem deterministycznym — ścieżka działa w całości bez ani jednego
   * wywołania modelu.
   */
  const handleStart = (lite: boolean) => {
    if (path.pathKind === 'book_protocol') {
      const requiresReview = path.originKind === 'private';
      const conflictRequestId = requiresReview ? createConflictRequestId() : null;
      setSkippedSetups([]);
      setProtocolPreview({
        lite,
        fit: deterministicPathFit(fit.verdict),
        conflictRequestId,
      });
      if (conflictRequestId !== null) {
        conflictRadar.scan({
          requestId: conflictRequestId,
          pathId: path.id,
          locale: i18n.language.startsWith('en') ? 'en' : 'pl',
        });
      }
      return;
    }

    setWantsLite(lite);
    setFitting(true);

    void requestPathFit(path.id)
      .then((response) => {
        if (hasFitChanges(response.fit)) {
          setFitProposal(response.fit);
          return;
        }

        startEnrollment(lite, response.fit);
      })
      .catch(() => {
        startEnrollment(lite, deterministicPathFit(fit.verdict));
      })
      .finally(() => {
        setFitting(false);
      });
  };

  /**
   * Pauza idzie od razu, z pięcioma sekundami na wycofanie. Cofnięcie nie jest
   * powrotem: wraca dokładnie ten stan, który był, bez tygodnia wejściowego.
   */
  const handlePause = () => {
    if (enrollment === null) return;
    const userPathId = enrollment.id;

    void pause(userPathId).then((ok) => {
      if (!ok) return;

      showToast({
        message: t('path.pause.done'),
        action: {
          label: t('common.undo'),
          onPress: () => {
            undoPause(userPathId);
          },
        },
      });
    });
  };

  const handleResume = () => {
    if (enrollment === null) return;

    void resume(enrollment.id).then((ok) => {
      if (!ok) return;

      showToast({
        message: t('path.resume.done', { stage: currentStage?.ordinal ?? 1 }),
      });
    });
  };

  const handleEnd = (decision: PracticesDecision) => {
    if (enrollment === null) return;

    void end(enrollment.id, 'abandoned', decision).then((ok) => {
      setEnding(false);
      if (!ok) return;

      showToast({
        message: t(decision === 'keep' ? 'path.end.kept' : 'path.end.removed'),
      });
    });
  };

  return (
    <>
      <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
        <View className="gap-3">
          <Text variant="titleLg" accessibilityRole="header">
            {path.title}
          </Text>
          <Text variant="body">{path.hook}</Text>
          {path.honesty === null ? null : (
            <Text variant="body" tone="secondary">
              {path.honesty}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-x-3 gap-y-1">
            <Text variant="caption" tone="tertiary">
              {t('path.duration', { days: path.durationDays })}
            </Text>
            <Text variant="caption" tone="tertiary">
              {minutes.min === minutes.max
                ? t('path.minutesFlat', { minutes: minutes.max })
                : t('path.minutes', { min: minutes.min, max: minutes.max })}
            </Text>
          </View>
        </View>

        <BookProtocolProvenance path={path} />

        {isOnline ? null : <Banner message={t('path.offline')} />}
        {isOnline && error !== null ? (
          <Banner tone="danger" message={t('path.error')} />
        ) : null}
        {/* Wstrzymany zapis czeka na sieć — to nie jest błąd, tylko kolejka. */}
        {enrollError === null || isQueued ? null : (
          <Banner tone="danger" message={t('path.enroll.failed')} />
        )}
        {lifecycleError === null ? null : (
          <Banner tone="danger" message={t('path.end.failed')} />
        )}

        {readingStage === undefined ? null : (
          <StageReadings
            stage={readingStage}
            readings={currentReadings}
            isLoading={areReadingsLoading}
            hasError={readingsError !== null}
            onOpen={(reading) => {
              router.push({
                pathname: '/paths/[slug]/readings/[readingId]',
                params: {
                  slug: path.slug,
                  readingId: reading.id,
                  pathId: path.id,
                },
              });
            }}
          />
        )}

        {stages.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            practices={practices.filter((practice) => practice.stageId === stage.id)}
          />
        ))}

        {isActive ? (
          <View className="gap-3">
            <Text variant="body" tone="secondary">
              {t('path.current')}
            </Text>
            <Button
              label={t('path.pause.action')}
              variant="secondary"
              size="lg"
              disabled={isLifecyclePending}
              onPress={handlePause}
            />
            <Button
              label={t('path.end.action')}
              variant="ghost"
              onPress={() => {
                setEnding(true);
              }}
            />
          </View>
        ) : isPaused ? (
          <View className="gap-3">
            <Text variant="body" tone="secondary">
              {t('path.pause.state')}
            </Text>
            {hasOtherActive ? (
              <Text variant="body" tone="secondary">
                {t('path.otherActive')}
              </Text>
            ) : (
              <Button
                label={t('path.resume.action')}
                size="lg"
                loading={isLifecyclePending}
                onPress={handleResume}
              />
            )}
            <Button
              label={t('path.end.action')}
              variant="ghost"
              onPress={() => {
                setEnding(true);
              }}
            />
          </View>
        ) : hasOtherActive ? (
          <Text variant="body" tone="secondary">
            {t('path.otherActive')}
          </Text>
        ) : isRepeatBlocked(path, endedPaths, today) ? (
          <Text variant="body" tone="secondary">
            {t('path.repeat.blocked')}
          </Text>
        ) : (
          <>
            <OptionalPractices
              practices={optional}
              skipped={skipped}
              onToggle={(practiceId) => {
                setSkipped((current) =>
                  current.includes(practiceId)
                    ? current.filter((id) => id !== practiceId)
                    : [...current, practiceId],
                );
              }}
            />
            <EnrollGate
              verdict={fit.verdict}
              stages={stages}
              windowMinutes={windowMinutes}
              alternative={alternative}
              isPending={isPending || isFitting}
              onStart={handleStart}
              onOpenAlternative={(alternativeSlug) => {
                router.replace(`/paths/${alternativeSlug}`);
              }}
              onBackToCatalog={() => {
                router.back();
              }}
            />
          </>
        )}

        <Button
          label={t('common.back')}
          variant="ghost"
          onPress={() => {
            router.back();
          }}
        />
      </Screen>

      <PathFitSheet
        fit={fitProposal}
        practices={practices}
        isPending={isPending}
        onConfirm={() => {
          if (fitProposal !== null) startEnrollment(wantsLite, fitProposal);
        }}
        onSkipFit={() => {
          startEnrollment(wantsLite, deterministicPathFit(fit.verdict));
        }}
        onClose={() => {
          setFitProposal(null);
        }}
      />

      <BookProtocolPreviewSheet
        visible={protocolPreview !== null}
        stages={stages}
        practices={practices}
        skipPracticeIds={skipped}
        skipSetupStageIds={skippedSetups}
        lite={protocolPreview?.lite ?? false}
        windowMinutes={windowMinutes}
        isPending={isPending}
        requiresConflictReview={path.originKind === 'private'}
        conflictReview={conflictRadar.review}
        isConflictLoading={conflictRadar.isScanning}
        isConflictResolving={conflictRadar.isResolving}
        hasConflictError={conflictRadar.error !== null}
        canConfirm={
          path.originKind !== 'private' || canActivateConflictReview(conflictRadar.review)
        }
        onRetryConflicts={() => {
          const requestId = protocolPreview?.conflictRequestId;
          if (requestId === null || requestId === undefined) return;
          conflictRadar.scan({
            requestId,
            pathId: path.id,
            locale: i18n.language.startsWith('en') ? 'en' : 'pl',
          });
        }}
        onResolveConflict={(conflict, decision, contextA, contextB) => {
          const reviewId = conflictRadar.review?.reviewId;
          if (reviewId === undefined) return;
          conflictRadar.resolve({
            reviewId,
            conflictId: conflict.id,
            conflictType: conflict.type,
            decision,
            contextA,
            contextB,
          });
        }}
        onToggleSetup={(stageId) => {
          setSkippedSetups((current) =>
            current.includes(stageId)
              ? current.filter((id) => id !== stageId)
              : [...current, stageId],
          );
        }}
        onConfirm={() => {
          if (protocolPreview !== null) {
            startEnrollment(
              protocolPreview.lite,
              protocolPreview.fit,
              conflictRadar.review?.reviewId ?? null,
            );
          }
        }}
        onClose={() => {
          setProtocolPreview(null);
          setSkippedSetups([]);
          conflictRadar.reset();
        }}
      />

      <PathEndSheet
        path={isEnding ? path : null}
        reason="abandoned"
        isPending={isLifecyclePending}
        onClose={() => {
          setEnding(false);
        }}
        onDecide={handleEnd}
        onWriteLetter={writeLetter}
      />
    </>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
