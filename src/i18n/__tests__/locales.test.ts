import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';

/**
 * CLAUDE.md: en.json nie może zostać z brakującym kluczem. Ten test jest
 * egzekwowaniem tamtej reguły, a nie testem "na wszelki wypadek".
 */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, nested]) =>
      flattenKeys(nested, prefix === '' ? key : `${prefix}.${key}`),
    )
    .sort();
}

function flattenValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(flattenValues);
}

describe('tłumaczenia', () => {
  it('pl i en mają identyczny zestaw kluczy', () => {
    expect(flattenKeys(en)).toEqual(flattenKeys(pl));
  });

  it.each([
    ['pl', pl],
    ['en', en],
  ])('%s nie ma pustych wartości', (_language, bundle) => {
    for (const value of flattenValues(bundle)) {
      expect(value.trim()).not.toBe('');
    }
  });
});
