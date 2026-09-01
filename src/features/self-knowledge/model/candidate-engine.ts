import type {
  SelfRuleCandidate,
  SelfRuleEvidenceRow,
  SelfRuleType,
} from '@/features/self-knowledge/model/self-rule';
import {
  SELF_RULE_MAX_CANDIDATES,
  SELF_RULE_MIN_COMPARATIVE_OPPORTUNITIES,
  SELF_RULE_MIN_FRICTION_EVENTS,
  SELF_RULE_MIN_RATE_GAP,
} from '@/features/self-knowledge/model/self-rule';

type Bucket = { value: string; rows: SelfRuleEvidenceRow[] };
type RankedCandidate = SelfRuleCandidate & { score: number };

function completed(rows: readonly SelfRuleEvidenceRow[]): number {
  return rows.filter((row) => row.outcome === 'completed').length;
}

function edgeDates(rows: readonly SelfRuleEvidenceRow[]) {
  const ordered = [...rows].sort((left, right) => left.day.localeCompare(right.day));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return first === undefined || last === undefined
    ? null
    : { start: first.day, end: last.day };
}

function compareBuckets(
  ruleType: SelfRuleType,
  habitId: string,
  left: Bucket,
  right: Bucket,
): RankedCandidate | null {
  if (
    left.rows.length < SELF_RULE_MIN_COMPARATIVE_OPPORTUNITIES ||
    right.rows.length < SELF_RULE_MIN_COMPARATIVE_OPPORTUNITIES
  ) {
    return null;
  }

  const leftCompleted = completed(left.rows);
  const rightCompleted = completed(right.rows);
  const leftRate = leftCompleted / left.rows.length;
  const rightRate = rightCompleted / right.rows.length;
  const gap = Math.abs(leftRate - rightRate);
  if (gap < SELF_RULE_MIN_RATE_GAP || leftRate === rightRate) return null;

  const preferred = leftRate > rightRate ? left : right;
  const comparison = leftRate > rightRate ? right : left;
  const preferredCompleted = leftRate > rightRate ? leftCompleted : rightCompleted;
  const comparisonCompleted = leftRate > rightRate ? rightCompleted : leftCompleted;
  const dates = edgeDates([...preferred.rows, ...comparison.rows]);
  if (dates === null) return null;

  return {
    ruleType,
    subjectHabitId: habitId,
    preferredValue: preferred.value,
    comparisonValue: comparison.value,
    preferredCompleted,
    preferredOpportunities: preferred.rows.length,
    comparisonCompleted,
    comparisonOpportunities: comparison.rows.length,
    rangeStart: dates.start,
    rangeEnd: dates.end,
    score: gap * Math.sqrt(preferred.rows.length + comparison.rows.length),
  };
}

function bestPair(
  ruleType: SelfRuleType,
  habitId: string,
  buckets: readonly Bucket[],
): RankedCandidate | null {
  let best: RankedCandidate | null = null;
  for (let left = 0; left < buckets.length; left += 1) {
    for (let right = left + 1; right < buckets.length; right += 1) {
      const leftBucket = buckets[left];
      const rightBucket = buckets[right];
      if (leftBucket === undefined || rightBucket === undefined) continue;
      const candidate = compareBuckets(ruleType, habitId, leftBucket, rightBucket);
      if (candidate !== null && (best === null || candidate.score > best.score)) {
        best = candidate;
      }
    }
  }
  return best;
}

function bucketBy(
  rows: readonly SelfRuleEvidenceRow[],
  valueOf: (row: SelfRuleEvidenceRow) => string | null,
): Bucket[] {
  const groups = new Map<string, SelfRuleEvidenceRow[]>();
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null) continue;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return [...groups.entries()].map(([value, group]) => ({ value, rows: group }));
}

function bestWithinComparableGroups(
  ruleType: SelfRuleType,
  habitId: string,
  rows: readonly SelfRuleEvidenceRow[],
  comparableKey: (row: SelfRuleEvidenceRow) => string | null,
  valueOf: (row: SelfRuleEvidenceRow) => string | null,
): RankedCandidate | null {
  const comparable = new Map<string, SelfRuleEvidenceRow[]>();
  for (const row of rows) {
    const key = comparableKey(row);
    if (key === null) continue;
    comparable.set(key, [...(comparable.get(key) ?? []), row]);
  }

  let best: RankedCandidate | null = null;
  for (const group of comparable.values()) {
    const candidate = bestPair(ruleType, habitId, bucketBy(group, valueOf));
    if (candidate !== null && (best === null || candidate.score > best.score)) {
      best = candidate;
    }
  }
  return best;
}

function timeCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  return bestWithinComparableGroups(
    'time_of_day',
    habitId,
    rows,
    (row) => row.scheduleKey,
    (row) => row.timeOfDay,
  );
}

function targetCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  const comparable = new Map<string, SelfRuleEvidenceRow[]>();
  for (const row of rows) {
    const key = `${row.scheduleKey}:${row.timeOfDay ?? 'none'}`;
    comparable.set(key, [...(comparable.get(key) ?? []), row]);
  }

  let best: RankedCandidate | null = null;
  for (const group of comparable.values()) {
    const values = [...new Set(group.map((row) => row.targetValue))].sort(
      (left, right) => left - right,
    );
    if (values.length < 2) continue;
    const splitAt = values[Math.floor(values.length / 2)];
    if (splitAt === undefined) continue;
    const candidate = compareBuckets(
      'target_size',
      habitId,
      { value: 'smaller', rows: group.filter((row) => row.targetValue < splitAt) },
      { value: 'larger', rows: group.filter((row) => row.targetValue >= splitAt) },
    );
    if (candidate !== null && (best === null || candidate.score > best.score)) {
      best = candidate;
    }
  }
  return best;
}

function dayTypeCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  // Porównanie tylko w jednej wersji. Stare NULL-e pomijamy bez rekonstrukcji.
  return bestWithinComparableGroups(
    'day_type',
    habitId,
    rows,
    (row) => row.revisionId,
    (row) => row.dayKind,
  );
}

function frictionCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  const buckets = bucketBy(rows, (row) => row.frictionReason).sort((left, right) => {
    if (left.rows.length !== right.rows.length) return right.rows.length - left.rows.length;
    return left.value.localeCompare(right.value);
  });
  const repeated = buckets[0];
  if (repeated === undefined || repeated.rows.length < SELF_RULE_MIN_FRICTION_EVENTS) {
    return null;
  }
  const dates = edgeDates(repeated.rows);
  if (dates === null) return null;
  return {
    ruleType: 'friction' as const,
    subjectHabitId: habitId,
    preferredValue: repeated.value,
    comparisonValue: null,
    preferredCompleted: 0,
    preferredOpportunities: repeated.rows.length,
    comparisonCompleted: 0,
    comparisonOpportunities: 0,
    rangeStart: dates.start,
    rangeEnd: dates.end,
    score: repeated.rows.length,
  };
}

function minimalCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  return bestWithinComparableGroups(
    'minimal_version',
    habitId,
    rows,
    (row) => `${row.scheduleKey}:${row.timeOfDay ?? 'none'}`,
    (row) => (row.isMinimal ? 'minimal' : 'standard'),
  );
}

function revisionCandidate(habitId: string, rows: readonly SelfRuleEvidenceRow[]) {
  const revisions = new Map<string, { number: number; rows: SelfRuleEvidenceRow[] }>();
  for (const row of rows) {
    if (row.revisionId === null || row.revisionNumber === null) continue;
    const current = revisions.get(row.revisionId) ?? {
      number: row.revisionNumber,
      rows: [],
    };
    current.rows.push(row);
    revisions.set(row.revisionId, current);
  }

  const ordered = [...revisions.values()].sort((left, right) => left.number - right.number);
  let best: RankedCandidate | null = null;
  for (let index = 1; index < ordered.length; index += 1) {
    const before = ordered[index - 1];
    const after = ordered[index];
    if (before === undefined || after === undefined) continue;
    const candidate = compareBuckets(
      'revision_outcome',
      habitId,
      { value: 'before', rows: before.rows },
      { value: 'after', rows: after.rows },
    );
    if (candidate !== null && (best === null || candidate.score > best.score)) {
      best = candidate;
    }
  }
  return best;
}

/** Zamknięty katalog W3. Słabe lub nieporównywalne dane nie tworzą reguły. */
export function buildSelfRuleCandidates(
  evidence: readonly SelfRuleEvidenceRow[],
): SelfRuleCandidate[] {
  const byHabit = new Map<string, SelfRuleEvidenceRow[]>();
  for (const row of evidence) {
    byHabit.set(row.habitId, [...(byHabit.get(row.habitId) ?? []), row]);
  }

  const candidates: RankedCandidate[] = [];
  for (const [habitId, rows] of byHabit) {
    for (const candidate of [
      timeCandidate(habitId, rows),
      targetCandidate(habitId, rows),
      dayTypeCandidate(habitId, rows),
      frictionCandidate(habitId, rows),
      minimalCandidate(habitId, rows),
      revisionCandidate(habitId, rows),
    ]) {
      if (candidate !== null) candidates.push(candidate);
    }
  }

  return candidates
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.rangeEnd !== right.rangeEnd) return right.rangeEnd.localeCompare(left.rangeEnd);
      if (left.ruleType !== right.ruleType) return left.ruleType.localeCompare(right.ruleType);
      return left.subjectHabitId.localeCompare(right.subjectHabitId);
    })
    .slice(0, SELF_RULE_MAX_CANDIDATES)
    .map(({ score: _score, ...candidate }) => candidate);
}
