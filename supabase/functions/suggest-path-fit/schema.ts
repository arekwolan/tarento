import { TIME_OF_DAY } from '../_shared/plan-item.ts';

/**
 * Schemat odpowiedzi dopasowania.
 *
 * Ten sam kształt, który ląduje w `user_paths.fit` i który klient zna jako
 * `PathFit` (src/features/paths/model/schemas.ts). Zmiana tutaj wymaga zmiany
 * tam i w migracji, która ten jsonb czyta.
 */
export const PATH_FIT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lite: {
      type: 'BOOLEAN',
      description:
        'Czy prowadzić ścieżkę w wariancie lekkim: niższe wartości startowe ' +
        'i bez praktyk wyłączalnych.',
    },
    skip: {
      type: 'ARRAY',
      description: 'Identyfikatory praktyk do pominięcia, bo użytkownik już to robi.',
      items: { type: 'STRING' },
    },
    adjust: {
      type: 'ARRAY',
      description: 'Praktyki, których wartość startowa albo pora dnia ma być inna.',
      items: {
        type: 'OBJECT',
        properties: {
          practiceId: { type: 'STRING' },
          startValue: { type: 'NUMBER' },
          timeOfDay: { type: 'STRING', enum: TIME_OF_DAY },
        },
        required: ['practiceId', 'startValue', 'timeOfDay'],
        propertyOrdering: ['practiceId', 'startValue', 'timeOfDay'],
      },
    },
    note: {
      type: 'STRING',
      description:
        'Jedno zdanie po polsku o tym, co zostało dopasowane. Pusty string, ' +
        'gdy nic się nie zmieniło.',
    },
  },
  required: ['lite', 'skip', 'adjust', 'note'],
  propertyOrdering: ['lite', 'skip', 'adjust', 'note'],
} as const;
