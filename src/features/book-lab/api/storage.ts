import { createMMKV } from 'react-native-mmkv';

import {
  persistedBookLabSchema,
  type PersistedBookLab,
} from '@/features/book-lab/model/schemas';

const storage = createMMKV({ id: 'tarento.book-lab' });

function key(userId: string): string {
  return `draft:${userId}`;
}

export function loadBookLabLocalDraft(userId: string): PersistedBookLab | null {
  const raw = storage.getString(key(userId));
  if (raw === undefined) return null;
  try {
    return persistedBookLabSchema.parse(JSON.parse(raw));
  } catch {
    storage.remove(key(userId));
    return null;
  }
}

export function saveBookLabLocalDraft(userId: string, draft: PersistedBookLab): void {
  const parsed = persistedBookLabSchema.safeParse(draft);
  if (!parsed.success) return;
  storage.set(key(userId), JSON.stringify(parsed.data));
}

export function clearBookLabLocalDraft(userId: string): void {
  storage.remove(key(userId));
}
