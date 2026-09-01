import type { PathSourceKind } from '@/features/paths/model/schemas';
import type { TranslationKey } from '@/i18n/keys';

const SOURCE_LABEL = {
  public_domain: 'path.readings.source.publicDomain',
  own_translation: 'path.readings.source.ownTranslation',
  citation: 'path.readings.source.citation',
  pointer: 'path.readings.source.pointer',
  original: 'path.readings.source.original',
} as const satisfies Record<PathSourceKind, TranslationKey>;

export function readingSourceKey(sourceKind: PathSourceKind): TranslationKey {
  return SOURCE_LABEL[sourceKind];
}
