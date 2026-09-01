import { z } from 'zod';

import type { IsoDate } from '@/lib/date';

export type PathSetupActionStatus = 'pending' | 'completed' | 'dismissed';

export type PathSetupAction = {
  id: string;
  userId: string;
  userPathId: string;
  stageId: string;
  title: string;
  explanation: string | null;
  sortOrder: number;
  status: PathSetupActionStatus;
  decidedOn: IsoDate | null;
  clientRequestId: string | null;
  statusChangedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pathSetupActionRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    user_path_id: z.string().uuid(),
    stage_id: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    explanation: z.string().trim().min(1).max(240).nullable(),
    sort_order: z.number().int(),
    status: z.enum(['pending', 'completed', 'dismissed']),
    decided_on: isoDate.nullable(),
    client_request_id: z.string().uuid().nullable(),
    status_changed_at: z.string(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): PathSetupAction => ({
    id: row.id,
    userId: row.user_id,
    userPathId: row.user_path_id,
    stageId: row.stage_id,
    title: row.title,
    explanation: row.explanation,
    sortOrder: row.sort_order,
    status: row.status,
    decidedOn: row.decided_on,
    clientRequestId: row.client_request_id,
    statusChangedAt: row.status_changed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

/** UUID v4 do terminalnej, idempotentnej decyzji w kolejce offline. */
export function createPathSetupRequestId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(random() * 16);
    const nibble = token === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
