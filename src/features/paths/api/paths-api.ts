import {
  pathOriginRowSchema,
  pathPracticeRowSchema,
  pathReadingRowSchema,
  pathRowSchema,
  pathStageRowSchema,
  type Path,
  type PathOrigin,
  type PathPractice,
  type PathReading,
  type PathStage,
} from '@/features/paths/model/schemas';
import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

/**
 * Zapytania do katalogu ścieżek. Wszystkie tylko do odczytu — treść wypełniają
 * migracje albo Laboratorium. Katalog jawnie filtruje publikację i brak
 * właściciela; RLS jest zabezpieczeniem, nie filtrem produktowym.
 */

const PATH_COLUMNS =
  'id, slug, version, title, hook, honesty, completion_note, closing_letter, ' +
  'repeat_cooldown_days, path_kind, source_type, source_title, source_author, ' +
  'source_edition, source_identifier, curated_by, review_status, disclaimer, ' +
  'owner_id, origin_kind, version_parent_id, archived_at, ' +
  'duration_days, language, is_published, sort_order, created_at';

const STAGE_COLUMNS =
  'id, path_id, ordinal, name, description, daily_minutes_p50, min_days, ' +
  'max_days, completion_threshold, environment_setup, ' +
  'environment_setup_note_ordinals, transition_criterion, transition_note_ordinals';

const PRACTICE_COLUMNS =
  'id, stage_id, title, why, how, when_hard, unit, start_value, increment_value, ' +
  'target_value, progression_mode, schedule_type, schedule_days, time_of_day, ' +
  'category, is_optional, retires_practice_id, source_note_ordinals, sort_order';

const READING_COLUMNS =
  'id, stage_id, week, title, author, source_kind, attribution, source_locator, ' +
  'body, framing, quote_text, quote_source';

/** Ścieżka razem z całą swoją treścią — tyle, ile potrzebuje ekran ścieżki. */
export type PathDetail = {
  path: Path;
  stages: PathStage[];
  practices: PathPractice[];
};

/**
 * Pozycja katalogu: definicja plus etapy.
 *
 * Etapy wchodzą do listy, bo bez nich karta nie umie powiedzieć „22–40 min
 * dziennie", a to jedyna liczba, po której da się wybrać ścieżkę.
 */
export type PathCatalogEntry = {
  path: Path;
  stages: PathStage[];
};

/**
 * Zostawia najnowszą opublikowaną wersję każdego sluga.
 *
 * Starsze wersje muszą zostać opublikowane, inaczej RLS ukryłby ścieżkę komuś,
 * kto jest w jej trakcie — a wtedy katalog pokazywałby ten sam tytuł dwa razy.
 * Wybór należy więc do klienta, nie do treści.
 */
function newestVersionPerSlug(paths: readonly Path[]): Path[] {
  const newest = new Map<string, Path>();

  for (const path of paths) {
    const current = newest.get(path.slug);
    if (current === undefined || path.version > current.version) {
      newest.set(path.slug, path);
    }
  }

  return [...newest.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

/** Katalog w danym języku, w kolejności do wyświetlenia. */
export async function fetchPaths(language: string): Promise<Path[]> {
  const { data, error } = await supabase
    .from('paths')
    .select(PATH_COLUMNS)
    .eq('language', language)
    .eq('is_published', true)
    .is('owner_id', null)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('version', { ascending: false });

  if (error !== null) throw toDataError(error);

  return newestVersionPerSlug(pathRowSchema.array().parse(data));
}

/**
 * Najnowsze nieusunięte prywatne protokoły bieżącego właściciela.
 *
 * Brak argumentu ownerId jest celowy: RLS wybiera właściciela, a jawne filtry
 * oddzielają tę listę od publicznego katalogu także na poziomie produktu.
 */
export async function fetchPrivateBookProtocols(): Promise<Path[]> {
  const { data, error } = await supabase
    .from('paths')
    .select(PATH_COLUMNS)
    .eq('origin_kind', 'private')
    .eq('path_kind', 'book_protocol')
    .eq('is_published', false)
    .not('owner_id', 'is', null)
    .is('archived_at', null)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false });

  if (error !== null) throw toDataError(error);

  return newestVersionPerSlug(pathRowSchema.array().parse(data));
}

/**
 * Najnowsza opublikowana wersja ścieżki o danym slugu, w danym języku.
 *
 * Język jest częścią adresu treści, nie ozdobą: ten sam slug w tej samej
 * wersji ma osobny wiersz na język, więc bez tego filtru `limit(1)` wybrałby
 * dowolny z nich.
 */
export async function fetchPathBySlug(
  slug: string,
  language: string,
): Promise<Path | null> {
  const { data, error } = await supabase
    .from('paths')
    .select(PATH_COLUMNS)
    .eq('slug', slug)
    .eq('language', language)
    .eq('is_published', true)
    .is('owner_id', null)
    .is('archived_at', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return pathRowSchema.parse(data);
}

export async function fetchPathStages(pathId: string): Promise<PathStage[]> {
  const { data, error } = await supabase
    .from('path_stages')
    .select(STAGE_COLUMNS)
    .eq('path_id', pathId)
    .order('ordinal', { ascending: true });

  if (error !== null) throw toDataError(error);

  return pathStageRowSchema.array().parse(data);
}

/**
 * Praktyki całej ścieżki jednym zapytaniem.
 *
 * Filtr idzie przez join do etapu (`path_stages!inner`), żeby nie robić
 * osobnego zapytania na etap. Zagnieżdżony obiekt z odpowiedzi jest tu tylko
 * warunkiem — schemat wiersza go pomija.
 */
export async function fetchPathPractices(pathId: string): Promise<PathPractice[]> {
  const { data, error } = await supabase
    .from('path_practices')
    .select(`${PRACTICE_COLUMNS}, path_stages!inner(path_id)`)
    .eq('path_stages.path_id', pathId)
    .order('sort_order', { ascending: true });

  if (error !== null) throw toDataError(error);

  return pathPracticeRowSchema.array().parse(data);
}

/** Lektury całej ścieżki, w kolejności tygodni. */
export async function fetchPathReadings(pathId: string): Promise<PathReading[]> {
  const { data, error } = await supabase
    .from('path_readings')
    .select(`${READING_COLUMNS}, path_stages!inner(path_id)`)
    .eq('path_stages.path_id', pathId)
    .order('week', { ascending: true })
    .order('id', { ascending: true });

  if (error !== null) throw toDataError(error);

  return pathReadingRowSchema.array().parse(data);
}

/**
 * Cała treść ścieżki pod ekran szczegółów.
 *
 * Etapy i praktyki lecą równolegle — obie zależą wyłącznie od id ścieżki,
 * więc nie ma powodu, żeby czekały na siebie. Lektury zostają osobno: ekran
 * katalogu ich nie pokazuje, a bywają najcięższą częścią treści.
 */
export async function fetchPathDetail(
  slug: string,
  language: string,
): Promise<PathDetail | null> {
  const path = await fetchPathBySlug(slug, language);
  if (path === null) return null;

  const [stages, practices] = await Promise.all([
    fetchPathStages(path.id),
    fetchPathPractices(path.id),
  ]);

  return { path, stages, practices };
}

/**
 * Etapy wszystkich opublikowanych ścieżek w danym języku.
 *
 * Jedno zapytanie na cały katalog zamiast jednego na kartę: etapów jest
 * kilkanaście, a dzięki temu lista otwiera się z jednym round tripem i działa
 * z cache'u bez sieci.
 */
export async function fetchCatalogStages(language: string): Promise<PathStage[]> {
  const { data, error } = await supabase
    .from('path_stages')
    .select(
      `${STAGE_COLUMNS}, paths!inner(language, is_published, owner_id, archived_at)`,
    )
    .eq('paths.language', language)
    .eq('paths.is_published', true)
    .is('paths.owner_id', null)
    .is('paths.archived_at', null)
    .order('ordinal', { ascending: true });

  if (error !== null) throw toDataError(error);

  return pathStageRowSchema.array().parse(data);
}

/** Katalog gotowy do wyświetlenia: ścieżki w kolejności, każda ze swoimi etapami. */
export async function fetchCatalog(language: string): Promise<PathCatalogEntry[]> {
  const [paths, stages] = await Promise.all([
    fetchPaths(language),
    fetchCatalogStages(language),
  ]);

  return paths.map((path) => ({
    path,
    stages: stages.filter((stage) => stage.pathId === path.id),
  }));
}

/**
 * Ścieżka po id.
 *
 * Potrzebna tam, gdzie punktem wyjścia jest zapis użytkownika, a nie link:
 * `user_paths` wskazuje wersję ścieżki, nie slug.
 */
export async function fetchPathById(pathId: string): Promise<Path | null> {
  const { data, error } = await supabase
    .from('paths')
    .select(PATH_COLUMNS)
    .eq('id', pathId)
    .is('archived_at', null)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return pathRowSchema.parse(data);
}

/** To samo co `fetchPathDetail`, tyle że po id wersji. */
export async function fetchPathDetailById(pathId: string): Promise<PathDetail | null> {
  const path = await fetchPathById(pathId);
  if (path === null) return null;

  const [stages, practices] = await Promise.all([
    fetchPathStages(path.id),
    fetchPathPractices(path.id),
  ]);

  return { path, stages, practices };
}

/**
 * Skąd wziął się nawyk: tytuł ścieżki i numer etapu.
 *
 * Jedno zapytanie z osadzoną ścieżką — to jedyna linia, po której na ekranie
 * widać pochodzenie, więc nie warto na nią wydawać dwóch round tripów.
 */
export async function fetchPathOrigin(stageId: string): Promise<PathOrigin | null> {
  const { data, error } = await supabase
    .from('path_stages')
    .select('ordinal, paths!inner(title)')
    .eq('id', stageId)
    .maybeSingle();

  if (error !== null) throw toDataError(error);
  if (data === null) return null;

  return pathOriginRowSchema.parse(data);
}
