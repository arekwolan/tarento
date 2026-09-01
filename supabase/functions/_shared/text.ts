/**
 * Porównywanie tytułów nawyków.
 *
 * „Czytanie", „czytanie 📖" i „Czytać" mają dla użytkownika oznaczać to samo:
 * duplikat. Model tego nie rozstrzygnie sam, bo za każdym razem widzi listę
 * napisaną trochę inaczej — dlatego rozstrzyga to kod, a nie prompt.
 */

/**
 * Tytuł sprowadzony do postaci porównywalnej: małe litery, bez diakrytyki,
 * bez interpunkcji, pojedyncze spacje.
 *
 * Diakrytykę zdejmuje rozkład NFD i usunięcie znaków łączących — inaczej
 * „ćwiczenia" i „cwiczenia" wyglądałyby jak dwa różne nawyki.
 */
export function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Odległość edycyjna Levenshteina.
 *
 * Dwa wiersze zamiast pełnej macierzy: tytuły są krótkie, ale funkcja liczy
 * się dla każdej pary (kandydat × istniejący nawyk), więc nie ma powodu
 * alokować kwadratu.
 */
export function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitution =
        (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1);
      const deletion = (previous[column] ?? 0) + 1;
      const insertion = (current[column - 1] ?? 0) + 1;

      current[column] = Math.min(substitution, deletion, insertion);
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[right.length] ?? 0;
}
