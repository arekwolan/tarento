import { PLAN_ITEM_SCHEMA } from '../_shared/plan-item.ts';
import { SCHEDULE_TYPES } from '../_shared/schedule.ts';

/**
 * Schemat odpowiedzi: ten sam PlanItem co wszędzie plus harmonogram.
 *
 * Harmonogram jest tu potrzebny, bo „codziennie → pon/śr/pt" bywa jedynym
 * sensownym zmniejszeniem nawyku, którego wartości nie da się już podzielić.
 */
export const DOWNSHIFT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ...PLAN_ITEM_SCHEMA.properties,
    schedule_type: { type: 'STRING', enum: SCHEDULE_TYPES },
    schedule_days: {
      type: 'ARRAY',
      description: 'Dni tygodnia dla schedule_type = custom. 0 = niedziela.',
      items: { type: 'INTEGER' },
    },
  },
  required: [...PLAN_ITEM_SCHEMA.required],
  propertyOrdering: [
    ...PLAN_ITEM_SCHEMA.propertyOrdering,
    'schedule_type',
    'schedule_days',
  ],
} as const;
