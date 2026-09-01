import { PLAN_ITEM_SCHEMA } from '../_shared/plan-item.ts';

/**
 * Schemat odpowiedzi wymuszany na modelu.
 *
 * `status` jest częścią kontraktu, a nie domysłem po pustej liście: pusty wynik
 * z powodu tematu poza zakresem i pusty wynik z powodu niezrozumiałego zdania
 * to dla użytkownika dwie różne sytuacje i dwa różne komunikaty.
 */

export const MAX_CANDIDATES = 3;

export const SUGGEST_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: {
      type: 'STRING',
      enum: ['ok', 'out_of_scope', 'unclear'],
      description:
        'ok = są propozycje; out_of_scope = temat spoza zakresu aplikacji; ' +
        'unclear = ze zdania nie da się odczytać żadnego zamiaru.',
    },
    candidates: {
      type: 'ARRAY',
      maxItems: MAX_CANDIDATES,
      items: PLAN_ITEM_SCHEMA,
    },
  },
  required: ['status', 'candidates'],
  propertyOrdering: ['status', 'candidates'],
} as const;
