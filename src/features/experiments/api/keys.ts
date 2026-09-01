export const personalExperimentKeys = {
  all: ['personal-experiments'] as const,
  detail: (userId: string, habitId: string) =>
    [...personalExperimentKeys.all, 'detail', userId, habitId] as const,
  action: () => [...personalExperimentKeys.all, 'action'] as const,
} as const;
