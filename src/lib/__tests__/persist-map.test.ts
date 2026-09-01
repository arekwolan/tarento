import { persistReplacer, persistReviver } from '@/lib/persist-map';

/** Symuluje pełny cykl persistera: JSON.stringify → MMKV → JSON.parse. */
function roundtrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, persistReplacer), persistReviver);
}

describe('persist-map', () => {
  it('Map przeżywa zapis i odczyt jako Map, nie zwykły obiekt', () => {
    const original = new Map<string, number>([
      ['habit-1', 3],
      ['habit-2', 0],
    ]);

    const restored = roundtrip(original);

    expect(restored).toBeInstanceOf(Map);
    expect((restored as Map<string, number>).get('habit-1')).toBe(3);
    expect((restored as Map<string, number>).get('habit-2')).toBe(0);
  });

  it('Map zagnieżdżona w strukturze zapytań TanStack Query też wraca jako Map', () => {
    const client = {
      clientState: {
        queries: [
          { queryKey: ['habits', 'progress'], state: { data: new Map([['a', 1]]) } },
        ],
      },
    };

    const restored = roundtrip(client) as typeof client;

    expect(restored.clientState.queries[0]?.state.data).toBeInstanceOf(Map);
    expect(
      (restored.clientState.queries[0]?.state.data as Map<string, number>).get('a'),
    ).toBe(1);
  });

  it('zwykłe obiekty i tablice nie są dotykane', () => {
    const value = { habits: [{ id: 'h1', title: 'Woda' }], count: 2 };
    expect(roundtrip(value)).toEqual(value);
  });

  it('pusta Map wraca jako pusta Map, nie jako undefined', () => {
    const restored = roundtrip(new Map());
    expect(restored).toBeInstanceOf(Map);
    expect((restored as Map<unknown, unknown>).size).toBe(0);
  });
});
