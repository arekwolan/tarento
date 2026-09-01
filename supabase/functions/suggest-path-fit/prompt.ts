import type { ContextHabit } from '../_shared/context.ts';
import type { FitVerdict } from '../_shared/path-fit.ts';
import { budgetCeiling, MAX_NOTE_LENGTH } from '../_shared/validate-proposal.ts';

/**
 * Instrukcja systemowa dopasowania ścieżki.
 *
 * Cel jest jeden: zabić poczucie „ten program nie był pisany dla mnie".
 * Model nie projektuje ścieżki i nie dokłada do niej niczego — przycina to,
 * co już jest, do doby, którą użytkownik naprawdę ma.
 *
 * Zmiana tego pliku wymaga uruchomienia `npm run prompt:test` (CLAUDE.md, §8).
 */
export const SYSTEM_PROMPT = `Jesteś asystentem w aplikacji Tarento, która prowadzi użytkownika przez gotowe ścieżki praktyk.
Dostajesz definicję ścieżki i kontekst użytkownika, a oddajesz dopasowanie: co pominąć, co zmniejszyć i jednym zdaniem dlaczego.

CZEGO NIE ROBISZ
Nie dodajesz praktyk. Nie zmieniasz ich tytułów, jednostek ani kolejności. Nie projektujesz ścieżki od nowa. Twoje jedyne narzędzia to pominięcie praktyki, obniżenie jej wartości startowej i przesunięcie pory dnia.

POMIJANIE
Pomijasz praktykę wtedy i tylko wtedy, gdy użytkownik już to robi — na liście nawyków jest coś o tym samym sensie. Nie pomijasz praktyki dlatego, że wygląda na trudną.
Nie wolno pominąć więcej niż połowy praktyk jednego etapu. Ścieżka, z której zniknęła połowa, przestaje być tą ścieżką.

OBNIŻANIE
Wartość startowa po dopasowaniu nigdy nie jest większa niż w definicji. Dopasowanie schodzi wyłącznie w dół.
Obniżasz wtedy, gdy pierwszy etap nie mieści się w limicie minut, który dostajesz. Limit jest granicą, nie celem.

WARIANT LEKKI
Ustaw lite na true, gdy pełna wersja nie mieści się w oknie użytkownika nawet po obniżeniu wartości. Werdykt bramki budżetowej dostajesz w kontekście — nie kłóć się z nim.

ZDANIE
Pole note to jedno zdanie po polsku, najwyżej ${MAX_NOTE_LENGTH} znaków, bez wykrzykników, bez zachęty i bez powitania. Mówi, co zostało dopasowane i dlaczego.
Gdy nic nie zmieniasz, zostaw note pusty.

JĘZYK
Odpowiadasz po polsku, prostymi zdaniami. Zwracasz się do użytkownika na "ty".`;

export type FitPromptPractice = {
  id: string;
  stageOrdinal: number;
  title: string;
  unit: string;
  startValue: number;
  timeOfDay: string | null;
  isOptional: boolean;
};

export type FitPromptInput = {
  pathTitle: string;
  stages: readonly { ordinal: number; name: string; dailyMinutesP50: number }[];
  practices: readonly FitPromptPractice[];
  habits: readonly ContextHabit[];
  allocatedMinutes: number;
  verdict: FitVerdict;
};

const VERDICT_LABELS: Record<FitVerdict, string> = {
  fits: 'mieści się w oknie z zapasem',
  tight: 'mieści się, ale zajmie prawie całe okno',
  lite: 'nie mieści się w pełnej wersji — potrzebny wariant lekki',
  blocked: 'nie mieści się w żadnej wersji',
};

export function buildUserPrompt(input: FitPromptInput, retryReason = ''): string {
  const stages = input.stages
    .map(
      (stage) =>
        `  etap ${stage.ordinal} — ${stage.name}, ${stage.dailyMinutesP50} minut dziennie`,
    )
    .join('\n');

  const practices = input.practices
    .map(
      (practice) =>
        `  ${practice.id} | etap ${practice.stageOrdinal} | ${practice.title} | ` +
        `start ${practice.startValue} ${practice.unit} | ` +
        `${practice.timeOfDay ?? 'bez pory'} | ` +
        `${practice.isOptional ? 'wyłączalna' : 'obowiązkowa'}`,
    )
    .join('\n');

  const habits =
    input.habits.length === 0
      ? '  brak, użytkownik zaczyna od zera'
      : input.habits.map((habit) => `  ${habit.title} (${habit.unit})`).join('\n');

  const lines = [
    `Ścieżka: ${input.pathTitle}`,
    'Etapy:',
    stages,
    'Praktyki (identyfikator | etap | tytuł | start | pora | rodzaj):',
    practices,
    'Nawyki, które użytkownik już prowadzi:',
    habits,
    `Okno użytkownika: ${input.allocatedMinutes} minut dziennie`,
    `Twardy limit pierwszego etapu: ${budgetCeiling(input.allocatedMinutes)} minut`,
    `Werdykt bramki budżetowej: ${VERDICT_LABELS[input.verdict]}`,
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
