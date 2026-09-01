import { z } from 'zod';

import type {
  Path,
  PathReading,
  PathStage,
  UserPath,
} from '@/features/paths/model/schemas';

export type PathContinue = {
  pathId: string;
  slug: string;
  title: string;
  stage: PathStage;
  totalStages: number;
};

/**
 * Dane sekcji „Kontynuuj". Zakończony i wstrzymany zapis są celowo neutralne:
 * karta ma prowadzić wyłącznie do ścieżki, która faktycznie trwa teraz.
 */
export function buildPathContinue(
  userPath: UserPath | null,
  path: Path | null,
  stages: readonly PathStage[],
): PathContinue | null {
  if (userPath === null || userPath.state !== 'active' || path === null) return null;
  if (userPath.pathId !== path.id || userPath.currentStageId === null) return null;

  const stage = stages.find((candidate) => candidate.id === userPath.currentStageId);
  if (stage === undefined) return null;

  return {
    pathId: path.id,
    slug: path.slug,
    title: path.title,
    stage,
    totalStages: stages.length,
  };
}

/** Czytania jednego etapu, stabilnie według tygodnia przypisanego w katalogu. */
export function readingsForStage(
  readings: readonly PathReading[],
  stageId: string,
): PathReading[] {
  return readings
    .filter((reading) => reading.stageId === stageId)
    .sort((left, right) => left.week - right.week);
}

export function findPathReading(
  readings: readonly PathReading[],
  readingId: string,
): PathReading | null {
  return readings.find((reading) => reading.id === readingId) ?? null;
}

/** Akapity zachowują pojedyncze nowe linie listy, ale rozdzielają bloki tekstu. */
export function readingParagraphs(content: string | null): string[] {
  if (content === null) return [];

  return content
    .trim()
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

const singleRouteString = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string(),
);

const optionalRouteUuid = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().uuid().optional().catch(undefined),
);

const pathRouteParamsSchema = z.object({
  slug: singleRouteString.catch(''),
  pathId: optionalRouteUuid,
});

const readingRouteParamsSchema = pathRouteParamsSchema.extend({
  readingId: singleRouteString.catch(''),
});

export type PathRouteParams = z.infer<typeof pathRouteParamsSchema>;
export type ReadingRouteParams = z.infer<typeof readingRouteParamsSchema>;

/** Parametry deep linku są wejściem zewnętrznym, więc nie ufamy typowi routera. */
export function parsePathRouteParams(value: unknown): PathRouteParams {
  return pathRouteParamsSchema.parse(value);
}

export function parseReadingRouteParams(value: unknown): ReadingRouteParams {
  return readingRouteParamsSchema.parse(value);
}
