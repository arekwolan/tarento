import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { aiPlanErrorKey, type AiPlanErrorKey } from '@/features/ai-plan';
import {
  archiveBookLabProject,
  generateBookLabProtocol,
  saveBookLabProtocol,
} from '@/features/book-lab/api/book-lab-api';
import type {
  BookLabDraft,
  BookLabFormValues,
  BookLabResponse,
} from '@/features/book-lab/model/schemas';
import { pathKeys } from '@/features/paths';
import { toDataError, type DataError } from '@/lib/data-error';
import { queryClient } from '@/lib/query-client';

type GenerateVariables = {
  requestId: string;
  form: BookLabFormValues;
  locale: 'pl' | 'en';
  basePathId?: string | null;
};

type SaveVariables = { projectId: string; draft: BookLabDraft };

export type UseBookLabResult = {
  response: BookLabResponse | null;
  savedPathId: string | null;
  generate: (
    variables: GenerateVariables,
    onSuccess?: (response: BookLabResponse) => void,
  ) => void;
  save: (variables: SaveVariables) => void;
  archive: (projectId: string, onSuccess?: () => void) => void;
  reset: () => void;
  isGenerating: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  generateErrorKey: AiPlanErrorKey | null;
  saveError: DataError | null;
  archiveError: DataError | null;
};

export function useBookLab(): UseBookLabResult {
  const [response, setResponse] = useState<BookLabResponse | null>(null);
  const [savedPathId, setSavedPathId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: (variables: GenerateVariables) =>
      generateBookLabProtocol(
        variables.requestId,
        variables.form,
        variables.locale,
        variables.basePathId ?? null,
      ),
    onSuccess: setResponse,
  });

  const saveMutation = useMutation({
    mutationFn: (variables: SaveVariables) =>
      saveBookLabProtocol(variables.projectId, variables.draft),
    onSuccess: (pathId) => {
      setSavedPathId(pathId);
      void queryClient.invalidateQueries({ queryKey: pathKeys.all });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveBookLabProject,
    onSuccess: () => {
      setResponse(null);
      setSavedPathId(null);
      void queryClient.invalidateQueries({ queryKey: pathKeys.all });
    },
  });

  return {
    response,
    savedPathId,
    generate: (variables, onSuccess) => {
      generateMutation.mutate(variables, { onSuccess });
    },
    save: saveMutation.mutate,
    archive: (projectId, onSuccess) => {
      archiveMutation.mutate(projectId, { onSuccess });
    },
    reset: () => {
      setResponse(null);
      setSavedPathId(null);
      generateMutation.reset();
      saveMutation.reset();
      archiveMutation.reset();
    },
    isGenerating: generateMutation.isPending,
    isSaving: saveMutation.isPending,
    isArchiving: archiveMutation.isPending,
    generateErrorKey:
      generateMutation.error === null ? null : aiPlanErrorKey(generateMutation.error),
    saveError: saveMutation.error === null ? null : toDataError(saveMutation.error),
    archiveError:
      archiveMutation.error === null ? null : toDataError(archiveMutation.error),
  };
}
