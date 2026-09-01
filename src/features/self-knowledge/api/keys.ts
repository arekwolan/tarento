export const selfKnowledgeKeys = {
  all: ['self-knowledge'] as const,
  rules: (userId: string) => [...selfKnowledgeKeys.all, 'rules', userId] as const,
  sync: () => [...selfKnowledgeKeys.all, 'sync'] as const,
  decide: () => [...selfKnowledgeKeys.all, 'decide'] as const,
  archive: () => [...selfKnowledgeKeys.all, 'archive'] as const,
};
