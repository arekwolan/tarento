import { useCallback, useState } from 'react';

import {
  generateDailyPlan,
  type GeneratePlanInput,
} from '@/features/ai-plan/api/ai-plan-api';
import { aiPlanErrorKey, type AiPlanErrorKey } from '@/features/ai-plan/model/errors';
import type { PlanProposal } from '@/features/ai-plan/model/plan';

export type UseGeneratePlanResult = {
  proposal: PlanProposal | null;
  /** Ile generacji zostało w bieżącym oknie. */
  remaining: number | null;
  isGenerating: boolean;
  errorKey: AiPlanErrorKey | null;
  generate: (input: GeneratePlanInput) => Promise<void>;
  /** Odrzuca propozycję i wraca do formularza. */
  reset: () => void;
  /** Podmienia jedną pozycję po edycji przez użytkownika. */
  replaceItem: (index: number, item: PlanProposal['items'][number]) => void;
  removeItem: (index: number) => void;
};

/**
 * Stan generowania planu.
 *
 * Propozycja żyje wyłącznie tutaj — nic nie trafia do bazy, dopóki
 * użytkownik nie naciśnie akceptuj na ekranie.
 */
export function useGeneratePlan(): UseGeneratePlanResult {
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorKey, setErrorKey] = useState<AiPlanErrorKey | null>(null);

  const generate = useCallback(async (input: GeneratePlanInput) => {
    setIsGenerating(true);
    setErrorKey(null);

    try {
      const response = await generateDailyPlan(input);
      setProposal(response.plan);
      setRemaining(response.remaining);
    } catch (error) {
      setProposal(null);
      setErrorKey(aiPlanErrorKey(error));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProposal(null);
    setErrorKey(null);
  }, []);

  const replaceItem = useCallback(
    (index: number, item: PlanProposal['items'][number]) => {
      setProposal((current) =>
        current === null
          ? current
          : {
              ...current,
              items: current.items.map((existing, position) =>
                position === index ? item : existing,
              ),
            },
      );
    },
    [],
  );

  const removeItem = useCallback((index: number) => {
    setProposal((current) =>
      current === null
        ? current
        : {
            ...current,
            items: current.items.filter((_, position) => position !== index),
          },
    );
  }, []);

  return {
    proposal,
    remaining,
    isGenerating,
    errorKey,
    generate,
    reset,
    replaceItem,
    removeItem,
  };
}
