import {
  habitTemplateRowSchema,
  type HabitTemplate,
} from '@/features/templates/model/template';
import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

const TEMPLATE_COLUMNS =
  'id, title, description, icon, unit, start_value, increment_value, target_value, ' +
  'progression_mode, source_book, source_author, category, language, sort_order';

/** Katalog startowy w danym języku. Odczyt publiczny, bez zapisu z klienta. */
export async function fetchHabitTemplates(language: string): Promise<HabitTemplate[]> {
  const { data, error } = await supabase
    .from('habit_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('language', language)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error !== null) throw toDataError(error);

  return habitTemplateRowSchema.array().parse(data);
}
