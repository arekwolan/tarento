/**
 * Klucze zapytań ścieżek. Wszystkie zaczynają się od 'paths', więc jedna
 * inwalidacja prefiksem czyści cały feature.
 *
 * Katalog nie ma w kluczu userId, bo treść jest wspólna dla wszystkich —
 * po przelogowaniu nie ma czego wyrzucać. Zapis użytkownika ma, i to celowo:
 * cache poprzedniego użytkownika nie może pokazać się nowemu.
 */
export const pathKeys = {
  all: ['paths'] as const,
  catalog: (language: string) => [...pathKeys.all, 'catalog', language] as const,
  privateProtocols: (userId: string) =>
    [...pathKeys.all, 'private-protocols', userId] as const,
  detail: (language: string, slug: string) =>
    [...pathKeys.all, 'detail', language, slug] as const,
  detailById: (userId: string, pathId: string) =>
    [...pathKeys.all, 'detail-by-id', userId, pathId] as const,
  readings: (userId: string, pathId: string) =>
    [...pathKeys.all, 'readings', userId, pathId] as const,
  /** Pochodzenie nawyku: tytuł ścieżki i numer etapu, po id etapu. */
  origin: (userId: string, stageId: string) =>
    [...pathKeys.all, 'origin', userId, stageId] as const,
  /** Zapisy, które jeszcze trwają: aktywny i wstrzymane. */
  active: (userId: string) => [...pathKeys.all, 'active', userId] as const,
  /** Historia zakończeń — wejście do reguły karencji. */
  ended: (userId: string) => [...pathKeys.all, 'ended', userId] as const,
  practices: (userId: string, userPathId: string) =>
    [...pathKeys.all, 'practices', userId, userPathId] as const,
  completion: (userId: string, userPathId: string, today: string) =>
    [...pathKeys.all, 'completion', userId, userPathId, today] as const,
  transfers: (userId: string, userPathId: string) =>
    [...pathKeys.all, 'transfers', userId, userPathId] as const,
  allTransfers: (userId: string) =>
    [...pathKeys.all, 'transfers', userId, 'all'] as const,
  confirmations: (userId: string) => [...pathKeys.all, 'confirmations', userId] as const,
  setupToday: (userId: string, today: string) =>
    [...pathKeys.all, 'setup-actions', userId, today] as const,
  /** Stały klucz mutacji — po niej odtwarzamy kolejkę offline po restarcie. */
  enroll: () => [...pathKeys.all, 'enroll'] as const,
  /** Append-only odpowiedź; requestId w zmiennych zapewnia idempotentny retry. */
  submitTransfer: () => [...pathKeys.all, 'submit-transfer'] as const,
  resolveSetup: () => [...pathKeys.all, 'resolve-setup'] as const,
} as const;
