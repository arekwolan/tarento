import { normalizeTitle, levenshtein } from './text.ts';

/**
 * Mechanika przeciw absurdom.
 *
 * Model nigdy nie dostaje pustej kartki i nigdy nie dostaje ostatniego słowa:
 * między jego odpowiedzią a ekranem stoi ten plik. Odrzucenie nie jest błędem
 * dla użytkownika — jest sygnałem, żeby spróbować raz jeszcze, a potem podać
 * wariant deterministyczny.
 *
 * Wspólny moduł dla wszystkich funkcji brzegowych: podpowiedź z intencji,
 * zmniejszenie nawyku i dopasowanie ścieżki mają być ograniczone tak samo.
 * Rozjazd progów między funkcjami znaczyłby, że jedna droga do bazy jest
 * luźniejsza od pozostałych.
 */

export type ProposalUnit = 'minutes' | 'seconds' | 'reps' | 'pages' | 'count' | 'none';

/** Tyle, ile wystarcza każdej regule. Pełny PlanItem też pasuje. */
export type ProposalItem = {
  title: string;
  unit: ProposalUnit;
  start_value: number;
  increment_value: number;
};

export type ProposalContext = {
  /**
   * Okno użytkownika w minutach. Gdy nie ma jeszcze kształtu dnia, wołający
   * podaje DEFAULT_WINDOW_MINUTES — pusta kartka nie istnieje także tutaj.
   */
  allocatedMinutes: number;
  /** Tytuły niezarchiwizowanych nawyków użytkownika. */
  existingTitles: readonly string[];
};

export type ProposalRule =
  'budget' | 'item_length' | 'start_value' | 'duplicate' | 'increment';

/** `message` wraca do modelu w powtórce, nie na ekran użytkownika. */
export type ProposalViolation = { rule: ProposalRule; message: string };

/**
 * Okno przyjmowane, gdy użytkownik nie przeszedł jeszcze kroku „kształt dnia".
 *
 * Nie Infinity: brak deklaracji nie jest zgodą na godzinę dziennie, a wariant
 * deterministyczny (10 minut) ma się w tym mieścić z zapasem.
 */
export const DEFAULT_WINDOW_MINUTES = 30;

/** Żadna pojedyncza pozycja nie ma prawa zająć więcej. */
export const MAX_ITEM_MINUTES = 45;

/**
 * Górne granice wartości startowej per jednostka.
 *
 * `none` nie ma jednostki, więc jedyna sensowna wartość to 1 — „zrobione albo
 * nie". Bez tego wpisu model mógłby oddać „start 500" z jednostką none
 * i przeszłoby to wszystkie pozostałe reguły, bo ryczałt minutowy tego nie widzi.
 */
export const START_VALUE_LIMITS: Record<ProposalUnit, number> = {
  minutes: 20,
  seconds: 120,
  reps: 20,
  pages: 15,
  count: 5,
  none: 1,
};

/** Przyrost dzienny najwyżej jedna piąta startu. */
export const MAX_INCREMENT_RATIO = 0.2;

/** Poniżej tej odległości edycyjnej tytuły uznajemy za ten sam nawyk. */
export const DUPLICATE_DISTANCE = 3;

/**
 * Ryczałt minutowy dla pozycji bez jednostki czasu.
 * Ta sama liczba co FLAT_ESTIMATE_MINUTES w src/features/habits/model/today-task.ts.
 */
const FLAT_ESTIMATE_MINUTES = 3;

/**
 * Sufit propozycji: 60% okna. Pozostałe 40% nie jest nieprzydzielone, tylko
 * chronione (IDEAS.md §H). Współczynnik ma po stronie funkcji brzegowych
 * dokładnie jedno miejsce — tutaj.
 */
export const SAFE_BUDGET_RATIO = 0.6;

export function budgetCeiling(allocatedMinutes: number): number {
  return Math.floor(Math.max(0, allocatedMinutes) * SAFE_BUDGET_RATIO);
}

/** Szacowany koszt pozycji w minutach, liczony z wartości na pierwszy dzień. */
export function itemMinutes(item: ProposalItem): number {
  switch (item.unit) {
    case 'minutes':
      return Math.max(0, item.start_value);
    case 'seconds':
      return Math.max(0, item.start_value / 60);
    default:
      return FLAT_ESTIMATE_MINUTES;
  }
}

/** Czy tytuł powtarza nawyk, który użytkownik już prowadzi. */
export function isDuplicateTitle(
  title: string,
  existingTitles: readonly string[],
): boolean {
  const candidate = normalizeTitle(title);
  if (candidate === '') return false;

  return existingTitles.some(
    (existing) => levenshtein(candidate, normalizeTitle(existing)) < DUPLICATE_DISTANCE,
  );
}

/**
 * Pierwsza naruszona reguła albo `null`, gdy propozycja przechodzi.
 *
 * Pierwsza, nie wszystkie: powtórka niesie modelowi jeden konkretny zarzut,
 * a lista zarzutów zwykle kończy się tym, że poprawia losowy z nich.
 */
export function validateProposal(
  items: readonly ProposalItem[],
  context: ProposalContext,
): ProposalViolation | null {
  const ceiling = budgetCeiling(context.allocatedMinutes);
  const total = items.reduce((sum, item) => sum + itemMinutes(item), 0);

  if (total > ceiling) {
    return {
      rule: 'budget',
      message:
        `Suma czasu propozycji to ${Math.round(total)} minut, a limit wynosi ` +
        `${ceiling} minut. Zaproponuj mniej albo krócej.`,
    };
  }

  for (const item of items) {
    if (itemMinutes(item) > MAX_ITEM_MINUTES) {
      return {
        rule: 'item_length',
        message:
          `Pozycja „${item.title}" zajmuje więcej niż ${MAX_ITEM_MINUTES} minut. ` +
          'Żadna pojedyncza pozycja nie ma prawa tyle trwać.',
      };
    }

    const limit = START_VALUE_LIMITS[item.unit];
    if (item.start_value > limit) {
      return {
        rule: 'start_value',
        message:
          `Pozycja „${item.title}" startuje od ${item.start_value} ${item.unit}, ` +
          `a maksimum dla tej jednostki to ${limit}.`,
      };
    }

    if (item.increment_value > item.start_value * MAX_INCREMENT_RATIO) {
      return {
        rule: 'increment',
        message:
          `Pozycja „${item.title}" rośnie o ${item.increment_value} dziennie, ` +
          `a przyrost nie może przekroczyć jednej piątej wartości startowej.`,
      };
    }

    if (isDuplicateTitle(item.title, context.existingTitles)) {
      return {
        rule: 'duplicate',
        message:
          `Pozycja „${item.title}" powtarza nawyk, który użytkownik już prowadzi. ` +
          'Zaproponuj coś innego.',
      };
    }
  }

  return null;
}

// Zmniejszenie nawyku ---------------------------------------------------------

/** Wymiary, na których nawyk może się skurczyć. */
export type DownshiftCandidate = {
  unit: ProposalUnit;
  start_value: number;
  increment_value: number;
  /** Ile dni w tygodniu nawyk wypada. */
  days_per_week: number;
};

/**
 * Reguła, bez której cała funkcja zmniejszania jest szkodliwa: propozycja musi
 * być mniejsza od oryginału na co najmniej jednym wymiarze i nie może być
 * większa na żadnym.
 *
 * Zmiana jednostki też jest odrzuceniem, a nie osobnym przypadkiem: „30 minut"
 * i „120 sekund" nie da się porównać bez zgadywania, a zgadywanie jest tym,
 * czego ta reguła ma nie dopuścić.
 */
export function validateDownshift(
  original: DownshiftCandidate,
  proposal: DownshiftCandidate,
): ProposalViolation | null {
  if (proposal.unit !== original.unit) {
    return {
      rule: 'not_smaller',
      message:
        `Propozycja zmienia jednostkę z ${original.unit} na ${proposal.unit}. ` +
        'Zmniejszenie nawyku nie zmienia jednostki.',
    };
  }

  const dimensions = [
    ['wartość startowa', original.start_value, proposal.start_value],
    ['przyrost', original.increment_value, proposal.increment_value],
    ['liczba dni w tygodniu', original.days_per_week, proposal.days_per_week],
  ] as const;

  for (const [name, before, after] of dimensions) {
    if (after > before) {
      return {
        rule: 'not_smaller',
        message: `Propozycja zwiększa ${name} z ${before} na ${after}. Ma zmniejszać.`,
      };
    }
  }

  const isSmaller = dimensions.some(([, before, after]) => after < before);

  if (!isSmaller) {
    return {
      rule: 'not_smaller',
      message:
        'Propozycja jest identyczna z oryginałem. Zmniejsz ją na co najmniej ' +
        'jednym wymiarze: wartość startowa, przyrost albo liczba dni w tygodniu.',
    };
  }

  return null;
}

// Dopasowanie ścieżki ---------------------------------------------------------

/** Maksymalna długość zdania pokazywanego raz przy zapisie. */
export const MAX_NOTE_LENGTH = 160;

export type FitPractice = {
  id: string;
  stageId: string;
  /** Wartość startowa z definicji ścieżki. Dopasowanie schodzi tylko w dół. */
  startValue: number;
};

export type FitStage = {
  id: string;
  /** Kolejność etapu; 1 to ten, od którego zaczyna użytkownik. */
  ordinal: number;
  dailyMinutesP50: number;
};

export type FitContext = {
  allocatedMinutes: number;
  stages: readonly FitStage[];
  practices: readonly FitPractice[];
};

export type FitCandidate = {
  skip: readonly string[];
  adjust: readonly { practiceId: string; startValue: number }[];
  note: string;
};

/**
 * Reguły specyficzne dla dopasowania ścieżki.
 *
 * Sufit budżetu bierze się ze wspólnego `budgetCeiling` — 0.6 ma w kodzie
 * funkcji brzegowych dokładnie jedno miejsce i dopasowanie nie jest od tego
 * wyjątkiem.
 */
export function validatePathFit(
  fit: FitCandidate,
  context: FitContext,
): ProposalViolation | null {
  if (fit.note.length > MAX_NOTE_LENGTH) {
    return {
      rule: 'fit_note',
      message:
        `Zdanie ma ${fit.note.length} znaków, a limit to ${MAX_NOTE_LENGTH}. ` +
        'Skróć je do jednego zdania.',
    };
  }

  if (fit.note.includes('!')) {
    return {
      rule: 'fit_note',
      message: 'Zdanie zawiera wykrzyknik. Pisz spokojnie, bez entuzjazmu.',
    };
  }

  const skipped = new Set(fit.skip);

  for (const stage of context.stages) {
    const practices = context.practices.filter(
      (practice) => practice.stageId === stage.id,
    );
    if (practices.length === 0) continue;

    const skippedHere = practices.filter((practice) => skipped.has(practice.id)).length;

    if (skippedHere * 2 > practices.length) {
      return {
        rule: 'fit_skip',
        message:
          `Pomijasz ${skippedHere} z ${practices.length} praktyk etapu ` +
          `${stage.ordinal}. Nie wolno pominąć więcej niż połowy etapu.`,
      };
    }
  }

  for (const entry of fit.adjust) {
    const practice = context.practices.find(
      (candidate) => candidate.id === entry.practiceId,
    );

    if (practice === undefined) {
      return {
        rule: 'fit_adjust',
        message: `Dopasowanie wskazuje praktykę ${entry.practiceId}, której nie ma w tej ścieżce.`,
      };
    }

    if (entry.startValue > practice.startValue) {
      return {
        rule: 'fit_adjust',
        message:
          `Dopasowanie podnosi wartość startową z ${practice.startValue} na ` +
          `${entry.startValue}. Dopasowanie schodzi wyłącznie w dół.`,
      };
    }

    if (entry.startValue <= 0) {
      return {
        rule: 'fit_adjust',
        message: 'Wartość startowa po dopasowaniu musi być większa od zera.',
      };
    }
  }

  const firstStage = context.stages.find((stage) => stage.ordinal === 1);
  if (firstStage === undefined) return null;

  const practices = context.practices.filter(
    (practice) => practice.stageId === firstStage.id,
  );
  const kept = practices.filter((practice) => !skipped.has(practice.id)).length;

  // Etap deklaruje minuty jako całość, więc pominięcia skalują je udziałem
  // praktyk, które zostają. To najuczciwsze przybliżenie, jakie da się zrobić
  // bez rozbijania deklaracji autora na pojedyncze praktyki.
  const minutes =
    practices.length === 0
      ? firstStage.dailyMinutesP50
      : (firstStage.dailyMinutesP50 * kept) / practices.length;

  const ceiling = budgetCeiling(context.allocatedMinutes);

  if (minutes > ceiling) {
    return {
      rule: 'fit_budget',
      message:
        `Pierwszy etap po dopasowaniu zajmuje ${Math.round(minutes)} minut, ` +
        `a limit wynosi ${ceiling}. Pomiń praktykę albo zejdź z wartościami.`,
    };
  }

  return null;
}
