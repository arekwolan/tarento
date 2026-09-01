export const frictionKeys = {
  all: ['friction'] as const,
  maps: (userId: string) => [...frictionKeys.all, 'map', userId] as const,
  map: (userId: string, today: string) => [...frictionKeys.maps(userId), today] as const,
  saveEvent: () => [...frictionKeys.all, 'save-event'] as const,
  archiveEvent: () => [...frictionKeys.all, 'archive-event'] as const,
  respond: () => [...frictionKeys.all, 'respond'] as const,
};
