export const templateKeys = {
  all: ['habit-templates'] as const,
  list: (language: string) => [...templateKeys.all, 'list', language] as const,
} as const;
