import { z } from 'zod';

export type Quote = {
  id: string;
  content: string;
  author: string;
  sourceBook: string | null;
  language: string;
  tags: string[];
  isPublicDomain: boolean;
};

export const quoteRowSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    author: z.string(),
    source_book: z.string().nullable(),
    language: z.string(),
    tags: z.array(z.string()).nullable(),
    is_public_domain: z.boolean(),
  })
  .transform((row): Quote => ({
    id: row.id,
    content: row.content,
    author: row.author,
    sourceBook: row.source_book,
    language: row.language,
    tags: row.tags ?? [],
    isPublicDomain: row.is_public_domain,
  }));

/**
 * Deterministyczny wybór cytatu na dany dzień.
 *
 * FNV-1a po `userId:date` daje ten sam indeks na każdym urządzeniu tego
 * samego użytkownika, więc telefon i tablet pokazują ten sam cytat, nawet
 * jeśli oba wchodzą do aplikacji zanim którekolwiek zdąży zapisać wybór.
 */
export function pickQuoteIndex(seed: string, count: number): number {
  if (count <= 0) return -1;

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash % count;
}
