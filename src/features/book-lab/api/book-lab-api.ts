import { invokeAiFunction } from '@/features/ai-plan/api/invoke';
import {
  bookLabResponseSchema,
  type BookLabDraft,
  type BookLabFormValues,
  type BookLabResponse,
} from '@/features/book-lab/model/schemas';
import { AiPlanError } from '@/features/ai-plan/model/errors';
import { toDataError } from '@/lib/data-error';
import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'book-lab';

export async function generateBookLabProtocol(
  requestId: string,
  form: BookLabFormValues,
  locale: 'pl' | 'en',
  basePathId: string | null = null,
): Promise<BookLabResponse> {
  const data = await invokeAiFunction(FUNCTION_NAME, {
    request_id: requestId,
    source_title: form.sourceTitle,
    source_author: form.sourceAuthor,
    desired_change: form.desiredChange,
    locale,
    base_path_id: basePathId,
    notes: form.notes.map((note, index) => ({
      ordinal: index + 1,
      content: note.content,
      source_locator: note.sourceLocator.trim() === '' ? null : note.sourceLocator,
    })),
  });
  const parsed = bookLabResponseSchema.safeParse(data);
  if (!parsed.success) throw new AiPlanError('invalid_model_output');
  return parsed.data;
}

export async function saveBookLabProtocol(
  projectId: string,
  draft: BookLabDraft,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_book_lab_protocol', {
    p_project_id: projectId,
    p_draft: draft,
  });
  if (error !== null) throw toDataError(error);
  return data;
}

export async function archiveBookLabProject(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_book_lab_project', {
    p_project_id: projectId,
  });
  if (error !== null) throw toDataError(error);
}
