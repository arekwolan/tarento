import type {
  DayBlock,
  DayRotation,
  DayTemplate,
  TimeWindow,
} from '@/features/day-budget/model/schemas';
import {
  daysBetween,
  minutesOfDay,
  timeOfDayFromMinutes,
  type IsoDate,
} from '@/lib/date';

/**
 * Arytmetyka okien w dobie. Czyste funkcje — bez zegara, bez sieci, bez stanu.
 *
 * CLAUDE.md, reguła krytyczna 2: w tym pliku nie ma `new Date()` ani
 * `Date.now()`. Różnicę dni liczy `daysBetween` z @/lib/date, resztę
 * rozstrzygają minuty od północy.
 */

export type { TimeWindow };

/**
 * Parametry są strukturalne, a nie związane z `DayTemplate`, bo tej samej
 * arytmetyki używa wersja robocza z onboardingu — kształt dnia istnieje tam,
 * zanim powstanie wiersz w bazie, więc nie ma jeszcze ani id, ani znaczników
 * czasu. Gotowy `DayTemplate` i `DayBlock` pasują do nich bez konwersji.
 */

/** Granice czuwania: od pobudki do snu, obie w zapisie 'HH:MM'. */
export type DayShape = Pick<DayTemplate, 'wakeTime' | 'sleepTime'>;

/** Zajęty pas doby. Zarchiwizowany nie zajmuje już czasu. */
export type BusySpan = Pick<DayBlock, 'startTime' | 'endTime'> & {
  archivedAt?: string | null;
};

/** Kształt doby plus deklaracja, ile z niej idzie na siebie. */
export type SelfBudget = DayShape & Pick<DayTemplate, 'selfMinutes'>;

/** Doba w minutach. Koniec przedziału bywa równy tej wartości. */
const MINUTES_PER_DAY = 1440;

/**
 * Najkrótsze okno, które ma sens.
 *
 * Ośmiu minut między dwoma spotkaniami nie da się na nic wykorzystać, a lista
 * takich okruchów wygląda jak wolny czas, którego nie ma.
 */
const MIN_WINDOW_MINUTES = 10;

/** Przedział w minutach od północy, półotwarty: [from, to). */
type Span = { from: number; to: number };

/**
 * Szablon obowiązujący danego dnia.
 *
 * Indeks to reszta z dzielenia liczby dni od kotwicy przez długość rotacji.
 * Reszta, nie `%`: dzień sprzed kotwicy ma różnicę ujemną, a JS-owe `%`
 * oddałoby wtedy indeks ujemny i rotacja urwałaby się na dacie zakotwiczenia.
 */
export function templateForDate(rotation: DayRotation, date: IsoDate): string {
  const ids = rotation.templateIds;
  const length = ids.length;
  const offset = daysBetween(rotation.anchorDate, date);
  const index = length === 0 ? 0 : ((offset % length) + length) % length;
  const templateId = ids[index];

  if (templateId === undefined) {
    throw new RangeError('Rotacja bez szablonów nie wskazuje żadnego dnia.');
  }

  return templateId;
}

/**
 * Wolne okna doby: od pobudki do snu, minus zajęte pasy.
 *
 * Bloki nakładające się i stykające scalamy — dwa spotkania 9:00–11:00
 * i 10:30–12:00 to jedna dziura w dniu, nie dwie. Okna krótsze niż
 * MIN_WINDOW_MINUTES wypadają z wyniku.
 */
export function freeWindows(shape: DayShape, blocks: readonly BusySpan[]): TimeWindow[] {
  return freeSpans(shape, blocks).map(toWindow);
}

/**
 * Okno, które widzi użytkownik: JEDNO, o długości `selfMinutes`, dosunięte do
 * początku najdłuższego wolnego okna.
 *
 * Wolna pula zostaje w modelu (IDEAS.md §A): liczba na ekranie ma być granicą,
 * nie inwentarzem, więc nie sumujemy wszystkich dziur w dniu.
 *
 * Gdy najdłuższe okno nie mieści deklaracji, zwracamy je w całości — dzień
 * bywa ciaśniejszy, niż użytkownik zakładał, i lepiej pokazać prawdę niż nic.
 * `null` znaczy, że nie ma ani jednego okna sensownej długości.
 */
export function allocatedWindow(
  budget: SelfBudget,
  blocks: readonly BusySpan[],
): TimeWindow | null {
  const longest = longestFreeSpan(budget, blocks);
  if (longest === null) return null;

  return toWindow({
    from: longest.from,
    to: longest.from + allocatedMinutes(budget, longest),
  });
}

/**
 * Ile z dziennego okna jeszcze się mieści o podanej godzinie.
 *
 * Okno jest przydzielone w konkretnym miejscu doby, ale nie przepada, gdy ta
 * godzina minie — liczy się to, ile czasu zostaje do końca wolnego pasa,
 * w którym leży, przycięte deklaracją. Dzięki temu lista kurczy się dopiero
 * wtedy, gdy naprawdę brakuje czasu, a nie w chwili, gdy mija sugerowana pora.
 *
 * @param nowMinutes minuty od północy na zegarze użytkownika
 */
export function remainingSelfMinutes(
  budget: SelfBudget,
  blocks: readonly BusySpan[],
  nowMinutes: number,
): number {
  const longest = longestFreeSpan(budget, blocks);
  if (longest === null) return 0;

  // Pas przechodzący przez północ ma koniec za 24:00, a zegar wraca do zera.
  // Różnica jest wtedy większa niż okno i i tak przycina ją deklaracja.
  return Math.max(
    0,
    Math.min(allocatedMinutes(budget, longest), longest.to - nowMinutes),
  );
}

/**
 * Sufit propozycji: ile z zadeklarowanego okna wolno zająć planem, ścieżką
 * albo podpowiedzią AI.
 *
 * Reguła 60% z IDEAS.md §A. Pozostałe 40% nie jest „nieprzydzielone", tylko
 * chronione — dlatego współczynnik występuje w całym kodzie wyłącznie tutaj.
 */
export const SAFE_BUDGET_RATIO = 0.6;

export function budgetCeiling(budget: Pick<DayTemplate, 'selfMinutes'>): number {
  return Math.floor(budget.selfMinutes * SAFE_BUDGET_RATIO);
}

// Wnętrze --------------------------------------------------------------------

/** Najdłuższe wolne okno. Przy remisie wygrywa wcześniejsze w dobie. */
function longestFreeSpan(shape: DayShape, blocks: readonly BusySpan[]): Span | null {
  return freeSpans(shape, blocks).reduce<Span | null>(
    (best, span) =>
      best === null || span.to - span.from > best.to - best.from ? span : best,
    null,
  );
}

/** Deklaracja przycięta długością okna, w którym ma się zmieścić. */
function allocatedMinutes(budget: SelfBudget, span: Span): number {
  return Math.min(Math.max(0, budget.selfMinutes), span.to - span.from);
}

/** Wolne okna jako przedziały minutowe — wspólna podstawa funkcji wyżej. */
function freeSpans(shape: DayShape, blocks: readonly BusySpan[]): Span[] {
  const busy = mergeSpans(
    blocks
      // Zarchiwizowany blok nie zajmuje już czasu (CLAUDE.md, reguła 4).
      .filter((block) => (block.archivedAt ?? null) === null)
      .map((block) => toSpan(block.startTime, block.endTime))
      .filter((span): span is Span => span !== null),
  );

  return awakeSpans(shape)
    .flatMap((awake) => subtractSpans(awake, busy))
    .filter((span) => span.to - span.from >= MIN_WINDOW_MINUTES);
}

/**
 * Czuwanie jako przedziały w obrębie doby.
 *
 * Gdy sen wypada przed pobudką (dyżur nocny), czuwanie przechodzi przez
 * północ — rozbijamy je wtedy tak samo, jak przy zapisie rozbijamy blok: na
 * odcinek do 24:00 i odcinek od 00:00. Kolejność jest kolejnością czuwania,
 * nie zegara: najpierw to, co po pobudce.
 */
function awakeSpans(shape: DayShape): Span[] {
  const wake = minutesOfDay(shape.wakeTime);
  const sleep = minutesOfDay(shape.sleepTime);

  if (wake === null || sleep === null) return [];
  if (sleep > wake) return [{ from: wake, to: sleep }];

  return [
    { from: wake, to: MINUTES_PER_DAY },
    { from: 0, to: sleep },
  ].filter((span) => span.to > span.from);
}

function toSpan(start: string, end: string): Span | null {
  const from = minutesOfDay(start);
  const to = minutesOfDay(end);

  if (from === null || to === null || to <= from) return null;

  return { from, to };
}

/** Scala przedziały nakładające się i stykające. Wynik jest posortowany. */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((left, right) => left.from - right.from);
  const merged: Span[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];

    if (last !== undefined && span.from <= last.to) {
      last.to = Math.max(last.to, span.to);
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

/** Przedział minus zajęte pasy. `busy` musi być scalone i posortowane. */
function subtractSpans(span: Span, busy: readonly Span[]): Span[] {
  const free: Span[] = [];
  let cursor = span.from;

  for (const taken of busy) {
    if (taken.to <= cursor) continue;
    if (taken.from >= span.to) break;

    if (taken.from > cursor) free.push({ from: cursor, to: taken.from });

    cursor = taken.to;
    if (cursor >= span.to) return free;
  }

  if (cursor < span.to) free.push({ from: cursor, to: span.to });

  return free;
}

function toWindow(span: Span): TimeWindow {
  return {
    start: timeOfDayFromMinutes(span.from),
    end: timeOfDayFromMinutes(span.to),
    minutes: span.to - span.from,
  };
}
