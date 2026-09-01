import {
  allocatedWindow,
  type BusySpan,
  type TimeWindow,
} from '@/features/day-budget/model/windows';
import type { TranslationKey } from '@/i18n/keys';
import {
  addDays,
  dayOfWeek,
  isValidTimeOfDay,
  minutesOfDay,
  shiftTimeOfDay,
  timeOfDayFromMinutes,
  type IsoDate,
} from '@/lib/date';

/**
 * Wersja robocza kształtu dnia — to, co użytkownik ustawia w onboardingu,
 * zanim powstaną wiersze w bazie.
 *
 * Godziny bloków trzymamy jako minuty na osi czuwania, nie jako 'HH:MM'.
 * Pasek przelicza je wprost na piksele, a przy dyżurze nocnym oś przechodzi
 * przez północ i zapis zegarowy przestałby się porządkować rosnąco.
 * Na 'HH:MM' wracamy dopiero przy zapisie — patrz `blockRows()`.
 */

/** Skok wszystkich kontrolek kroku „kształt dnia". */
export const STEP_MINUTES = 15;

/** Najkrótszy pas, który da się jeszcze chwycić za oba uchwyty. */
export const MIN_BLOCK_MINUTES = 30;

/** Długość pasa dokładanego przyciskiem „Dodaj kolejny blok". */
export const NEW_BLOCK_MINUTES = 60;

/** Więcej niż cztery pasy to już grafik, a nie kształt dnia. */
export const MAX_BLOCKS = 4;

/**
 * Chipy z kroku 3.
 *
 * Wszystkie są wielokrotnościami skoku, więc każda liczba minut pokazana
 * użytkownikowi kończy się na 0 albo 5 — a takie liczebniki po polsku zawsze
 * łączą się z formą „minut". Dzięki temu teksty nie potrzebują odmiany przez
 * liczbę, której test parzystości pl/en i tak by nie przepuścił.
 */
export const SELF_MINUTES_OPTIONS = [15, 30, 45, 60] as const;

const MINUTES_PER_DAY = 1440;
const ROTATION_LENGTH = 7;

/** 0 = niedziela, 6 = sobota — numeracja z `dayOfWeek()` i z Postgresa. */
const WEEKEND_DOWS: readonly number[] = [0, 6];

export type DayShapeBlockDraft = {
  id: string;
  /** Minuty na osi czuwania. Koniec bywa > 1440, gdy pas przechodzi przez północ. */
  start: number;
  end: number;
};

export type DayShapeDraft = {
  wakeTime: string;
  sleepTime: string;
  blocks: readonly DayShapeBlockDraft[];
  selfMinutes: number;
};

/** Oś paska doby: zawsze rosnąca, nawet gdy czuwanie przechodzi przez północ. */
export type DayAxis = { start: number; end: number };

/**
 * Wartości domyślne z IDEAS.md §A: 6:30, 23:00, jeden pas 9–17, 30 minut.
 *
 * Funkcja, a nie stała, bo to samo wyjście obsługuje przycisk „Pominę to"
 * i stan początkowy formularza — a żadne z nich nie może dostać obiektu
 * współdzielonego z drugim.
 */
export function defaultDayShape(): DayShapeDraft {
  return {
    wakeTime: '06:30',
    sleepTime: '23:00',
    blocks: [{ id: 'block-1', start: 9 * 60, end: 17 * 60 }],
    selfMinutes: 30,
  };
}

/**
 * Oś paska: od pobudki do snu.
 *
 * Gdy sen wypada przed pobudką (dyżur nocny), doba czuwania przechodzi przez
 * północ — koniec osi leży wtedy za 24:00 i wszystko dalej liczy się rosnąco.
 */
export function dayAxis(shape: Pick<DayShapeDraft, 'wakeTime' | 'sleepTime'>): DayAxis {
  const wake = minutesOfDay(shape.wakeTime) ?? 0;
  const sleep = minutesOfDay(shape.sleepTime) ?? MINUTES_PER_DAY;

  return { start: wake, end: sleep > wake ? sleep : sleep + MINUTES_PER_DAY };
}

/** Zaokrąglenie do skoku kontrolek. */
export function snapToStep(minutes: number): number {
  return Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
}

/** Nowy początek pasa: w osi i nie bliżej końca niż MIN_BLOCK_MINUTES. */
export function clampBlockStart(
  block: DayShapeBlockDraft,
  axis: DayAxis,
  next: number,
): number {
  return Math.min(Math.max(axis.start, snapToStep(next)), block.end - MIN_BLOCK_MINUTES);
}

/** Nowy koniec pasa: w osi i nie bliżej początku niż MIN_BLOCK_MINUTES. */
export function clampBlockEnd(
  block: DayShapeBlockDraft,
  axis: DayAxis,
  next: number,
): number {
  return Math.max(Math.min(axis.end, snapToStep(next)), block.start + MIN_BLOCK_MINUTES);
}

/** Godzina przesunięta o skoki. Niepoprawny zapis zostaje bez zmian. */
export function stepTime(value: string, steps: number): string {
  if (!isValidTimeOfDay(value)) return value;

  return shiftTimeOfDay(value, steps * STEP_MINUTES);
}

/** Minuty na osi → 'HH:MM' na zegarze. */
export function axisTimeLabel(minutes: number): string {
  return timeOfDayFromMinutes(
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY,
  );
}

/**
 * Pas roboczy → wiersze do zapisu.
 *
 * Pas przechodzący przez północ rozbijamy na dwa: do 24:00 i od 00:00. Tego
 * samego wymaga CHECK `day_blocks_order` w migracji, i dzięki temu arytmetyka
 * okna jest jednoznaczna.
 */
export function blockRows(block: DayShapeBlockDraft): BusySpan[] {
  const length = block.end - block.start;
  if (length <= 0) return [];

  const start = ((block.start % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const end = start + length;

  if (end <= MINUTES_PER_DAY) {
    return [
      { startTime: timeOfDayFromMinutes(start), endTime: timeOfDayFromMinutes(end) },
    ];
  }

  return [
    {
      startTime: timeOfDayFromMinutes(start),
      endTime: timeOfDayFromMinutes(MINUTES_PER_DAY),
    },
    {
      startTime: timeOfDayFromMinutes(0),
      endTime: timeOfDayFromMinutes(end - MINUTES_PER_DAY),
    },
  ];
}

/** Wszystkie pasy wersji roboczej w postaci, w jakiej trafią do bazy. */
export function draftBusySpans(draft: DayShapeDraft): BusySpan[] {
  return draft.blocks.flatMap(blockRows);
}

/**
 * Okno, które zobaczy użytkownik — liczone tą samą funkcją co po zapisie,
 * żeby liczba z onboardingu nie różniła się od liczby na ekranie „Dzisiaj".
 */
export function draftWindow(draft: DayShapeDraft): TimeWindow | null {
  return allocatedWindow(draft, draftBusySpans(draft));
}

/**
 * Propozycja kolejnego pasa: za ostatnim, godzina długości.
 *
 * `null`, gdy do snu nie zostaje już tyle czasu — przycisk jest wtedy
 * wyłączony, zamiast dokładać pas, którego nie widać.
 */
export function nextBlockDraft(
  draft: DayShapeDraft,
  id: string,
): DayShapeBlockDraft | null {
  const axis = dayAxis(draft);
  const lastEnd = draft.blocks.reduce(
    (latest, block) => Math.max(latest, block.end),
    axis.start,
  );
  const start = snapToStep(Math.min(lastEnd + STEP_MINUTES, axis.end));
  const end = start + NEW_BLOCK_MINUTES;

  return end > axis.end ? null : { id, start, end };
}

/**
 * Siedmiodniowa rotacja ułożona pod dni tygodnia: dni robocze dostają szablon
 * roboczy, sobota i niedziela — wolny.
 *
 * Pozycja `i` odpowiada dniowi `anchorDate + i`, bo tak liczy `templateForDate`.
 * Dzięki temu kotwicą może być dowolny dzień i nie trzeba szukać poniedziałku.
 */
export function weeklyRotation(
  anchorDate: IsoDate,
  workdayTemplateId: string,
  freeTemplateId: string,
): string[] {
  return Array.from({ length: ROTATION_LENGTH }, (_, offset) =>
    WEEKEND_DOWS.includes(dayOfWeek(addDays(anchorDate, offset)))
      ? freeTemplateId
      : workdayTemplateId,
  );
}

/**
 * Przycina pasy do bieżącej osi.
 *
 * Wołane po każdej zmianie pobudki albo snu: pas, który został poza dobą
 * czuwania, nie jest już zajętym czasem, tylko błędem na ekranie. Pas, który
 * po przycięciu schodzi poniżej MIN_BLOCK_MINUTES, znika.
 */
export function clampDraftBlocks(draft: DayShapeDraft): DayShapeDraft {
  const axis = dayAxis(draft);

  const blocks = draft.blocks
    .map((block) => {
      const start = Math.max(
        axis.start,
        Math.min(block.start, axis.end - MIN_BLOCK_MINUTES),
      );
      const end = Math.min(axis.end, Math.max(block.end, start + MIN_BLOCK_MINUTES));

      return { ...block, start, end };
    })
    .filter((block) => block.end - block.start >= MIN_BLOCK_MINUTES);

  return { ...draft, blocks };
}

/**
 * Które zdanie stoi pod chipami — najważniejszy tekst całego onboardingu.
 *
 * Nigdy nie pokazujemy wyliczonej wolnej puli (IDEAS.md §A): liczba na ekranie
 * jest granicą, nie inwentarzem. Gdy deklaracja się nie mieści, mówimy o dniu
 * roboczym i o weekendzie — bez ostrzeżenia, bez czerwieni, bez ikony.
 */
export function windowMessage(
  draft: DayShapeDraft,
  window: TimeWindow | null,
): { key: TranslationKey; minutes: number } {
  if (window === null) {
    return { key: 'onboarding.dayShape.step3.windowNone', minutes: 0 };
  }

  return window.minutes >= draft.selfMinutes
    ? { key: 'onboarding.dayShape.step3.window', minutes: draft.selfMinutes }
    : { key: 'onboarding.dayShape.step3.windowTight', minutes: window.minutes };
}
