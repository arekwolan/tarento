/**
 * (De)serializacja `Map` dla persistera TanStack Query.
 *
 * `JSON.stringify` gubi `Map`: `fetchHabitsProgress()` i `fetchHabitsStreaks()`
 * zwracają `Map`, a po zapisie do MMKV i odtworzeniu zostałby z niej pusty
 * obiekt `{}` bez metody `.get()` — pierwszy render po starcie aplikacji
 * wywalałby `buildTodayTasks()` na `completedCounts.get is not a function`.
 *
 * Osobny plik bez zależności od `react-native-mmkv`, żeby dało się przetestować
 * samą logikę replacer/reviver bez natywnego modułu.
 */
const MAP_MARKER = '__map__';

type SerializedMap = { [MAP_MARKER]: true; entries: [string, unknown][] };

function isSerializedMap(value: unknown): value is SerializedMap {
  return typeof value === 'object' && value !== null && MAP_MARKER in value;
}

export function persistReplacer(_key: string, value: unknown): unknown {
  return value instanceof Map
    ? ({
        [MAP_MARKER]: true,
        entries: Array.from(value.entries()),
      } satisfies SerializedMap)
    : value;
}

export function persistReviver(_key: string, value: unknown): unknown {
  return isSerializedMap(value) ? new Map(value.entries) : value;
}
