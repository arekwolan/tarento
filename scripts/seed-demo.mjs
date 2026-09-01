/**
 * `npm run seed:demo` — konto testowe z historią, żeby aplikacja miała co pokazać.
 *
 * Bez tego pierwsze uruchomienie kończy się pustym ekranem powitalnym: nie widać
 * ani serii, ani heatmapy, ani progresji celów. Tutaj zakładamy konto
 * demo@tarento.app z czterema nawykami i trzydziestoma dniami historii.
 *
 * Skrypt jest idempotentny: nawyki mają z góry ustalone identyfikatory,
 * a wpisy są kluczowane parą (habit_id, log_date). Kolejne uruchomienie
 * nadpisuje te same wiersze, zamiast dokładać nowe.
 *
 * Klucz service_role bierzemy z `supabase status` przy każdym uruchomieniu
 * i trzymamy wyłącznie w pamięci procesu. Nie ląduje w żadnym pliku —
 * CLAUDE.md, reguła krytyczna 1.
 */

import process from 'node:process';

import { serviceHeaders, supabaseStatus } from './lib/local-supabase.mjs';
import {
  blank,
  command,
  fail,
  failUnexpected,
  info,
  note,
  ok,
  step,
  title,
} from './lib/ui.mjs';

const DEMO_EMAIL = 'demo@tarento.app';
const DEMO_PASSWORD = 'demo1234';
const DEMO_TIMEZONE = 'Europe/Warsaw';
const DEMO_DAY_START_HOUR = 4;

/** Ile dni historii generujemy wstecz od dzisiaj. */
const HISTORY_DAYS = 30;
/** Nawyki zaczęły się wcześniej niż historia, żeby progresja zdążyła urosnąć. */
const STARTED_DAYS_AGO = 34;

/**
 * Dwie przerwy w regularności, liczone w dniach wstecz od dzisiaj.
 * Bez nich każda seria byłaby idealna i ekran postępów nie pokazywałby,
 * jak wygląda zerwana passa.
 */
const BREAKS = [
  { from: 9, to: 10 },
  { from: 21, to: 22 },
];

/** Do tego dnia wstecz seria ma być nieprzerwana — to jest „aktualna passa". */
const CURRENT_RUN_UNTIL = 8;

const TOTAL_STEPS = 5;

/**
 * Identyfikatory są stałe, bo to one dają idempotencję: drugie uruchomienie
 * trafia w te same wiersze zamiast zakładać komplet nowych nawyków.
 */
const HABITS = [
  {
    id: '7a1d0c00-0001-4a00-8a00-000000000001',
    title: 'Medytacja poranna',
    description: 'Dziesięć oddechów, zanim sięgniesz po telefon.',
    icon: 'leaf-outline',
    color: '#98593F',
    unit: 'minutes',
    start_value: 5,
    increment_value: 1,
    target_value: 20,
    progression_mode: 'completion',
    schedule_type: 'daily',
    schedule_days: null,
    reminder_time: '07:00:00',
    time_of_day: 'morning',
    category: 'mindfulness',
    sort_order: 1,
    // Dziś już odhaczony — żeby było widać, jak wygląda pozycja zrobiona.
    doneToday: true,
  },
  {
    id: '7a1d0c00-0002-4a00-8a00-000000000002',
    title: 'Czytanie przed snem',
    description: 'Papierowa książka zamiast ekranu w ostatniej godzinie dnia.',
    icon: 'book-outline',
    color: '#4F6F52',
    unit: 'pages',
    start_value: 5,
    increment_value: 1,
    target_value: 30,
    progression_mode: 'completion',
    schedule_type: 'daily',
    schedule_days: null,
    reminder_time: '21:30:00',
    time_of_day: 'evening',
    category: 'learning',
    sort_order: 2,
    doneToday: false,
  },
  {
    id: '7a1d0c00-0003-4a00-8a00-000000000003',
    title: 'Trening siłowy',
    description: 'Trzy serie bez sprzętu, zawsze o tej samej porze.',
    icon: 'barbell-outline',
    color: '#8C5A8C',
    unit: 'reps',
    start_value: 10,
    increment_value: 2,
    target_value: 50,
    // Tryb kalendarzowy: cel rośnie z upływem dni, nie z liczbą wykonań.
    progression_mode: 'calendar',
    schedule_type: 'custom',
    // 1 = poniedziałek, 3 = środa, 5 = piątek. 0 = niedziela, jak w Postgresie.
    schedule_days: [1, 3, 5],
    reminder_time: '17:30:00',
    time_of_day: 'afternoon',
    category: 'health',
    sort_order: 3,
    doneToday: false,
  },
  {
    id: '7a1d0c00-0004-4a00-8a00-000000000004',
    title: 'Telefon poza sypialnią',
    description: 'Ładowarka ląduje w innym pokoju.',
    icon: 'moon-outline',
    color: '#3F6C98',
    unit: 'none',
    start_value: 1,
    increment_value: 0,
    target_value: null,
    progression_mode: 'completion',
    schedule_type: 'daily',
    schedule_days: null,
    reminder_time: '22:30:00',
    time_of_day: 'evening',
    category: 'health',
    sort_order: 4,
    doneToday: false,
  },
];

const UNIT_LABEL = {
  minutes: 'minut',
  seconds: 'sekund',
  reps: 'powtórzeń',
  pages: 'stron',
  count: 'razy',
  none: 'odhaczenie',
};

try {
  await main();
} catch (error) {
  failUnexpected(error);
}

async function main() {
  title('Tarento — dane demonstracyjne');

  const status = requireRunningStack();
  const userId = await ensureDemoUser(status);
  await ensureProfile(status, userId);

  const habits = await upsertHabits(status, userId);
  const summary = await upsertLogs(status, userId, habits);

  await verifyLogin(status, summary);
}

// 1. Baza ---------------------------------------------------------------------

function requireRunningStack() {
  step(1, TOTAL_STEPS, 'Sprawdzam lokalną bazę');

  const status = supabaseStatus();
  if (status === null) {
    fail({
      what: 'lokalna baza nie działa',
      why: 'Dane demonstracyjne trzeba gdzieś zapisać, a baza jest wyłączona.',
      fix: [
        'Uruchom bazę i spróbuj ponownie:',
        '$ npm run db:start',
        '$ npm run seed:demo',
      ],
    });
  }

  if (status.serviceKey === null) {
    fail({
      what: 'baza nie oddała klucza administracyjnego',
      why: 'Bez niego nie da się założyć konta testowego — zwykłe konto\nnie ma prawa tworzyć użytkowników.',
      fix: ['Uruchom bazę od nowa:', '$ npx supabase stop', '$ npm run db:start'],
    });
  }

  ok(`baza działa pod ${status.apiUrl}`);
  blank();
  return status;
}

// 2. Konto --------------------------------------------------------------------

async function ensureDemoUser(status) {
  step(2, TOTAL_STEPS, 'Zakładam konto testowe');

  const created = await request(status, '/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'Demo', locale: 'pl' },
    },
    allowStatus: [422, 400],
  });

  if (created.ok) {
    ok(`konto założone: ${DEMO_EMAIL}`);
    blank();
    return created.body.id;
  }

  // Konto już jest — znajdujemy je i wyrównujemy hasło do tego z instrukcji.
  const existing = await findUserByEmail(status);
  if (existing === null) {
    fail({
      what: 'nie udało się założyć ani odnaleźć konta testowego',
      why: `Supabase odrzucił zakładanie konta, ale ${DEMO_EMAIL} nie ma na liście użytkowników.`,
      fix: [
        'Zbuduj bazę od zera i spróbuj ponownie:',
        '$ npm run dev -- --reset',
        '$ npm run seed:demo',
      ],
      raw: JSON.stringify(created.body),
    });
  }

  await request(status, `/auth/v1/admin/users/${existing.id}`, {
    method: 'PUT',
    body: { password: DEMO_PASSWORD, email_confirm: true },
  });

  ok(`konto już istniało — odświeżyłem hasło (${DEMO_EMAIL})`);
  blank();
  return existing.id;
}

async function findUserByEmail(status) {
  const listed = await request(status, '/auth/v1/admin/users?page=1&per_page=200', {
    method: 'GET',
  });

  const users = Array.isArray(listed.body?.users) ? listed.body.users : [];
  return users.find((user) => user.email === DEMO_EMAIL) ?? null;
}

// 3. Profil -------------------------------------------------------------------

async function ensureProfile(status, userId) {
  step(3, TOTAL_STEPS, 'Ustawiam profil');

  const patch = {
    display_name: 'Demo',
    timezone: DEMO_TIMEZONE,
    day_start_hour: DEMO_DAY_START_HOUR,
    locale: 'pl',
    // Bez tego aplikacja po zalogowaniu wrzuca użytkownika w onboarding,
    // zamiast pokazać gotowe dane.
    onboarding_completed_at: new Date().toISOString(),
  };

  const updated = await request(status, `/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  });

  if (Array.isArray(updated.body) && updated.body.length > 0) {
    ok('profil ustawiony, onboarding oznaczony jako zrobiony');
    blank();
    return;
  }

  // Trigger zakładający profil nie zadziałał — dopisujemy wiersz ręcznie.
  await request(status, '/rest/v1/profiles', {
    method: 'POST',
    body: { id: userId, ...patch },
    prefer: 'resolution=merge-duplicates,return=minimal',
    query: 'on_conflict=id',
  });

  ok('profil utworzony');
  blank();
}

// 4. Nawyki -------------------------------------------------------------------

async function upsertHabits(status, userId) {
  step(4, TOTAL_STEPS, 'Wgrywam nawyki');

  const startedOn = isoDate(addDays(logicalToday(), -STARTED_DAYS_AGO));

  const rows = HABITS.map((habit) => ({
    id: habit.id,
    user_id: userId,
    title: habit.title,
    description: habit.description,
    icon: habit.icon,
    color: habit.color,
    unit: habit.unit,
    start_value: habit.start_value,
    increment_value: habit.increment_value,
    target_value: habit.target_value,
    progression_mode: habit.progression_mode,
    schedule_type: habit.schedule_type,
    schedule_days: habit.schedule_days,
    reminder_time: habit.reminder_time,
    time_of_day: habit.time_of_day,
    category: habit.category,
    sort_order: habit.sort_order,
    started_on: startedOn,
    // Ponowne uruchomienie ma przywracać nawyk, a nie zostawiać go w archiwum.
    archived_at: null,
  }));

  await request(status, '/rest/v1/habits', {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
    query: 'on_conflict=id',
  });

  for (const habit of HABITS) {
    const unit = UNIT_LABEL[habit.unit];
    const progression =
      habit.increment_value === 0
        ? 'bez progresji'
        : `${habit.start_value} → ${habit.target_value} ${unit}`;
    ok(`${habit.title} (${unit}, ${progression})`);
  }

  note(`Wszystkie prowadzone od ${startedOn}.`);
  blank();

  return rows;
}

// 5. Historia -----------------------------------------------------------------

async function upsertLogs(status, userId, habits) {
  step(5, TOTAL_STEPS, `Generuję ${HISTORY_DAYS} dni historii`);

  const today = logicalToday();
  const logs = [];
  const perHabit = [];

  for (const habit of habits) {
    const definition = HABITS.find((entry) => entry.id === habit.id);
    const generated = generateHistory(habit, definition, today);

    logs.push(...generated.rows.map((row) => ({ ...row, user_id: userId })));
    perHabit.push({
      title: definition.title,
      done: generated.done,
      scheduled: generated.scheduled,
      streak: generated.streak,
    });
  }

  // Klucz (habit_id, log_date) jest unikalny, więc powtórne uruchomienie
  // nadpisze te same dni zamiast dokładać duplikaty.
  await request(status, '/rest/v1/habit_logs', {
    method: 'POST',
    body: logs,
    prefer: 'resolution=merge-duplicates,return=minimal',
    query: 'on_conflict=habit_id,log_date',
  });

  for (const entry of perHabit) {
    const rate = Math.round((entry.done / entry.scheduled) * 100);
    ok(
      `${entry.title}: ${entry.done}/${entry.scheduled} dni (${rate}%), seria ${entry.streak}`,
    );
  }

  const done = perHabit.reduce((sum, entry) => sum + entry.done, 0);
  const scheduled = perHabit.reduce((sum, entry) => sum + entry.scheduled, 0);
  const rate = Math.round((done / scheduled) * 100);

  note(`Razem ${logs.length} wpisów, skuteczność ${rate}%.`);
  blank();

  return { rate, logs: logs.length };
}

/**
 * Historia jednego nawyku.
 *
 * Idziemy od najstarszego dnia do dzisiaj, bo cel w trybie `completion` zależy
 * od liczby wcześniejszych wykonań — nie da się go policzyć wstecz.
 */
function generateHistory(habit, definition, today) {
  const rows = [];
  let completed = 0;
  let scheduled = 0;
  let done = 0;
  let streak = 0;

  // Nawyk zaczął się wcześniej niż okno historii. W trybie kalendarzowym cel
  // zależy od dni, które już minęły, więc te wcześniejsze trzeba doliczyć —
  // inaczej progresja wystartowałaby od zera w środku życia nawyku.
  let scheduledElapsed = 0;
  for (let offset = STARTED_DAYS_AGO; offset >= HISTORY_DAYS; offset -= 1) {
    if (isScheduledOn(habit, isoDate(addDays(today, -offset)))) scheduledElapsed += 1;
  }

  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = isoDate(addDays(today, -offset));
    if (!isScheduledOn(habit, date)) continue;

    scheduled += 1;

    const target = targetForDay(habit, completed, scheduledElapsed);
    scheduledElapsed += 1;

    const skipped = shouldSkip(habit, definition, offset, date);
    if (skipped) {
      // Brak wiersza, nie status 'skipped' — dopiero dziura w danych zrywa serię.
      // (Status 'skipped' w schemacie znaczy „dzień celowo odpuszczony".)
      streak = offset === 0 ? streak : 0;
      continue;
    }

    // Co szósty wpis jako 'partial' — inaczej heatmapa jest jednolita.
    const partial = hash(`${habit.id}:${date}:partial`) % 6 === 0;
    const status = partial ? 'partial' : 'done';

    rows.push({
      habit_id: habit.id,
      log_date: date,
      status,
      target_value: target,
      value_completed: partial ? Math.max(1, Math.round(target * 0.6)) : target,
      note: null,
      completed_at: `${date}T18:00:00.000Z`,
    });

    completed += 1;
    done += 1;
    streak += 1;
  }

  return { rows, done, scheduled, streak };
}

/** Które dni wypadają z regularności. */
function shouldSkip(habit, definition, offset, date) {
  if (BREAKS.some((gap) => offset >= gap.from && offset <= gap.to)) return true;

  // Dzisiejszy dzień zostawiamy do odhaczenia w aplikacji — poza jednym
  // nawykiem, żeby było widać obie wersje wiersza na ekranie „Dziś".
  if (offset === 0) return !definition.doneToday;

  // Aktualna passa ma być czysta, więc pojedyncze wpadki dokładamy tylko
  // w starszej części historii.
  if (offset <= CURRENT_RUN_UNTIL) return false;

  return hash(`${habit.id}:${date}`) % 100 < 12;
}

function targetForDay(habit, completedCount, scheduledElapsed) {
  const step =
    habit.progression_mode === 'completion' ? completedCount : scheduledElapsed;
  const progressed = habit.start_value + habit.increment_value * step;

  return habit.target_value === null
    ? progressed
    : Math.min(progressed, habit.target_value);
}

function isScheduledOn(habit, date) {
  if (date < habit.started_on) return false;

  switch (habit.schedule_type) {
    case 'daily':
      return true;
    case 'weekdays':
      return [1, 2, 3, 4, 5].includes(dayOfWeek(date));
    case 'custom':
      return (habit.schedule_days ?? []).includes(dayOfWeek(date));
    default:
      return false;
  }
}

// Weryfikacja -----------------------------------------------------------------

async function verifyLogin(status, summary) {
  blank();

  const response = await fetch(`${status.apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: status.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  if (!response.ok) {
    fail({
      what: 'dane się zapisały, ale logowanie na konto testowe nie działa',
      why: 'Konto istnieje, a mimo to Supabase odrzuca hasło. Zwykle znaczy to,\nże konto zostało założone wcześniej z innym hasłem i nie dało się go nadpisać.',
      fix: [
        'Zbuduj bazę od zera i wgraj dane jeszcze raz:',
        '$ npm run dev -- --reset',
        '$ npm run seed:demo',
      ],
      raw: await response.text(),
    });
  }

  const { access_token: token } = await response.json();

  // Serie liczy baza, nie skrypt — sprawdzamy, czy widzi to, co wygenerowaliśmy.
  const streaks = await fetch(`${status.apiUrl}/rest/v1/rpc/get_habits_streaks`, {
    method: 'POST',
    headers: {
      apikey: status.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const rows = streaks.ok ? await streaks.json() : [];
  const best = rows.reduce((max, row) => Math.max(max, row.longest_streak ?? 0), 0);

  info(`Logowanie sprawdzone, baza liczy serie (najdłuższa: ${best} dni).`);
  blank();

  process.stdout.write('  Zaloguj się w aplikacji danymi:\n');
  command(`e-mail: ${DEMO_EMAIL}`);
  command(`hasło:  ${DEMO_PASSWORD}`);
  blank();
  note(`Wgrane wpisy: ${summary.logs}, skuteczność ${summary.rate}%.`);
  note('Ponowne uruchomienie tego skryptu nadpisze te same dane, nie zdubluje ich.');
  blank();
}

// HTTP ------------------------------------------------------------------------

async function request(status, endpoint, options) {
  const query = options.query === undefined ? '' : `?${options.query}`;
  const url = `${status.apiUrl}${endpoint}${query}`;

  const headers = { ...serviceHeaders(status) };
  if (options.prefer !== undefined) headers.Prefer = options.prefer;

  let response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    fail({
      what: 'nie udało się połączyć z bazą',
      why: 'Baza odpowiadała przed chwilą, a teraz nie odbiera. Mogła się zatrzymać\nw trakcie działania skryptu.',
      fix: ['Sprawdź stan bazy:', '$ npm run doctor'],
      raw: error instanceof Error ? error.message : String(error),
    });
  }

  const text = await response.text();
  const body = text.length === 0 ? null : safeJson(text);

  if (!response.ok && !(options.allowStatus ?? []).includes(response.status)) {
    fail({
      what: `baza odrzuciła zapis (HTTP ${response.status})`,
      why: 'Zapytanie nie przeszło. Najczęstsza przyczyna to niezgodność\nz aktualnym kształtem tabel — czyli niewgrane migracje.',
      fix: [
        'Zbuduj bazę od zera i spróbuj ponownie:',
        '$ npm run dev -- --reset',
        '$ npm run seed:demo',
      ],
      raw: text,
    });
  }

  return { ok: response.ok, status: response.status, body };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Daty ------------------------------------------------------------------------
//
// Skrypt nie może użyć @/lib/date — to kod TypeScript zbudowany pod React
// Native. Powtarzamy więc minimum: dobę logiczną i arytmetykę na dniach.
// Liczymy w UTC, gdzie każda doba ma równe 24 godziny, więc zmiana czasu
// nie przesuwa wyników.

/**
 * „Dzisiaj" widziane tak, jak widzi je aplikacja: data w strefie profilu,
 * przy czym godziny przed DEMO_DAY_START_HOUR należą jeszcze do dnia poprzedniego.
 */
function logicalToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const value = (type) => parts.find((part) => part.type === type).value;
  const date = Date.UTC(
    Number(value('year')),
    Number(value('month')) - 1,
    Number(value('day')),
  );
  const hour = Number(value('hour')) % 24;

  return hour < DEMO_DAY_START_HOUR ? addDays(date, -1) : date;
}

function addDays(timestamp, amount) {
  return timestamp + amount * 86_400_000;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dayOfWeek(date) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** Prosty, powtarzalny hash — te same dane przy każdym uruchomieniu. */
function hash(value) {
  let result = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }

  return Math.abs(result);
}
