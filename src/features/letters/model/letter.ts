import { z } from 'zod';

import type { IsoDate } from '@/lib/date';

/**
 * List do siebie za rok.
 *
 * Jedyna rzecz w aplikacji, która wraca po roku — i dlatego działa. Pisany
 * raz, przy zamknięciu ścieżki; doręczany cicho, przy wejściu na ekran „Dziś".
 */
export type Letter = {
  id: string;
  userId: string;
  body: string;
  writtenOn: IsoDate;
  /** Doba logiczna, od której list ma się pokazać. */
  deliverOn: IsoDate;
  /** Znacznik pokazania. `null` oznacza list, który jeszcze czeka. */
  deliveredAt: string | null;
};

/** Ile dni list czeka. Rok, bez wyjątków — to jest cała mechanika. */
export const LETTER_DELAY_DAYS = 365;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

export const letterRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    body: z.string(),
    written_on: isoDate,
    deliver_on: isoDate,
    delivered_at: z.string().nullable(),
  })
  .transform((row): Letter => ({
    id: row.id,
    userId: row.user_id,
    body: row.body,
    writtenOn: row.written_on,
    deliverOn: row.deliver_on,
    deliveredAt: row.delivered_at,
  }));
