import { z } from 'zod';

import type { IsoDate } from '@/lib/date';
import { addDays } from '@/lib/date';

export const frictionReasonSchema = z.enum([
  'forgot',
  'no_time',
  'too_big',
  'wrong_time',
  'environment',
  'not_today',
]);
export type FrictionReason = z.infer<typeof frictionReasonSchema>;

export const frictionResponseSchema = z.enum(['acted', 'dismissed']);
export type FrictionResponseKind = z.infer<typeof frictionResponseSchema>;

export const frictionSuggestionActionSchema = z.enum([
  'reminder',
  'downshift',
  'time',
  'prepare',
  'rest',
]);
export type FrictionSuggestionAction = z.infer<typeof frictionSuggestionActionSchema>;

export const FRICTION_WINDOW_DAYS = 42;
export const FRICTION_THRESHOLD = 3;
export const FRICTION_SUPPRESSION_DAYS = 30;

/** UUID v4 jest częścią serializowalnego żądania i przeżywa retry offline. */
export function createFrictionRequestId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(random() * 16);
    const nibble = token === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export const FRICTION_REASON_ORDER: readonly FrictionReason[] = [
  'forgot',
  'no_time',
  'too_big',
  'wrong_time',
  'environment',
  'not_today',
];

export const frictionEventRowSchema = z
  .object({
    id: z.string().uuid(),
    habit_id: z.string().uuid(),
    user_id: z.string().uuid(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: frictionReasonSchema,
    idempotency_key: z.string().uuid(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    eventDate: row.event_date,
    reason: row.reason,
    idempotencyKey: row.idempotency_key,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));

export type FrictionEvent = z.infer<typeof frictionEventRowSchema>;

export const frictionResponseRowSchema = z
  .object({
    id: z.string().uuid(),
    habit_id: z.string().uuid(),
    user_id: z.string().uuid(),
    reason: frictionReasonSchema,
    response: frictionResponseSchema,
    effective_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    suppressed_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    idempotency_key: z.string().uuid(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    reason: row.reason,
    response: row.response,
    effectiveOn: row.effective_on,
    suppressedUntil: row.suppressed_until,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  }));

export type FrictionResponse = z.infer<typeof frictionResponseRowSchema>;

export type FrictionSuggestion = {
  habitId: string;
  reason: FrictionReason;
  action: FrictionSuggestionAction;
  count: number;
  firstDate: IsoDate;
  lastDate: IsoDate;
  windowDays: number;
};

/** Quiet week pozostaje naprawdę cichy: karta znika bez komunikatu na Dzisiaj. */
export function visibleFrictionSuggestion(
  suggestion: FrictionSuggestion | null,
  quietWeekEndsOn: IsoDate | null,
): FrictionSuggestion | null {
  return quietWeekEndsOn === null ? suggestion : null;
}

/** Zamknięty, deterministyczny routing. Żadna sugestia W2 nie używa AI. */
export function actionForFrictionReason(
  reason: FrictionReason,
): FrictionSuggestionAction {
  switch (reason) {
    case 'forgot':
      return 'reminder';
    case 'no_time':
    case 'too_big':
      return 'downshift';
    case 'wrong_time':
      return 'time';
    case 'environment':
      return 'prepare';
    case 'not_today':
      return 'rest';
  }
}

function responseIsNewer(left: FrictionResponse, right: FrictionResponse): boolean {
  if (left.effectiveOn !== right.effectiveOn) {
    return left.effectiveOn > right.effectiveOn;
  }
  return left.createdAt > right.createdAt;
}

/**
 * Zwraca najwyżej jedną sugestię dla całej listy Dzisiaj.
 *
 * Przy remisie wygrywa wzorzec z większą liczbą zdarzeń, potem nowszy,
 * następnie stała kolejność enumów i identyfikator nawyku. Dzięki temu ten sam
 * zestaw danych nigdy nie przetasowuje kart między renderami.
 */
export function findFrictionSuggestion(
  events: readonly FrictionEvent[],
  responses: readonly FrictionResponse[],
  today: IsoDate,
): FrictionSuggestion | null {
  const from = addDays(today, -(FRICTION_WINDOW_DAYS - 1));
  const latestResponse = new Map<string, FrictionResponse>();

  for (const response of responses) {
    if (response.effectiveOn > today) continue;
    const key = `${response.habitId}:${response.reason}`;
    const current = latestResponse.get(key);
    if (current === undefined || responseIsNewer(response, current)) {
      latestResponse.set(key, response);
    }
  }

  const groups = new Map<string, FrictionEvent[]>();
  for (const event of events) {
    if (event.archivedAt !== null || event.eventDate < from || event.eventDate > today) {
      continue;
    }

    const key = `${event.habitId}:${event.reason}`;
    const response = latestResponse.get(key);

    if (response?.response === 'dismissed' && response.suppressedUntil >= today) {
      continue;
    }
    if (response?.response === 'acted' && event.eventDate <= response.effectiveOn) {
      continue;
    }

    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  const candidates: FrictionSuggestion[] = [];
  for (const group of groups.values()) {
    if (group.length < FRICTION_THRESHOLD) continue;
    const ordered = [...group].sort((left, right) =>
      left.eventDate.localeCompare(right.eventDate),
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (first === undefined || last === undefined) continue;

    candidates.push({
      habitId: first.habitId,
      reason: first.reason,
      action: actionForFrictionReason(first.reason),
      count: group.length,
      firstDate: first.eventDate,
      lastDate: last.eventDate,
      windowDays: FRICTION_WINDOW_DAYS,
    });
  }

  candidates.sort((left, right) => {
    if (left.count !== right.count) return right.count - left.count;
    if (left.lastDate !== right.lastDate) {
      return right.lastDate.localeCompare(left.lastDate);
    }
    const reasonDifference =
      FRICTION_REASON_ORDER.indexOf(left.reason) -
      FRICTION_REASON_ORDER.indexOf(right.reason);
    if (reasonDifference !== 0) return reasonDifference;
    return left.habitId.localeCompare(right.habitId);
  });

  return candidates[0] ?? null;
}
