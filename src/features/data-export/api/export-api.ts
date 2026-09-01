import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { toDataError } from '@/lib/data-error';
import { nowIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';

/**
 * Zrzut danych użytkownika.
 *
 * Format jest celowo płaski i bliski tabelom: to kopia jego danych, a nie
 * interfejs do integracji, więc czytelność bije elegancję.
 */
export type DataExport = {
  exported_at: string;
  format_version: 9;
  profile: unknown;
  habits: unknown[];
  habit_revisions: unknown[];
  habit_friction_events: unknown[];
  habit_friction_responses: unknown[];
  self_rules: unknown[];
  self_rule_events: unknown[];
  habit_logs: unknown[];
  quote_favorites: unknown[];
  daily_quotes: unknown[];
  day_plans: unknown[];
  day_plan_items: unknown[];
  book_lab_projects: unknown[];
  book_lab_notes: unknown[];
  book_lab_note_contexts: unknown[];
  protocol_conflict_reviews: unknown[];
  protocol_conflicts: unknown[];
  private_paths: unknown[];
  path_stages: unknown[];
  path_practices: unknown[];
  path_readings: unknown[];
  user_paths: unknown[];
  user_path_practices: unknown[];
  path_setup_actions: unknown[];
  path_transfer_responses: unknown[];
  path_implementation_confirmations: unknown[];
};

async function selectAll(
  table:
    | 'habits'
    | 'habit_revisions'
    | 'habit_friction_responses'
    | 'habit_logs'
    | 'quote_favorites'
    | 'daily_quotes'
    | 'day_plans'
    | 'day_plan_items'
    | 'book_lab_projects'
    | 'book_lab_notes'
    | 'book_lab_note_contexts'
    | 'protocol_conflict_reviews'
    | 'protocol_conflicts'
    | 'user_paths'
    | 'user_path_practices'
    | 'path_setup_actions'
    | 'path_implementation_confirmations',
) {
  const { data, error } = await supabase.from(table).select('*');
  if (error !== null) throw toDataError(error);
  return data ?? [];
}

/**
 * Zbiera wszystko, co należy do użytkownika.
 *
 * RLS sprawia, że `select *` bez warunku i tak zwróci wyłącznie jego wiersze —
 * nie dokładamy filtra po user_id, żeby nie sugerować, że to on jest
 * zabezpieczeniem.
 */
export async function collectUserData(): Promise<DataExport> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle();
  if (error !== null) throw toDataError(error);

  const [
    habits,
    habitRevisions,
    frictionResponses,
    habitLogs,
    favorites,
    dailyQuotes,
    dayPlans,
    dayPlanItems,
    bookLabProjects,
    bookLabNotes,
    bookLabNoteContexts,
    protocolConflictReviews,
    protocolConflicts,
    userPaths,
    userPathPractices,
    pathSetupActions,
    transferResponsesResult,
    implementationConfirmations,
    privatePathsResult,
    frictionEventsResult,
    selfRulesResult,
  ] = await Promise.all([
    selectAll('habits'),
    selectAll('habit_revisions'),
    selectAll('habit_friction_responses'),
    selectAll('habit_logs'),
    selectAll('quote_favorites'),
    selectAll('daily_quotes'),
    selectAll('day_plans'),
    selectAll('day_plan_items'),
    selectAll('book_lab_projects'),
    selectAll('book_lab_notes'),
    selectAll('book_lab_note_contexts'),
    selectAll('protocol_conflict_reviews'),
    selectAll('protocol_conflicts'),
    selectAll('user_paths'),
    selectAll('user_path_practices'),
    selectAll('path_setup_actions'),
    supabase.from('path_transfer_responses').select('*').is('archived_at', null),
    selectAll('path_implementation_confirmations'),
    supabase.from('paths').select('*').not('owner_id', 'is', null),
    supabase.from('habit_friction_events').select('*').is('archived_at', null),
    supabase.from('self_rules').select('*').is('archived_at', null),
  ]);

  if (transferResponsesResult.error !== null) {
    throw toDataError(transferResponsesResult.error);
  }
  if (privatePathsResult.error !== null) throw toDataError(privatePathsResult.error);
  if (frictionEventsResult.error !== null) {
    throw toDataError(frictionEventsResult.error);
  }
  if (selfRulesResult.error !== null) throw toDataError(selfRulesResult.error);
  const privatePaths = privatePathsResult.data ?? [];
  const privatePathIds = privatePaths.map((path) => path.id);

  let pathStages: unknown[] = [];
  let pathPractices: unknown[] = [];
  let pathReadings: unknown[] = [];
  let selfRuleEvents: unknown[] = [];

  const selfRuleIds = (selfRulesResult.data ?? []).map((rule) => rule.id);
  if (selfRuleIds.length > 0) {
    const selfRuleEventsResult = await supabase
      .from('self_rule_events')
      .select('*')
      .in('rule_id', selfRuleIds);
    if (selfRuleEventsResult.error !== null) {
      throw toDataError(selfRuleEventsResult.error);
    }
    selfRuleEvents = selfRuleEventsResult.data ?? [];
  }

  if (privatePathIds.length > 0) {
    const stagesResult = await supabase
      .from('path_stages')
      .select('*')
      .in('path_id', privatePathIds);
    if (stagesResult.error !== null) throw toDataError(stagesResult.error);
    pathStages = stagesResult.data ?? [];

    const stageIds = (stagesResult.data ?? []).map((stage) => stage.id);
    if (stageIds.length > 0) {
      const [practicesResult, readingsResult] = await Promise.all([
        supabase.from('path_practices').select('*').in('stage_id', stageIds),
        supabase.from('path_readings').select('*').in('stage_id', stageIds),
      ]);
      if (practicesResult.error !== null) throw toDataError(practicesResult.error);
      if (readingsResult.error !== null) throw toDataError(readingsResult.error);
      pathPractices = practicesResult.data ?? [];
      pathReadings = readingsResult.data ?? [];
    }
  }

  return {
    exported_at: nowIso(),
    format_version: 9,
    profile,
    habits,
    habit_revisions: habitRevisions,
    habit_friction_events: frictionEventsResult.data ?? [],
    habit_friction_responses: frictionResponses,
    self_rules: selfRulesResult.data ?? [],
    self_rule_events: selfRuleEvents,
    habit_logs: habitLogs,
    quote_favorites: favorites,
    daily_quotes: dailyQuotes,
    day_plans: dayPlans,
    day_plan_items: dayPlanItems,
    book_lab_projects: bookLabProjects,
    book_lab_notes: bookLabNotes,
    book_lab_note_contexts: bookLabNoteContexts,
    protocol_conflict_reviews: protocolConflictReviews,
    protocol_conflicts: protocolConflicts,
    private_paths: privatePaths,
    path_stages: pathStages,
    path_practices: pathPractices,
    path_readings: pathReadings,
    user_paths: userPaths,
    user_path_practices: userPathPractices,
    path_setup_actions: pathSetupActions,
    path_transfer_responses: transferResponsesResult.data ?? [],
    path_implementation_confirmations: implementationConfirmations,
  };
}

export type ExportOutcome = 'shared' | 'unavailable';

/**
 * Zapisuje zrzut do pliku i oddaje go systemowemu arkuszowi udostępniania.
 *
 * Plik ląduje w katalogu cache, nie w dokumentach: to jednorazowy transfer,
 * a nie kopia, którą aplikacja miałaby przechowywać.
 */
export async function exportUserDataToFile(): Promise<ExportOutcome> {
  const payload = await collectUserData();
  const fileName = `tarento-${payload.exported_at.slice(0, 10)}.json`;

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
  });

  return 'shared';
}
