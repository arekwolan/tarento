import { BOOK_LAB_MAX_NOTES, BOOK_LAB_MAX_STAGES, BOOK_LAB_MIN_NOTES } from './schema.ts';

export type BookLabStatus = 'ok' | 'out_of_scope' | 'unsafe';
export type BookLabTimeOfDay = 'morning' | 'afternoon' | 'evening';
export type BookLabCategory =
  'mindfulness' | 'health' | 'focus' | 'learning' | 'relationships';
export type BookLabScheduleType = 'daily' | 'weekdays' | 'custom';

export type BookLabNoteInput = {
  ordinal: number;
  content: string;
  sourceLocator: string | null;
};

export type BookLabRequestInput = {
  requestId: string;
  sourceTitle: string;
  sourceAuthor: string;
  desiredChange: string;
  locale: 'pl' | 'en';
  basePathId: string | null;
  notes: BookLabNoteInput[];
};

export type BookLabDraft = {
  title: string;
  summary: string;
  stages: BookLabDraftStage[];
};

export type BookLabDraftStage = {
  ordinal: number;
  name: string;
  description: string;
  dailyMinutes: number;
  practice: {
    title: string;
    why: string;
    how: string;
    whenHard: string;
    scheduleType: BookLabScheduleType;
    scheduleDays: number[];
    timeOfDay: BookLabTimeOfDay;
    category: BookLabCategory;
    noteOrdinals: number[];
  };
  environmentSetup: { text: string; noteOrdinals: number[] } | null;
  transition: {
    criterion: string;
    minDays: number;
    maxDays: number;
    completionThreshold: number;
    noteOrdinals: number[];
  };
};

export type BookLabModelResult = {
  status: BookLabStatus;
  draft: BookLabDraft | null;
};

export type BookLabValidationContext = {
  safeMinutes: number;
  noteOrdinals: readonly number[];
  noteTexts: readonly string[];
};

export type BookLabValidationFailure = {
  rule: 'schema' | 'budget' | 'note_reference' | 'unsafe' | 'source_overlap';
  message: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UNSAFE_OUTPUT =
  /(?:diagnoz|lecz|terapi|lek(?:i|ów|ami)?\b|suplement|inwest|kredyt|ubezpiec|podat|zrezygnuj ze snu|ogranicz sen|pomiń odpoczynek|obejdź limit|ignore (?:the )?limit|skip sleep|financial advice)/iu;
const MAX_SOURCE_PHRASE_WORDS = 11;

function words(value: string): string[] {
  return value
    .toLocaleLowerCase('pl-PL')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function hasLongSourceOverlap(output: string, notes: readonly string[]): boolean {
  const normalizedOutput = words(output).join(' ');
  const phraseLength = MAX_SOURCE_PHRASE_WORDS + 1;

  return notes.some((note) => {
    const noteWords = words(note);
    for (let index = 0; index <= noteWords.length - phraseLength; index += 1) {
      if (
        normalizedOutput.includes(noteWords.slice(index, index + phraseLength).join(' '))
      ) {
        return true;
      }
    }
    return false;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= max ? clean : null;
}

function cleanNullableString(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return cleanString(value, max) ?? undefined;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function readNoteOrdinals(value: unknown, allowed: ReadonlySet<number>): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > BOOK_LAB_MAX_NOTES) {
    return null;
  }

  const unique = new Set<number>();
  for (const entry of value) {
    if (!Number.isInteger(entry) || !allowed.has(entry as number)) return null;
    unique.add(entry as number);
  }
  return [...unique];
}

export function parseBookLabRequest(value: unknown): BookLabRequestInput | null {
  if (!isRecord(value)) return null;
  if (
    !hasOnlyKeys(value, [
      'request_id',
      'source_title',
      'source_author',
      'desired_change',
      'locale',
      'base_path_id',
      'notes',
    ])
  ) {
    return null;
  }

  const sourceTitle = cleanString(value.source_title, 160);
  const sourceAuthor = cleanString(value.source_author, 120);
  const desiredChange = cleanString(value.desired_change, 240);
  const locale = value.locale === 'en' ? 'en' : value.locale === 'pl' ? 'pl' : null;
  const basePathId = value.base_path_id === null ? null : value.base_path_id;

  if (
    !isUuid(value.request_id) ||
    sourceTitle === null ||
    sourceAuthor === null ||
    desiredChange === null ||
    locale === null ||
    (basePathId !== null && !isUuid(basePathId)) ||
    !Array.isArray(value.notes) ||
    value.notes.length < BOOK_LAB_MIN_NOTES ||
    value.notes.length > BOOK_LAB_MAX_NOTES
  ) {
    return null;
  }

  const notes: BookLabNoteInput[] = [];
  let totalLength = 0;
  for (const [index, raw] of value.notes.entries()) {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ['ordinal', 'content', 'source_locator'])) {
      return null;
    }
    const content = cleanString(raw.content, 500);
    const sourceLocator = cleanNullableString(raw.source_locator, 80);
    if (raw.ordinal !== index + 1 || content === null || sourceLocator === undefined) {
      return null;
    }
    totalLength += content.length;
    notes.push({ ordinal: index + 1, content, sourceLocator });
  }

  if (totalLength > 2_800) return null;

  return {
    requestId: value.request_id,
    sourceTitle,
    sourceAuthor,
    desiredChange,
    locale,
    basePathId,
    notes,
  };
}

function readDraft(
  value: Record<string, unknown>,
  context: BookLabValidationContext,
): BookLabDraft | BookLabValidationFailure {
  if (!hasOnlyKeys(value, ['title', 'summary', 'stages'])) {
    return { rule: 'schema', message: 'Draft zawiera nieznane pola.' };
  }
  const title = cleanString(value.title, 120);
  const summary = cleanString(value.summary, 240);
  if (
    title === null ||
    summary === null ||
    !Array.isArray(value.stages) ||
    value.stages.length < 1 ||
    value.stages.length > BOOK_LAB_MAX_STAGES
  ) {
    return { rule: 'schema', message: 'Draft wymaga tytułu, opisu i 1–3 etapów.' };
  }

  const allowedNotes = new Set(context.noteOrdinals);
  const stages: BookLabDraftStage[] = [];
  const outputText = [title, summary];

  for (const [index, rawStage] of value.stages.entries()) {
    if (
      !isRecord(rawStage) ||
      !isRecord(rawStage.practice) ||
      !isRecord(rawStage.transition)
    ) {
      return { rule: 'schema', message: `Etap ${index + 1} nie ma wymaganych pól.` };
    }

    const practice = rawStage.practice;
    const transition = rawStage.transition;
    if (
      !hasOnlyKeys(rawStage, [
        'ordinal',
        'name',
        'description',
        'dailyMinutes',
        'practice',
        'environmentSetup',
        'transition',
      ]) ||
      !hasOnlyKeys(practice, [
        'title',
        'why',
        'how',
        'whenHard',
        'scheduleType',
        'scheduleDays',
        'timeOfDay',
        'category',
        'noteOrdinals',
      ]) ||
      !hasOnlyKeys(transition, [
        'criterion',
        'minDays',
        'maxDays',
        'completionThreshold',
        'noteOrdinals',
      ])
    ) {
      return { rule: 'schema', message: `Etap ${index + 1} zawiera nieznane pola.` };
    }
    const ordinal = index + 1;
    const name = cleanString(rawStage.name, 80);
    const description = cleanString(rawStage.description, 240);
    const dailyMinutes = rawStage.dailyMinutes;
    const practiceTitle = cleanString(practice.title, 80);
    const why = cleanString(practice.why, 240);
    const how = cleanString(practice.how, 240);
    const whenHard = cleanString(practice.whenHard, 180);
    const timeOfDay = practice.timeOfDay;
    const category = practice.category;
    const scheduleType = practice.scheduleType;
    const scheduleDays = practice.scheduleDays;
    const practiceRefs = readNoteOrdinals(practice.noteOrdinals, allowedNotes);
    const criterion = cleanString(transition.criterion, 240);
    const minDays = transition.minDays;
    const maxDays = transition.maxDays;
    const completionThreshold = transition.completionThreshold;
    const transitionRefs = readNoteOrdinals(transition.noteOrdinals, allowedNotes);

    if (
      rawStage.ordinal !== ordinal ||
      name === null ||
      description === null ||
      !Number.isInteger(dailyMinutes) ||
      (dailyMinutes as number) < 1 ||
      (dailyMinutes as number) > 45 ||
      practiceTitle === null ||
      why === null ||
      how === null ||
      whenHard === null ||
      !['morning', 'afternoon', 'evening'].includes(String(timeOfDay)) ||
      !['mindfulness', 'health', 'focus', 'learning', 'relationships'].includes(
        String(category),
      ) ||
      !['daily', 'weekdays', 'custom'].includes(String(scheduleType)) ||
      !Array.isArray(scheduleDays) ||
      practiceRefs === null ||
      criterion === null ||
      !Number.isInteger(minDays) ||
      !Number.isInteger(maxDays) ||
      (minDays as number) < 1 ||
      (minDays as number) > 30 ||
      (maxDays as number) < (minDays as number) ||
      (maxDays as number) > 60 ||
      typeof completionThreshold !== 'number' ||
      !Number.isFinite(completionThreshold) ||
      completionThreshold < 0 ||
      completionThreshold > 1 ||
      transitionRefs === null
    ) {
      return { rule: 'schema', message: `Etap ${ordinal} narusza schemat.` };
    }

    const uniqueDays = [...new Set(scheduleDays)];
    if (
      uniqueDays.some(
        (day) => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6,
      ) ||
      (scheduleType === 'custom' && uniqueDays.length < 1) ||
      (scheduleType !== 'custom' && uniqueDays.length > 0)
    ) {
      return { rule: 'schema', message: `Etap ${ordinal} ma zły harmonogram.` };
    }

    if ((dailyMinutes as number) > context.safeMinutes) {
      return {
        rule: 'budget',
        message:
          `Etap ${ordinal} kosztuje ${dailyMinutes} minut, a bezpieczny limit ` +
          `to ${context.safeMinutes}. Skróć praktykę.`,
      };
    }

    let environmentSetup: BookLabDraftStage['environmentSetup'] = null;
    if (rawStage.environmentSetup !== null) {
      if (!isRecord(rawStage.environmentSetup)) {
        return { rule: 'schema', message: `Etap ${ordinal} ma błędne przygotowanie.` };
      }
      if (!hasOnlyKeys(rawStage.environmentSetup, ['text', 'noteOrdinals'])) {
        return {
          rule: 'schema',
          message: `Przygotowanie etapu ${ordinal} zawiera nieznane pola.`,
        };
      }
      const setupText = cleanString(rawStage.environmentSetup.text, 240);
      const setupRefs = readNoteOrdinals(
        rawStage.environmentSetup.noteOrdinals,
        allowedNotes,
      );
      if (setupText === null || setupRefs === null) {
        return {
          rule: 'note_reference',
          message: `Przygotowanie etapu ${ordinal} nie wskazuje notatki.`,
        };
      }
      environmentSetup = { text: setupText, noteOrdinals: setupRefs };
      outputText.push(setupText);
    }

    outputText.push(name, description, practiceTitle, why, how, whenHard, criterion);
    stages.push({
      ordinal,
      name,
      description,
      dailyMinutes: dailyMinutes as number,
      practice: {
        title: practiceTitle,
        why,
        how,
        whenHard,
        scheduleType: scheduleType as BookLabScheduleType,
        scheduleDays: uniqueDays as number[],
        timeOfDay: timeOfDay as BookLabTimeOfDay,
        category: category as BookLabCategory,
        noteOrdinals: practiceRefs,
      },
      environmentSetup,
      transition: {
        criterion,
        minDays: minDays as number,
        maxDays: maxDays as number,
        completionThreshold,
        noteOrdinals: transitionRefs,
      },
    });
  }

  const joinedOutput = outputText.join(' ');
  if (UNSAFE_OUTPUT.test(joinedOutput)) {
    return {
      rule: 'unsafe',
      message:
        'Odpowiedź weszła w porady specjalistyczne, sen, odpoczynek lub omijanie limitów.',
    };
  }

  if (hasLongSourceOverlap(joinedOutput, context.noteTexts)) {
    return {
      rule: 'source_overlap',
      message: 'Odpowiedź powtarza zbyt długi fragment notatki zamiast go opracować.',
    };
  }

  return { title, summary, stages };
}

export function validateBookLabModelResult(
  value: unknown,
  context: BookLabValidationContext,
): BookLabModelResult | BookLabValidationFailure {
  if (!isRecord(value))
    return { rule: 'schema', message: 'Odpowiedź nie jest obiektem.' };
  if (!hasOnlyKeys(value, ['status', 'title', 'summary', 'stages'])) {
    return { rule: 'schema', message: 'Odpowiedź zawiera nieznane pola.' };
  }
  const status = value.status;
  if (status !== 'ok' && status !== 'out_of_scope' && status !== 'unsafe') {
    return { rule: 'schema', message: 'Odpowiedź ma nieznany status.' };
  }

  if (status !== 'ok') {
    if (
      value.title !== '' ||
      value.summary !== '' ||
      !Array.isArray(value.stages) ||
      value.stages.length !== 0
    ) {
      return {
        rule: 'schema',
        message: 'Odpowiedź bezpieczeństwa nie może zawierać draftu.',
      };
    }
    return { status, draft: null };
  }

  const draft = readDraft(
    { title: value.title, summary: value.summary, stages: value.stages },
    context,
  );
  if ('rule' in draft) return draft;
  return { status, draft };
}
