import { budgetCeiling } from './validate-proposal.ts';

/**
 * Bramka budżetowa ścieżki po stronie serwera.
 *
 * Mirror `checkPathFit()` z src/features/paths/model/fit.ts — te same progi
 * i ten sam współczynnik sufitu. Funkcja brzegowa musi znać werdykt sama:
 * gdyby dostawała go od klienta, „mieści się" byłoby deklaracją, a nie
 * rachunkiem.
 */

export type FitVerdict = 'fits' | 'tight' | 'lite' | 'blocked';

export type StageMinutes = { dailyMinutesP50: number };

export function checkPathFit(
  stages: readonly StageMinutes[],
  allocatedMinutes: number,
): { verdict: FitVerdict; peakMinutes: number } {
  const peakMinutes = stages.reduce(
    (peak, stage) => Math.max(peak, stage.dailyMinutesP50),
    0,
  );

  if (peakMinutes <= budgetCeiling(allocatedMinutes)) {
    return { verdict: 'fits', peakMinutes };
  }
  if (peakMinutes <= allocatedMinutes) return { verdict: 'tight', peakMinutes };
  if (peakMinutes <= allocatedMinutes * 1.5) return { verdict: 'lite', peakMinutes };

  return { verdict: 'blocked', peakMinutes };
}

export type PathFitAdjustment = {
  practiceId: string;
  startValue: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
};

export type PathFit = {
  lite: boolean;
  /** Identyfikatory praktyk do pominięcia. */
  skip: string[];
  adjust: PathFitAdjustment[];
  /** Jedno zdanie po polsku, pokazywane raz przy zapisie. */
  note: string;
};

/** Dopasowanie, które powstaje bez modelu. Ścieżka ma działać także tak. */
export function deterministicPathFit(verdict: FitVerdict): PathFit {
  return { lite: verdict === 'lite', skip: [], adjust: [], note: '' };
}

const TIMES = ['morning', 'afternoon', 'evening'] as const;

function toAdjustment(value: unknown): PathFitAdjustment | null {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Record<string, unknown>;
  const practiceId = raw.practiceId;
  const startValue = raw.startValue;
  const timeOfDay = raw.timeOfDay;

  if (typeof practiceId !== 'string' || practiceId === '') return null;
  if (typeof startValue !== 'number' || !Number.isFinite(startValue)) return null;

  return {
    practiceId,
    startValue,
    timeOfDay: (TIMES as readonly string[]).includes(String(timeOfDay))
      ? (timeOfDay as PathFitAdjustment['timeOfDay'])
      : 'evening',
  };
}

/** Surowa odpowiedź modelu → PathFit. `null`, gdy kształt jest nie do użycia. */
export function toPathFit(value: unknown): PathFit | null {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Record<string, unknown>;

  return {
    lite: raw.lite === true,
    skip: Array.isArray(raw.skip)
      ? raw.skip.filter((id): id is string => typeof id === 'string' && id !== '')
      : [],
    adjust: Array.isArray(raw.adjust)
      ? raw.adjust
          .map(toAdjustment)
          .filter((entry): entry is PathFitAdjustment => entry !== null)
      : [],
    note: typeof raw.note === 'string' ? raw.note.trim() : '',
  };
}
