import { useCallback, useRef, useState } from 'react';

import {
  markSuggestionAccepted,
  suggestHabit,
} from '@/features/ai-plan/api/suggest-habit-api';
import {
  aiSuggestErrorKey,
  type AiSuggestErrorKey,
} from '@/features/ai-plan/model/errors';
import type { PlanItem } from '@/features/ai-plan/model/plan';
import type { SuggestStatus } from '@/features/ai-plan/model/suggestion';

export type UseSuggestHabitResult = {
  candidates: PlanItem[];
  /** `null`, dopóki nikt o nic nie pytał. */
  status: SuggestStatus | null;
  /** Ile podpowiedzi zostało w bieżącym oknie. */
  remaining: number | null;
  isSuggesting: boolean;
  errorKey: AiSuggestErrorKey | null;
  suggest: (intent: string) => Promise<void>;
  /** Telemetria trafności. Wołane w chwili wyboru karty, nie zapisu nawyku. */
  markAccepted: () => void;
  reset: () => void;
};

/**
 * Stan podpowiedzi do formularza nawyku.
 *
 * Kandydaci żyją wyłącznie tutaj — nic nie trafia do bazy, dopóki użytkownik
 * nie przejdzie formularza do końca i nie naciśnie zapisz. Wybór karty
 * wypełnia pola i na tym się kończy.
 */
export function useSuggestHabit(): UseSuggestHabitResult {
  const [candidates, setCandidates] = useState<PlanItem[]>([]);
  const [status, setStatus] = useState<SuggestStatus | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [errorKey, setErrorKey] = useState<AiSuggestErrorKey | null>(null);

  // Ref, nie stan: identyfikator generacji nie wpływa na to, co widać, a jego
  // zmiana nie ma prawa przerysować listy propozycji.
  const generationId = useRef<string | null>(null);
  const accepted = useRef(false);

  const suggest = useCallback(async (intent: string) => {
    setIsSuggesting(true);
    setErrorKey(null);
    accepted.current = false;

    try {
      const response = await suggestHabit(intent);
      setCandidates(response.candidates);
      setStatus(response.status);
      setRemaining(response.remaining);
      generationId.current = response.generation_id;
    } catch (error) {
      setCandidates([]);
      setStatus(null);
      setErrorKey(aiSuggestErrorKey(error));
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  const markAccepted = useCallback(() => {
    const id = generationId.current;
    if (id === null || accepted.current) return;

    accepted.current = true;
    // Bez await i bez obsługi błędu: to pomiar, a nie część przepływu.
    void markSuggestionAccepted(id);
  }, []);

  const reset = useCallback(() => {
    setCandidates([]);
    setStatus(null);
    setErrorKey(null);
    generationId.current = null;
    accepted.current = false;
  }, []);

  return {
    candidates,
    status,
    remaining,
    isSuggesting,
    errorKey,
    suggest,
    markAccepted,
    reset,
  };
}
