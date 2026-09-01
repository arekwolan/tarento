import { useCallback, useMemo, useRef, useState } from 'react';

import {
  clampBlockEnd,
  clampBlockStart,
  clampDraftBlocks,
  dayAxis,
  defaultDayShape,
  draftWindow,
  nextBlockDraft,
  MAX_BLOCKS,
  type DayAxis,
  type DayShapeDraft,
} from '@/features/day-budget/model/day-shape';
import type { TimeWindow } from '@/features/day-budget/model/windows';

export type UseDayShapeDraftResult = {
  draft: DayShapeDraft;
  /** Granice paska doby, przeliczone raz na zmianę pobudki albo snu. */
  axis: DayAxis;
  /** Okno, które widzi użytkownik. `null`, gdy w dobie nie zostaje nic. */
  dayWindow: TimeWindow | null;
  canAddBlock: boolean;
  setWakeTime: (value: string) => void;
  setSleepTime: (value: string) => void;
  setSelfMinutes: (minutes: number) => void;
  /** Nowe krawędzie pasa. Wartości spoza osi są przycinane tutaj, nie w widoku. */
  setBlock: (id: string, start: number, end: number) => void;
  addBlock: () => void;
  removeBlock: (id: string) => void;
};

/**
 * Stan formularza kształtu dnia.
 *
 * Cała arytmetyka siedzi w model/day-shape.ts — tutaj zostaje sam stan i to,
 * co musi się wydarzyć razem: zmiana pobudki przycina pasy, przesunięcie
 * krawędzi zachowuje minimalną długość, a nowy pas nie powstaje, gdy nie ma
 * dla niego miejsca.
 */
export function useDayShapeDraft(): UseDayShapeDraftResult {
  const [draft, setDraft] = useState<DayShapeDraft>(defaultDayShape);

  // Identyfikator nadajemy poza aktualizatorem stanu: React woła aktualizator
  // dwa razy w trybie deweloperskim, a licznik ma rosnąć raz na dodany pas.
  const nextBlockNumber = useRef(2);

  const setWakeTime = useCallback((value: string) => {
    setDraft((current) => clampDraftBlocks({ ...current, wakeTime: value }));
  }, []);

  const setSleepTime = useCallback((value: string) => {
    setDraft((current) => clampDraftBlocks({ ...current, sleepTime: value }));
  }, []);

  const setSelfMinutes = useCallback((minutes: number) => {
    setDraft((current) => ({ ...current, selfMinutes: minutes }));
  }, []);

  const setBlock = useCallback((id: string, start: number, end: number) => {
    setDraft((current) => {
      const axis = dayAxis(current);
      const target = current.blocks.find((block) => block.id === id);
      if (target === undefined) return current;

      const nextStart = clampBlockStart(target, axis, start);
      const nextEnd = clampBlockEnd({ ...target, start: nextStart }, axis, end);

      // Ten sam obiekt, gdy nic się nie zmieniło — przeciąganie poza krawędź
      // osi nie ma renderować w kółko tego samego paska.
      if (nextStart === target.start && nextEnd === target.end) return current;

      return {
        ...current,
        blocks: current.blocks.map((block) =>
          block.id === id ? { ...block, start: nextStart, end: nextEnd } : block,
        ),
      };
    });
  }, []);

  const addBlock = useCallback(() => {
    const id = `block-${nextBlockNumber.current}`;
    nextBlockNumber.current += 1;

    setDraft((current) => {
      if (current.blocks.length >= MAX_BLOCKS) return current;

      const block = nextBlockDraft(current, id);
      if (block === null) return current;

      return { ...current, blocks: [...current.blocks, block] };
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== id),
    }));
  }, []);

  const axis = useMemo(() => dayAxis(draft), [draft]);
  const dayWindow = useMemo(() => draftWindow(draft), [draft]);
  const canAddBlock =
    draft.blocks.length < MAX_BLOCKS && nextBlockDraft(draft, 'probe') !== null;

  return {
    draft,
    axis,
    dayWindow,
    canAddBlock,
    setWakeTime,
    setSleepTime,
    setSelfMinutes,
    setBlock,
    addBlock,
    removeBlock,
  };
}
