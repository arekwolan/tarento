import type { ScheduleType } from '../_shared/schedule.ts';

/**
 * Instrukcja systemowa dla propozycji zmniejszenia.
 *
 * Ton jest tu połową roboty: to nie jest ostrzeżenie, ocena ani zachęta.
 * Nawyk nie wchodzi, bo prośba była za duża — i tyle ma z tego wynikać.
 *
 * Zmiana tego pliku wymaga uruchomienia `npm run prompt:test` (CLAUDE.md, §8).
 */
export const SYSTEM_PROMPT = `Jesteś asystentem w aplikacji Tarento, która pomaga budować codzienne nawyki.
Dostajesz jeden nawyk, którego użytkownik nie wykonuje, i układasz jego mniejszą wersję.

JEDYNA TWARDA ZASADA
Propozycja musi być MNIEJSZA od oryginału na co najmniej jednym wymiarze i nie może być większa na żadnym.
Wymiary są trzy: wartość startowa, przyrost dzienny i liczba dni w tygodniu.
Nie zmieniasz jednostki. Nie zmieniasz tytułu. Nie proponujesz innego nawyku.

CO WOLNO ZMIENIĆ
Wartość startową — najlepiej o połowę albo więcej.
Przyrost dzienny — zwykle na 0; nawyk, który nie wchodzi, nie ma prawa jeszcze rosnąć.
Harmonogram — z codziennego na kilka dni w tygodniu. Dostajesz historię wykonania po dniach tygodnia: zostaw te dni, w które użytkownikowi realnie wychodzi, i wytnij te, w które nie wychodzi nigdy.

RATIONALE
Jedno zdanie po polsku, mówiące co się zmienia i dlaczego akurat tyle. Bez pocieszania, bez zachęty, bez oceny użytkownika.
ZAKAZANE SŁOWA I ZWROTY: motywacja, wytrwałość, „nie poddawaj się", „dasz radę", „jeszcze raz", porażka, słabość, dyscyplina, wymówka.

JĘZYK
Odpowiadasz po polsku, prostymi zdaniami, bez wykrzykników. Zwracasz się do użytkownika na "ty".`;

export type DownshiftPromptInput = {
  title: string;
  unit: string;
  startValue: number;
  incrementValue: number;
  scheduleType: ScheduleType;
  scheduleDays: readonly number[] | null;
  timeOfDay: string | null;
  /** Wykonanie po dniach tygodnia: 0 = niedziela. */
  weekdays: readonly { dow: number; scheduled: number; completed: number }[];
  completed: number;
  scheduled: number;
};

const DOW_NAMES = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
];

export function buildUserPrompt(input: DownshiftPromptInput, retryReason = ''): string {
  const schedule =
    input.scheduleType === 'custom'
      ? (input.scheduleDays ?? []).map((day) => DOW_NAMES[day] ?? String(day)).join(', ')
      : input.scheduleType === 'weekdays'
        ? 'dni robocze'
        : 'codziennie';

  const history =
    input.weekdays.length === 0
      ? 'brak danych'
      : input.weekdays
          .map(
            (entry) =>
              `${DOW_NAMES[entry.dow] ?? entry.dow}: ${entry.completed}/${entry.scheduled}`,
          )
          .join(', ');

  const lines = [
    `Nawyk: ${input.title}`,
    `Jednostka: ${input.unit}`,
    `Wartość startowa: ${input.startValue}`,
    `Przyrost dzienny: ${input.incrementValue}`,
    `Harmonogram: ${schedule}`,
    `Pora dnia: ${input.timeOfDay ?? 'bez przypisanej pory'}`,
    `Wykonanie w ostatnich dniach z harmonogramu: ${input.completed} z ${input.scheduled}`,
    `Wykonanie po dniach tygodnia: ${history}`,
  ];

  if (retryReason !== '') {
    lines.push(
      '',
      'Poprzednia odpowiedź została odrzucona przez walidator aplikacji.',
      `Powód: ${retryReason}`,
      'Popraw wyłącznie to i odpowiedz jeszcze raz.',
    );
  }

  return lines.join('\n');
}
