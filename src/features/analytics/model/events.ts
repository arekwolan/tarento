import type { Habit } from '@/features/habits/model/habit';
import type {
  ProtocolConflictDecision,
  ProtocolConflictType,
} from '@/features/conflict-radar/model/schemas';
import type { FrictionReason, FrictionResponseKind } from '@/features/friction';
import type { PathKind, PathSourceKind, TransferResponse } from '@/features/paths';
import type { SelfRuleType } from '@/features/self-knowledge/model/self-rule';

/**
 * Katalog zdarzeń produktowych.
 *
 * Właściwości są wypisane co do jednej i celowo nie ma wśród nich niczego,
 * co użytkownik sam napisał: tytuły nawyków, opisy i notatki bywają
 * dziennikiem osobistym. Typ mapy sprawia, że dołożenie takiego pola jest
 * błędem kompilacji, a nie kwestią czyjejś czujności.
 */
export type AnalyticsEvents = {
  habit_created: {
    unit: Habit['unit'];
    schedule_type: Habit['scheduleType'];
    progression_mode: Habit['progressionMode'];
    category: string | null;
    has_reminder: boolean;
    from_template: boolean;
  };
  habit_completed: {
    unit: Habit['unit'];
    schedule_type: Habit['scheduleType'];
    current_streak: number;
  };
  streak_milestone: {
    days: number;
    scope: 'habit' | 'day';
  };
  onboarding_completed: {
    starter_habits: number;
    reminders_enabled: boolean;
    area: string | null;
  };
  quote_shared: {
    /** Cytat z publicznego katalogu — nie mówi nic o użytkowniku. */
    quote_id: string;
    author: string;
  };
  day_all_complete: {
    completed: number;
    skipped: number;
  };
  path_continue_opened: {
    stage_ordinal: number;
    total_stages: number;
  };
  path_reading_opened: {
    source_kind: PathSourceKind;
    week: number;
    has_body: boolean;
  };
  path_reading_finished: {
    source_kind: PathSourceKind;
    week: number;
    has_body: boolean;
  };
  path_transfer_answered: {
    /** Wyłącznie enum — prywatny przykład nigdy nie trafia do telemetrii. */
    response: TransferResponse;
    protocol_type: PathKind;
  };
  habit_friction_recorded: {
    /** Wyłącznie enum; nazwa nawyku i notatka dnia są zabronione. */
    reason: FrictionReason;
  };
  habit_friction_suggestion_answered: {
    /** Prywatna telemetria niesie tylko dwa zamknięte enumy. */
    reason: FrictionReason;
    response: FrictionResponseKind;
  };
  self_rule_answered: {
    /** Bez wartości reguły, liczników i nazwy nawyku. */
    rule_type: SelfRuleType;
    action: 'accepted' | 'rejected' | 'reviewed' | 'expired';
  };
  self_rule_context_toggled: {
    /** Jawny kontekst preview; telemetria nadal zna tylko zamknięte enumy. */
    rule_type: SelfRuleType;
    action: 'enabled' | 'disabled';
  };
  protocol_conflict_answered: {
    /** Bez tekstu, tytułu, identyfikatorów i par notatek. */
    conflict_type: ProtocolConflictType;
    decision: ProtocolConflictDecision;
  };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Progi, przy których seria jest warta odnotowania. */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 180, 365];

/** Największy osiągnięty próg albo null, gdy seria jeszcze go nie dobiła. */
export function reachedMilestone(streak: number): number | null {
  let reached: number | null = null;
  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone) reached = milestone;
  }
  return reached;
}
