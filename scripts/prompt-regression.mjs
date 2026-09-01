/**
 * Zestaw regresyjny promptów.
 *
 * To jest jedyna rzecz, która oddziela funkcję AI od zobowiązania AI: dwadzieścia
 * zamrożonych stanów użytkownika i sprawdzenie, że dla każdego z nich walidator
 * przechodzi. Bez tego zmiana jednego zdania w promptcie jest zmianą, której
 * skutków nikt nie widzi aż do zgłoszenia użytkownika.
 *
 * Prompty, schematy i walidatory importujemy wprost z kodu funkcji brzegowych —
 * kopia promptu w skrypcie testowałaby kopię, a nie produkcję. Node od wersji 22
 * czyta pliki .ts po zdjęciu typów, więc nie ma tu ani kroku budowania, ani
 * drugiej implementacji reguł.
 *
 * Klucz modelu bierzemy wyłącznie ze zmiennej środowiskowej procesu. Nigdy
 * z pliku w repozytorium (CLAUDE.md, reguła krytyczna 1).
 *
 * Użycie:
 *   npm run prompt:test
 *   npm run prompt:test -- --dry-run           bez wywołań modelu
 *   npm run prompt:test -- --kind=intent       jeden rodzaj wywołania
 *   npm run prompt:test -- --fixture=12        jeden stan użytkownika
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { REPO_ROOT } from './lib/run.mjs';
import { blank, color, fail, info, note, statusTable, title } from './lib/ui.mjs';

const FUNCTIONS = path.join(REPO_ROOT, 'supabase', 'functions');
const FIXTURE_DIR = path.join(FUNCTIONS, '__fixtures__', 'users');

const planPrompt = await import('../supabase/functions/generate-daily-plan/prompt.ts');
const planSchema = await import('../supabase/functions/generate-daily-plan/schema.ts');
const intentPrompt = await import('../supabase/functions/suggest-habit/prompt.ts');
const intentSchema = await import('../supabase/functions/suggest-habit/schema.ts');
const downPrompt = await import('../supabase/functions/suggest-downshift/prompt.ts');
const downSchema = await import('../supabase/functions/suggest-downshift/schema.ts');
const fitPrompt = await import('../supabase/functions/suggest-path-fit/prompt.ts');
const fitSchema = await import('../supabase/functions/suggest-path-fit/schema.ts');
const bookPrompt = await import('../supabase/functions/book-lab/prompt.ts');
const bookSchema = await import('../supabase/functions/book-lab/schema.ts');
const bookValidator = await import('../supabase/functions/book-lab/validator.ts');
const validate = await import('../supabase/functions/_shared/validate-proposal.ts');
const pathFit = await import('../supabase/functions/_shared/path-fit.ts');
const planItem = await import('../supabase/functions/_shared/plan-item.ts');
const schedule = await import('../supabase/functions/_shared/schedule.ts');

const KINDS = ['plan', 'intent', 'downshift', 'path-fit', 'book-lab'];
const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Nawyk, na którym testujemy zmniejszanie.
 *
 * Stały dla całego zestawu: zmienną jest użytkownik, a nie nawyk. Dwadzieścia
 * różnych nawyków dałoby dwadzieścia niezależnych zmiennych i żadnej regresji
 * nie dałoby się przypisać do przyczyny.
 */
const DOWNSHIFT_HABIT = {
  title: 'Medytacja',
  unit: 'minutes',
  startValue: 20,
  incrementValue: 1,
  scheduleType: 'daily',
  scheduleDays: null,
  timeOfDay: 'morning',
};

/**
 * Ścieżka, na której testujemy dopasowanie.
 *
 * Pierwszy etap zawiera „Czytanie" celowo — bez tego przypadek użytkownika
 * z nakładającym się nawykiem nie miałby czego pominąć.
 */
const FIT_PATH = {
  title: 'Z chaosu do porządku',
  stages: [
    { id: 'stage-1', ordinal: 1, name: 'Porządek', dailyMinutesP50: 22 },
    { id: 'stage-2', ordinal: 2, name: 'Rytm', dailyMinutesP50: 35 },
  ],
  practices: [
    {
      id: 'p1',
      stageId: 'stage-1',
      stageOrdinal: 1,
      title: 'Jedno miejsce',
      unit: 'minutes',
      startValue: 10,
      timeOfDay: 'evening',
      isOptional: false,
    },
    {
      id: 'p2',
      stageId: 'stage-1',
      stageOrdinal: 1,
      title: 'Czytanie',
      unit: 'pages',
      startValue: 5,
      timeOfDay: 'evening',
      isOptional: false,
    },
    {
      id: 'p3',
      stageId: 'stage-1',
      stageOrdinal: 1,
      title: 'Zimna woda',
      unit: 'seconds',
      startValue: 30,
      timeOfDay: 'morning',
      isOptional: true,
    },
    {
      id: 'p4',
      stageId: 'stage-2',
      stageOrdinal: 2,
      title: 'Jedno zdanie',
      unit: 'none',
      startValue: 1,
      timeOfDay: 'evening',
      isOptional: false,
    },
  ],
};

/**
 * Obszar zdrowotny w treści propozycji.
 *
 * Granice słów, nie sam podciąg: „lek" trafiłby w „lekki", a „post" w „postawę".
 * Fałszywy alarm w zestawie regresyjnym jest gorszy niż jego brak, bo uczy
 * ignorowania czerwonych wierszy.
 */
const HEALTH_PATTERN =
  /(?:^|[^\p{L}])(kalori\p{L}*|dieta|diety|dietę|odchudza\p{L}*|schudn\p{L}*|tłuszcz\p{L}*|białk\p{L}*|suplement\p{L}*|lekarstw\p{L}*|antydepres\p{L}*|terapi\p{L}*|terapeut\p{L}*|psychiatr\p{L}*|depresj\p{L}*|głodówk\p{L}*)(?:[^\p{L}]|$)/iu;

// Wejście ---------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { dryRun: false, kind: null, fixture: null };

  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg.startsWith('--kind=')) flags.kind = arg.slice('--kind='.length);
    else if (arg.startsWith('--fixture=')) flags.fixture = arg.slice('--fixture='.length);
  }

  return flags;
}

function loadFixtures() {
  const files = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  return files.map((file) => {
    const raw = JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), 'utf8'));

    return { file, ...raw };
  });
}

/** Kontekst walidatora złożony ze stanu użytkownika. */
function contextOf(fixture) {
  return {
    allocatedMinutes: fixture.hasWindow
      ? fixture.allocatedMinutes
      : validate.DEFAULT_WINDOW_MINUTES,
    existingTitles: fixture.habits.map((habit) => habit.title),
  };
}

/**
 * Wykonanie po dniach tygodnia, wyliczone z fixture'u.
 *
 * Deterministycznie: dzień pusty wypada z rachunku, a z pozostałych wychodzi
 * jeden dzień na trzy. To wystarczy, żeby prompt dostał realny kształt danych
 * i żeby dwa uruchomienia zestawu widziały to samo.
 */
function weekdayHistory(fixture) {
  const rest = new Set(fixture.restWeekdays ?? []);

  return [0, 1, 2, 3, 4, 5, 6]
    .filter((dow) => !rest.has(dow))
    .map((dow) => ({ dow, scheduled: 2, completed: dow % 3 === 0 ? 1 : 0 }));
}

// Model -----------------------------------------------------------------------

function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

  return apiKey === '' ? null : { apiKey, model };
}

async function callModel(config, systemPrompt, userPrompt, responseSchema) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini odpowiedziało ${response.status}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return JSON.parse(text);
}

// Sprawdzenia -----------------------------------------------------------------

const pass = () => ({ ok: true, detail: '' });
const bad = (detail) => ({ ok: false, detail });

/** Czy w treści propozycji pojawia się obszar zdrowotny. */
function healthLeak(items) {
  return items.some(
    (item) =>
      item.category === 'health' ||
      HEALTH_PATTERN.test(String(item.title ?? '')) ||
      HEALTH_PATTERN.test(String(item.rationale ?? '')),
  );
}

async function checkPlan(fixture, config) {
  const input = {
    goal: fixture.intent === '' ? 'chcę zacząć od czegoś małego' : fixture.intent,
    availableMinutes: fixture.hasWindow
      ? fixture.allocatedMinutes
      : validate.DEFAULT_WINDOW_MINUTES,
    timeOfDay: 'evening',
    preferences: '',
    existingHabits: fixture.habits.map((habit) => habit.title),
  };

  const user = planPrompt.buildUserPrompt(input);
  if (config === null) return dryCheck(user, fixture);

  const value = await callModel(
    config,
    planPrompt.SYSTEM_PROMPT,
    user,
    planSchema.PLAN_RESPONSE_SCHEMA,
  );

  const items = (Array.isArray(value?.items) ? value.items : [])
    .map(planItem.toPlanItem)
    .filter((item) => item !== null);

  if (fixture.expect === 'out_of_scope') {
    if (items.length > 0 && healthLeak(items)) return bad('propozycja z obszaru zdrowia');
    return pass();
  }

  const violation = validate.validateProposal(items, contextOf(fixture));

  return violation === null ? pass() : bad(violation.rule);
}

async function checkIntent(fixture, config) {
  if (fixture.expect === 'invalid_input') {
    // Pusta intencja nie ma prawa dojść do modelu: funkcja odrzuca ją wcześniej.
    return fixture.intent.trim() === ''
      ? pass()
      : bad('fixture deklaruje invalid_input, ale intencja nie jest pusta');
  }

  const context = {
    allocatedMinutes: contextOf(fixture).allocatedMinutes,
    hasWindow: fixture.hasWindow,
    habits: fixture.habits,
    today: '',
  };

  const user = intentPrompt.buildUserPrompt(fixture.intent, context);
  if (config === null) return dryCheck(user, fixture);

  const value = await callModel(
    config,
    intentPrompt.SYSTEM_PROMPT,
    user,
    intentSchema.SUGGEST_RESPONSE_SCHEMA,
  );

  const status = String(value?.status ?? '');
  const candidates = (Array.isArray(value?.candidates) ? value.candidates : [])
    .map(planItem.toPlanItem)
    .filter((item) => item !== null);

  if (fixture.expect === 'out_of_scope') {
    if (status !== 'out_of_scope')
      return bad(`status ${status}, oczekiwano out_of_scope`);
    if (candidates.length > 0) return bad('out_of_scope z propozycjami');
    return pass();
  }

  if (fixture.expect === 'unclear') {
    return status === 'unclear' ? pass() : bad(`status ${status}, oczekiwano unclear`);
  }

  if (status !== 'ok') return bad(`status ${status}, oczekiwano ok`);
  if (candidates.length === 0) return bad('brak propozycji przy statusie ok');

  const violation = validate.validateProposal(candidates, contextOf(fixture));

  return violation === null ? pass() : bad(violation.rule);
}

async function checkDownshift(fixture, config) {
  const weekdays = weekdayHistory(fixture);
  const input = {
    ...DOWNSHIFT_HABIT,
    weekdays,
    completed: weekdays.reduce((sum, row) => sum + row.completed, 0),
    scheduled: weekdays.reduce((sum, row) => sum + row.scheduled, 0),
  };

  const user = downPrompt.buildUserPrompt(input);
  if (config === null) return dryCheck(user, fixture);

  const value = await callModel(
    config,
    downPrompt.SYSTEM_PROMPT,
    user,
    downSchema.DOWNSHIFT_RESPONSE_SCHEMA,
  );

  const item = planItem.toPlanItem(value);
  if (item === null) return bad('odpowiedź bez wymaganych pól');

  const scheduleType = schedule.isScheduleType(value?.schedule_type)
    ? value.schedule_type
    : DOWNSHIFT_HABIT.scheduleType;
  const scheduleDays =
    scheduleType === 'custom' ? schedule.toWeekdays(value?.schedule_days) : null;

  const proposal = { ...item, title: DOWNSHIFT_HABIT.title };
  const context = {
    allocatedMinutes: contextOf(fixture).allocatedMinutes,
    existingTitles: contextOf(fixture).existingTitles.filter(
      (habitTitle) => habitTitle !== DOWNSHIFT_HABIT.title,
    ),
  };

  const violation =
    validate.validateProposal([proposal], context) ??
    validate.validateDownshift(
      {
        unit: DOWNSHIFT_HABIT.unit,
        start_value: DOWNSHIFT_HABIT.startValue,
        increment_value: DOWNSHIFT_HABIT.incrementValue,
        days_per_week: schedule.daysPerWeek(
          DOWNSHIFT_HABIT.scheduleType,
          DOWNSHIFT_HABIT.scheduleDays,
        ),
      },
      {
        unit: proposal.unit,
        start_value: proposal.start_value,
        increment_value: proposal.increment_value,
        days_per_week: schedule.daysPerWeek(scheduleType, scheduleDays),
      },
    );

  return violation === null ? pass() : bad(violation.rule);
}

function fitContext(fixture) {
  return {
    allocatedMinutes: contextOf(fixture).allocatedMinutes,
    stages: FIT_PATH.stages.map((stage) => ({
      id: stage.id,
      ordinal: stage.ordinal,
      dailyMinutesP50: stage.dailyMinutesP50,
    })),
    practices: FIT_PATH.practices.map((practice) => ({
      id: practice.id,
      stageId: practice.stageId,
      startValue: practice.startValue,
    })),
  };
}

async function checkPathFit(fixture, config) {
  const context = fitContext(fixture);
  const { verdict } = pathFit.checkPathFit(context.stages, context.allocatedMinutes);

  const user = fitPrompt.buildUserPrompt({
    pathTitle: FIT_PATH.title,
    stages: FIT_PATH.stages,
    practices: FIT_PATH.practices,
    habits: fixture.habits,
    allocatedMinutes: context.allocatedMinutes,
    verdict,
  });

  if (config === null) return dryCheck(user, fixture);

  const value = await callModel(
    config,
    fitPrompt.SYSTEM_PROMPT,
    user,
    fitSchema.PATH_FIT_RESPONSE_SCHEMA,
  );

  const fit = pathFit.toPathFit(value);
  if (fit === null) return bad('odpowiedź bez wymaganych pól');

  const violation = validate.validatePathFit(fit, context);

  return violation === null ? pass() : bad(violation.rule);
}

function bookLabContext(fixture) {
  const allocatedMinutes = contextOf(fixture).allocatedMinutes;
  return {
    allocatedMinutes,
    usedMinutes: 0,
    freeMinutes: allocatedMinutes,
    safeMinutes: validate.budgetCeiling(allocatedMinutes),
    hasWindow: fixture.hasWindow,
    bands: {
      morning: { itemCount: 0, usedMinutes: 0 },
      afternoon: { itemCount: 0, usedMinutes: 0 },
      evening: { itemCount: fixture.habits.length, usedMinutes: 0 },
    },
    habits: fixture.habits.map(() => ({
      category: null,
      minutes: 0,
      timeOfDay: 'evening',
    })),
    activePath: { exists: false, stageMinutes: 0 },
  };
}

function bookLabNotes(fixture) {
  const subject =
    fixture.intent.trim() === '' ? 'zacząć od małego kroku' : fixture.intent;
  return [
    {
      ordinal: 1,
      content: `Chcę ${subject} przez bardzo mały krok.`,
      sourceLocator: null,
    },
    {
      ordinal: 2,
      content: 'Łatwiej mi działać, gdy potrzebne rzeczy są widoczne.',
      sourceLocator: null,
    },
    {
      ordinal: 3,
      content: 'Na trudny dzień potrzebuję wersji trwającej jedną minutę.',
      sourceLocator: null,
    },
  ];
}

function deterministicBookLabDraft(safeMinutes) {
  return {
    status: 'ok',
    title: 'Mały krok',
    summary: 'Jedna krótka praktyka oparta na notatkach.',
    stages: [
      {
        ordinal: 1,
        name: 'Start',
        description: 'Wykonaj najmniejszy widoczny krok.',
        dailyMinutes: Math.max(1, Math.min(5, safeMinutes)),
        practice: {
          title: 'Pierwszy krok',
          why: 'Zmniejsza próg rozpoczęcia.',
          how: 'Wykonaj jeden wcześniej wybrany krok.',
          whenHard: 'Poświęć na niego jedną minutę.',
          scheduleType: 'daily',
          scheduleDays: [],
          timeOfDay: 'evening',
          category: 'focus',
          noteOrdinals: [1, 3],
        },
        environmentSetup: {
          text: 'Połóż potrzebny przedmiot w widocznym miejscu.',
          noteOrdinals: [2],
        },
        transition: {
          criterion: 'Przejdź dalej po tygodniu regularnych prób.',
          minDays: 7,
          maxDays: 14,
          completionThreshold: 0.6,
          noteOrdinals: [1],
        },
      },
    ],
  };
}

async function checkBookLab(fixture, config) {
  const context = bookLabContext(fixture);
  const notes = bookLabNotes(fixture);
  const desiredChange =
    fixture.intent.trim() === ''
      ? 'Chcę zaczynać od jednego małego kroku.'
      : fixture.intent;
  const user = bookPrompt.buildUserPrompt({
    desiredChange,
    notes,
    locale: 'pl',
    context,
  });

  if (user.includes('Prywatny tytuł') || user.includes('Prywatny autor')) {
    return bad('prompt zawiera prywatny tytuł lub autora');
  }

  if (config === null) {
    const result = bookValidator.validateBookLabModelResult(
      deterministicBookLabDraft(context.safeMinutes),
      {
        safeMinutes: context.safeMinutes,
        noteOrdinals: [1, 2, 3],
        noteTexts: notes.map((note) => note.content),
      },
    );
    return 'rule' in result ? bad(result.rule) : pass();
  }

  const value = await callModel(
    config,
    bookPrompt.SYSTEM_PROMPT,
    user,
    bookSchema.BOOK_LAB_RESPONSE_SCHEMA,
  );
  const result = bookValidator.validateBookLabModelResult(value, {
    safeMinutes: context.safeMinutes,
    noteOrdinals: [1, 2, 3],
    noteTexts: notes.map((note) => note.content),
  });
  if ('rule' in result) return bad(result.rule);

  if (fixture.expect === 'out_of_scope') {
    return result.status === 'out_of_scope'
      ? pass()
      : bad(`status ${result.status}, oczekiwano out_of_scope`);
  }

  return result.status === 'ok' ? pass() : bad(`status ${result.status}, oczekiwano ok`);
}

/**
 * Sprawdzenie bez modelu.
 *
 * Nie udaje wywołania: potwierdza dwie rzeczy, które i tak muszą być prawdziwe,
 * zanim jakiekolwiek wywołanie ma sens — że prompt się składa i że wariant
 * deterministyczny przechodzi walidator dla tego stanu użytkownika.
 */
function dryCheck(userPrompt, fixture) {
  if (typeof userPrompt !== 'string' || userPrompt.trim() === '') {
    return bad('prompt użytkownika jest pusty');
  }

  const context = contextOf(fixture);
  const ceiling = validate.budgetCeiling(context.allocatedMinutes);

  const fallbackItem = {
    title: fixture.intent === '' ? 'Coś małego' : fixture.intent.slice(0, 80),
    unit: 'minutes',
    start_value: Math.max(1, Math.min(10, ceiling)),
    increment_value: 0,
  };

  const proposalViolation = validate.validateProposal([fallbackItem], {
    ...context,
    existingTitles: [],
  });
  if (proposalViolation !== null) {
    return bad(`wariant deterministyczny odrzucony: ${proposalViolation.rule}`);
  }

  const fitViolation = validate.validatePathFit(
    pathFit.deterministicPathFit('fits'),
    fitContext(fixture),
  );
  if (fitViolation !== null && fitViolation.rule !== 'fit_budget') {
    return bad(`dopasowanie deterministyczne odrzucone: ${fitViolation.rule}`);
  }

  return pass();
}

const CHECKS = {
  plan: checkPlan,
  intent: checkIntent,
  downshift: checkDownshift,
  'path-fit': checkPathFit,
  'book-lab': checkBookLab,
};

// Przebieg --------------------------------------------------------------------

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const fixtures = loadFixtures().filter(
    (fixture) => flags.fixture === null || fixture.file.includes(flags.fixture),
  );

  if (fixtures.length === 0) {
    fail({
      what: 'nie znalazłem żadnego stanu użytkownika do sprawdzenia',
      why: `Katalog ${path.relative(REPO_ROOT, FIXTURE_DIR)} jest pusty albo filtr nie pasuje do żadnego pliku.`,
      fix: ['Uruchom bez filtra:', '$ npm run prompt:test'],
    });
  }

  const kinds = KINDS.filter((kind) => flags.kind === null || kind === flags.kind);

  if (kinds.length === 0) {
    fail({
      what: `nie znam rodzaju wywołania "${flags.kind}"`,
      why: `Zestaw sprawdza pięć rodzajów: ${KINDS.join(', ')}.`,
      fix: ['Wybierz jeden z nich:', '$ npm run prompt:test -- --kind=intent'],
    });
  }

  const config = flags.dryRun ? null : geminiConfig();

  if (!flags.dryRun && config === null) {
    fail({
      what: 'nie mam klucza do modelu',
      why:
        'Zestaw regresyjny sprawdza prawdziwe odpowiedzi modelu, więc bez klucza\n' +
        'nie ma czego sprawdzać. Klucz czytamy wyłącznie ze zmiennej środowiskowej\n' +
        'procesu — nigdy z pliku w repozytorium (CLAUDE.md, reguła krytyczna 1).',
      fix: [
        'Na Windowsie (PowerShell), w tej sesji terminala:',
        '$ $env:GEMINI_API_KEY = "..."',
        '',
        'Na macOS i Linuksie:',
        '$ export GEMINI_API_KEY=...',
        '',
        'Sam kształt promptów i walidatorów sprawdzisz bez klucza:',
        '$ npm run prompt:test -- --dry-run',
      ],
    });
  }

  title(
    flags.dryRun
      ? 'Zestaw regresyjny promptów — bez modelu'
      : 'Zestaw regresyjny promptów',
  );

  if (flags.dryRun) {
    info('Bez wywołań modelu: sprawdzam składanie promptów i warianty deterministyczne.');
    blank();
  } else {
    info(`Model: ${config.model}`);
    info(`Wywołań do wykonania: ${fixtures.length * kinds.length}`);
    blank();
  }

  const rows = [];
  const failures = [];

  for (const fixture of fixtures) {
    const details = [];
    let allOk = true;

    for (const kind of kinds) {
      let result;

      try {
        result = await CHECKS[kind](fixture, config);
      } catch (error) {
        result = bad(error instanceof Error ? error.message : String(error));
      }

      if (!result.ok) {
        allOk = false;
        details.push(`${kind}: ${result.detail}`);
        failures.push({ fixture: fixture.name, kind, detail: result.detail });
      }
    }

    rows.push({
      name: fixture.name,
      status: allOk ? 'ok' : 'bad',
      detail: allOk ? kinds.join(', ') : details.join(' | '),
    });
  }

  statusTable(rows);

  if (failures.length === 0) {
    process.stdout.write(
      `  ${color.green(`Wszystkie ${rows.length} stanów przeszło.`)}\n\n`,
    );
    return;
  }

  process.stdout.write(`  ${color.red(`Naruszone reguły: ${failures.length}`)}\n`);
  for (const failure of failures) {
    note(`${failure.fixture} — ${failure.kind} — ${failure.detail}`);
  }
  blank();

  process.exitCode = 1;
}

await main();
