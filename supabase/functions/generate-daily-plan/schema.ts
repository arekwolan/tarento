import { PLAN_ITEM_SCHEMA } from '../_shared/plan-item.ts';

/**
 * Schemat odpowiedzi wymuszany na modelu.
 *
 * Gemini przyjmuje podzbiór OpenAPI i gwarantuje, że wyjście będzie się w nim
 * mieściło — dzięki temu nie parsujemy prozy regexem i nie musimy obsługiwać
 * przypadku, w którym model dopisał zdanie przed nawiasem klamrowym.
 *
 * Kształt pojedynczej pozycji jest wspólny dla wszystkich funkcji brzegowych
 * (../_shared/plan-item.ts) i ma odpowiednik po stronie klienta jako schemat
 * zod (src/features/ai-plan/model/plan.ts).
 */

/** Twardy sufit liczby pozycji. Ten sam próg powtarza prompt systemowy. */
export const MAX_PLAN_ITEMS = 5;

export const PLAN_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'Jedno zdanie po polsku, streszczające zamysł planu.',
    },
    items: {
      type: 'ARRAY',
      maxItems: MAX_PLAN_ITEMS,
      items: PLAN_ITEM_SCHEMA,
    },
  },
  required: ['summary', 'items'],
  propertyOrdering: ['summary', 'items'],
} as const;
