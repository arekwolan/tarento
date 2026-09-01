export const PROTOCOL_DAY_KINDS = [
  'workday',
  'free',
  'night_shift',
  'care',
  'custom',
] as const;

export const PROTOCOL_TIME_BANDS = ['morning', 'afternoon', 'evening'] as const;

export type ProtocolDayKind = (typeof PROTOCOL_DAY_KINDS)[number];
export type ProtocolTimeBand = (typeof PROTOCOL_TIME_BANDS)[number];
export type ProtocolScheduleType = 'daily' | 'weekdays' | 'custom';

export type ProtocolDaySlot = {
  dayOfWeek: number;
  dayKind: ProtocolDayKind;
  availableMinutes: number;
};

export type ProtocolScheduledItem = {
  id: string;
  stageId: string | null;
  minutes: number;
  scheduleType: ProtocolScheduleType;
  scheduleDays: readonly number[] | null;
  timeOfDay: ProtocolTimeBand | null;
  dayKinds: readonly ProtocolDayKind[] | null;
};

export type ProtocolIncomingStage = {
  id: string;
  dailyMinutes: number;
  practices: readonly ProtocolScheduledItem[];
};

export type StructuralProtocolConflict = {
  key: string;
  type: 'capacity' | 'execution';
  stageId: string;
  incomingPracticeId: string;
  existingHabitId: string | null;
  dayKinds: ProtocolDayKind[];
  timeOfDay: ProtocolTimeBand | null;
  requiredMinutes: number | null;
  availableMinutes: number | null;
};

export type ProtocolRuleNote = {
  id: string;
  text: string;
  context: string | null;
};

export type DeterministicRuleConflict = {
  noteAId: string;
  noteBId: string;
  confidence: 'medium' | 'high';
};

const SAFE_BUDGET_RATIO = 0.6;

export function scheduledOn(
  item: Pick<
    ProtocolScheduledItem,
    'scheduleType' | 'scheduleDays' | 'dayKinds'
  >,
  slot: ProtocolDaySlot,
): boolean {
  if (item.dayKinds !== null && !item.dayKinds.includes(slot.dayKind)) return false;
  if (item.scheduleType === 'daily') return true;
  if (item.scheduleType === 'weekdays') {
    return slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5;
  }
  return item.scheduleDays?.includes(slot.dayOfWeek) === true;
}

function uniqueDayKinds(slots: readonly ProtocolDaySlot[]): ProtocolDayKind[] {
  return [...new Set(slots.map((slot) => slot.dayKind))].sort();
}

function minimumSafeFreeMinutes(
  slots: readonly ProtocolDaySlot[],
  existing: readonly ProtocolScheduledItem[],
): number {
  return slots.reduce((minimum, slot) => {
    const used = existing
      .filter((habit) => scheduledOn(habit, slot))
      .reduce((sum, habit) => sum + Math.max(0, habit.minutes), 0);
    const safe = Math.floor(
      Math.max(0, slot.availableMinutes - used) * SAFE_BUDGET_RATIO,
    );
    return Math.min(minimum, safe);
  }, Number.POSITIVE_INFINITY);
}

/**
 * Deterministyczny radar minut i pasm. Nie czyta tekstu i nie korzysta z AI.
 * Sloty obejmują pełny wspólny cykl rotacji dnia i tygodnia.
 */
export function detectStructuralProtocolConflicts(
  stages: readonly ProtocolIncomingStage[],
  existing: readonly ProtocolScheduledItem[],
  daySlots: readonly ProtocolDaySlot[],
): StructuralProtocolConflict[] {
  const conflicts: StructuralProtocolConflict[] = [];

  for (const stage of stages) {
    for (const incoming of stage.practices) {
      const matchingSlots = daySlots.filter((slot) => scheduledOn(incoming, slot));
      if (matchingSlots.length === 0) continue;

      const available = minimumSafeFreeMinutes(matchingSlots, existing);
      if (Number.isFinite(available) && stage.dailyMinutes > available) {
        const dayKinds = uniqueDayKinds(
          matchingSlots.filter((slot) => {
            const safe = minimumSafeFreeMinutes([slot], existing);
            return stage.dailyMinutes > safe;
          }),
        );
        conflicts.push({
          key: `capacity:${stage.id}:${incoming.id}:${dayKinds.join(',')}`,
          type: 'capacity',
          stageId: stage.id,
          incomingPracticeId: incoming.id,
          existingHabitId: null,
          dayKinds,
          timeOfDay: incoming.timeOfDay,
          requiredMinutes: stage.dailyMinutes,
          availableMinutes: available,
        });
      }

      for (const habit of existing) {
        if (
          incoming.timeOfDay === null ||
          habit.timeOfDay === null ||
          incoming.timeOfDay !== habit.timeOfDay
        ) {
          continue;
        }

        const overlap = matchingSlots.filter((slot) => scheduledOn(habit, slot));
        if (overlap.length === 0) continue;
        const dayKinds = uniqueDayKinds(overlap);
        conflicts.push({
          key: `execution:${stage.id}:${incoming.id}:${habit.id}:${dayKinds.join(',')}:${incoming.timeOfDay}`,
          type: 'execution',
          stageId: stage.id,
          incomingPracticeId: incoming.id,
          existingHabitId: habit.id,
          dayKinds,
          timeOfDay: incoming.timeOfDay,
          requiredMinutes: null,
          availableMinutes: null,
        });
      }
    }
  }

  return conflicts;
}

type DirectedAction = { direction: 'do' | 'avoid'; action: string };

const CUES: readonly { pattern: RegExp; direction: DirectedAction['direction'] }[] = [
  {
    pattern:
      /^(?:zawsze|należy|warto|powinienem|powinnam|powinno się|always|should|do)\s+(.+)$/iu,
    direction: 'do',
  },
  {
    pattern:
      /^(?:nigdy|nie należy|nie warto|nie powinienem|nie powinnam|nie powinno się|never|do not|don't|should not|shouldn't)\s+(.+)$/iu,
    direction: 'avoid',
  },
];

function normalizedAction(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('pl')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function actions(text: string): DirectedAction[] {
  return text
    .split(/[.!?;\n]+/u)
    .map((part) => normalizedAction(part))
    .flatMap((part) => {
      for (const cue of CUES) {
        const match = cue.pattern.exec(part);
        const action = match?.[1];
        if (action !== undefined && action.length >= 3) {
          return [{ direction: cue.direction, action }];
        }
      }
      return [];
    });
}

function actionSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  const leftWords = new Set(left.split(' ').filter((word) => word.length > 2));
  const rightWords = new Set(right.split(' ').filter((word) => word.length > 2));
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  let common = 0;
  for (const word of leftWords) if (rightWords.has(word)) common += 1;
  return common / Math.max(leftWords.size, rightWords.size);
}

/**
 * Konserwatywny detektor jawnych reguł „rób / nie rób”. Treść nie opuszcza
 * procesu, nie jest wykonywana i nie może zwrócić decyzji ani mutacji.
 */
export function detectDeterministicRuleConflicts(
  existing: readonly ProtocolRuleNote[],
  incoming: readonly ProtocolRuleNote[],
): DeterministicRuleConflict[] {
  const result: DeterministicRuleConflict[] = [];

  for (const noteA of existing) {
    for (const noteB of incoming) {
      if (
        noteA.context !== null &&
        noteB.context !== null &&
        noteA.context !== noteB.context
      ) {
        continue;
      }
      let best = 0;
      for (const left of actions(noteA.text)) {
        for (const right of actions(noteB.text)) {
          if (left.direction === right.direction) continue;
          best = Math.max(best, actionSimilarity(left.action, right.action));
        }
      }
      if (best < 0.75) continue;
      result.push({
        noteAId: noteA.id,
        noteBId: noteB.id,
        confidence: best === 1 ? 'high' : 'medium',
      });
    }
  }

  return result;
}
