import { z } from 'zod';

import type { IsoDate } from '@/lib/date';

export type DayTemplateKind = 'workday' | 'free' | 'night_shift' | 'care' | 'custom';
export type DayBlockKind = 'work' | 'commute' | 'care' | 'fixed' | 'meal' | 'sleep';

/**
 * Kształt jednego typu doby: kiedy się zaczyna, kiedy kończy i ile z niej
 * użytkownik daje sobie na siebie.
 *
 * Godziny trzymamy jako 'HH:MM'. Postgres oddaje kolumnę `time` jako
 * 'HH:MM:SS', ale sekundy nie niosą tu żadnej informacji, a każdy odbiorca
 * musiałby je obcinać u siebie — obcinamy raz, w mapowaniu wiersza.
 */
export type DayTemplate = {
  id: string;
  userId: string;
  name: string;
  kind: DayTemplateKind;
  wakeTime: string;
  /** Wcześniejsza niż `wakeTime` oznacza czuwanie przez północ (dyżur nocny). */
  sleepTime: string;
  selfMinutes: number;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Zajęty pas wewnątrz szablonu.
 *
 * Zawsze mieści się w jednej dobie: blok przechodzący przez północ jest
 * w bazie dwoma wierszami (CHECK `day_blocks_order` tego pilnuje).
 */
export type DayBlock = {
  id: string;
  templateId: string;
  userId: string;
  label: string | null;
  kind: DayBlockKind;
  startTime: string;
  endTime: string;
  archivedAt: string | null;
};

export type DayRotation = {
  id: string;
  userId: string;
  anchorDate: IsoDate;
  /** Uporządkowana lista szablonów; dzień wskazuje jeden z nich resztą z dzielenia. */
  templateIds: string[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Przedział w dobie, w minutach i w zapisie zegarowym.
 *
 * `end` bywa '24:00' — to koniec doby, nie jej początek. Bez tego zapisu okno
 * kończące się o północy byłoby nie do odróżnienia od okna, które się o niej
 * zaczyna.
 */
export type TimeWindow = {
  start: string;
  end: string;
  minutes: number;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Oczekiwano daty YYYY-MM-DD');

/**
 * Kolumna `time` z Postgresa ('HH:MM:SS') → 'HH:MM' modelu.
 *
 * '24:00' jest dopuszczone celowo: tak zapisuje się blok domykający dobę,
 * czyli pierwsza połowa bloku rozbitego na północy.
 */
const timeOfDay = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)(:[0-5]\d)?$/, 'Oczekiwano godziny HH:MM')
  .transform((value) => value.slice(0, 5));

const dayTemplateKind = z.enum(['workday', 'free', 'night_shift', 'care', 'custom']);
const dayBlockKind = z.enum(['work', 'commute', 'care', 'fixed', 'meal', 'sleep']);

/**
 * Wiersz z Postgresa → DayTemplate.
 *
 * Walidujemy zodem, bo to dane z zewnątrz (CLAUDE.md, sekcja TypeScript).
 * Kolumny tekstowe mają w bazie CHECK-i, ale generator typów widzi w nich
 * zwykły `string` — bez tego zawężenia trzeba by rzutować.
 */
export const dayTemplateRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    name: z.string(),
    kind: dayTemplateKind,
    wake_time: timeOfDay,
    sleep_time: timeOfDay,
    self_minutes: z.number(),
    sort_order: z.number(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): DayTemplate => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    wakeTime: row.wake_time,
    sleepTime: row.sleep_time,
    selfMinutes: row.self_minutes,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export const dayBlockRowSchema = z
  .object({
    id: z.string(),
    template_id: z.string(),
    user_id: z.string(),
    label: z.string().nullable(),
    kind: dayBlockKind,
    start_time: timeOfDay,
    end_time: timeOfDay,
    archived_at: z.string().nullable(),
  })
  .transform((row): DayBlock => ({
    id: row.id,
    templateId: row.template_id,
    userId: row.user_id,
    label: row.label,
    kind: row.kind,
    startTime: row.start_time,
    endTime: row.end_time,
    archivedAt: row.archived_at,
  }));

export const dayRotationRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    anchor_date: isoDate,
    // Granice powtarzają CHECK z migracji: rotacja pusta nie wskazuje żadnego
    // dnia, a dłuższa niż 28 pozycji to już nie rotacja, tylko kalendarz.
    template_ids: z.array(z.string()).min(1).max(28),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row): DayRotation => ({
    id: row.id,
    userId: row.user_id,
    anchorDate: row.anchor_date,
    templateIds: row.template_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
