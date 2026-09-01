import {
  stageAdvanceRowSchema,
  type PathFit,
  type StageAdvanceResult,
} from '@/features/paths/model/schemas';
import { toDataError } from '@/lib/data-error';
import type { IsoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/**
 * Operacje zmieniające stan ścieżki.
 *
 * Każda idzie przez funkcję w bazie, nie przez serię zapytań: zapis, przejście
 * etapu i wycofanie praktyki dotykają naraz `user_paths`, `habits`
 * i `user_path_practices`, a stan pośredni między tymi tabelami nie da się
 * użytkownikowi wytłumaczyć.
 *
 * `today` wszędzie oznacza dobę logiczną (getLogicalToday), nie datę serwera.
 */

/**
 * Zapis na ścieżkę. Zwraca id zapisu.
 *
 * `fit` niesie dopasowanie i ląduje w `user_paths.fit`: baza czyta z niego
 * listę pominięć i obniżone wartości startowe. Pominięcia są przycinane do
 * połowy praktyk etapu po stronie bazy — dopasowanie nie ma prawa wypatroszyć
 * etapu niezależnie od tego, kto je zapisał.
 */
export async function enrollInPath(
  pathId: string,
  lite: boolean,
  today: IsoDate,
  skipPracticeIds: readonly string[],
  fit: PathFit,
  skipSetupStageIds: readonly string[],
  requestId: string,
  conflictReviewId: string | null,
): Promise<string> {
  const fitWithSetupPreview = {
    ...fit,
    setupSkip: [...skipSetupStageIds],
  };
  const { data, error } =
    conflictReviewId === null
      ? await supabase.rpc('enroll_in_path', {
          p_path_id: pathId,
          p_lite: lite,
          p_today: today,
          p_skip_practice_ids: [...skipPracticeIds],
          p_fit: fitWithSetupPreview,
        })
      : await supabase.rpc('enroll_in_path_reviewed', {
          p_request_id: requestId,
          p_path_id: pathId,
          p_review_id: conflictReviewId,
          p_lite: lite,
          p_today: today,
          p_skip_practice_ids: [...skipPracticeIds],
          p_fit: fitWithSetupPreview,
        });

  if (error !== null) throw toDataError(error);

  return data;
}

/**
 * Przejście na kolejny etap.
 *
 * `fromStageId` jest warunkiem, nie informacją: drugie wywołanie z tym samym
 * etapem nie robi nic i oddaje `null`. Dzięki temu podwójne dotknięcie
 * „Zaczynam" nie przeskakuje dwóch etapów naraz.
 */
export async function advancePathStage(
  userPathId: string,
  fromStageId: string,
  today: IsoDate,
): Promise<StageAdvanceResult | null> {
  const { data, error } = await supabase.rpc('advance_path_stage', {
    p_user_path_id: userPathId,
    p_from_stage_id: fromStageId,
    p_today: today,
  });

  if (error !== null) throw toDataError(error);

  const row = data?.[0];
  if (row === undefined) return null;

  return stageAdvanceRowSchema.parse(row);
}

/** Zdejmuje praktykę z listy albo ją przywraca — pod akcję „Cofnij". */
export async function setPathPracticeRetired(
  habitId: string,
  retired: boolean,
  today: IsoDate,
): Promise<void> {
  const { error } = await supabase.rpc('set_path_practice_retired', {
    p_habit_id: habitId,
    p_retired: retired,
    p_today: today,
  });

  if (error !== null) throw toDataError(error);
}

/**
 * Udział wykonanych dni wśród zaplanowanych w oknie kończącym się wczoraj —
 * druga połowa kryterium przejścia etapu.
 *
 * Liczone w SQL, bo inaczej klient musiałby ściągnąć dwa tygodnie logów przy
 * każdym wejściu na ekran „Dziś".
 */
export async function fetchPathCompletionRatio(
  userPathId: string,
  today: IsoDate,
  days: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_path_completion_ratio', {
    p_user_path_id: userPathId,
    p_today: today,
    p_days: days,
  });

  if (error !== null) throw toDataError(error);

  return data ?? 0;
}

/**
 * Wstrzymuje ścieżkę i zdejmuje jej praktyki z listy.
 *
 * Bez limitu czasu i bez wygasania — wiersz czeka tak długo, jak trzeba.
 * Powiadomienia gasną same, bo planuje je odczyt aktywnych nawyków.
 */
export async function pausePath(userPathId: string): Promise<void> {
  const { error } = await supabase.rpc('pause_path', { p_user_path_id: userPathId });

  if (error !== null) throw toDataError(error);
}

/**
 * Wznawia ścieżkę na etapie, na którym się skończyła.
 *
 * @param withReentry `true` przy powrocie — siedem dni na obniżonych
 *   parametrach. `false` przy cofnięciu pauzy: to nie jest powrót, tylko
 *   wycofanie gestu, więc nic się nie obniża.
 */
export async function resumePath(
  userPathId: string,
  today: IsoDate,
  withReentry: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('resume_path', {
    p_user_path_id: userPathId,
    p_today: today,
    p_with_reentry: withReentry,
  });

  if (error !== null) throw toDataError(error);
}

/** Koniec tygodnia wejściowego: parametry wracają do wartości etapu. */
export async function restorePathParameters(userPathId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_path_parameters', {
    p_user_path_id: userPathId,
  });

  if (error !== null) throw toDataError(error);
}

/** Los praktyk po zamknięciu ścieżki. */
export type PracticesDecision = 'keep' | 'remove';

/**
 * Zamyka ścieżkę i rozstrzyga los praktyk: zostawia je jako zwykłe nawyki
 * albo archiwizuje.
 */
export async function endPath(
  userPathId: string,
  reason: 'completed' | 'abandoned',
  decision: PracticesDecision,
): Promise<void> {
  const { error } = await supabase.rpc('end_path', {
    p_user_path_id: userPathId,
    p_reason: reason,
    p_keep_practices: decision === 'keep',
  });

  if (error !== null) throw toDataError(error);
}
