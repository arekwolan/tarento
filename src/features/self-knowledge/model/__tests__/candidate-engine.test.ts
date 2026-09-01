import { buildSelfRuleCandidates } from '@/features/self-knowledge/model/candidate-engine';
import {
  acceptedSelfRuleContexts,
  type SelfRule,
  type SelfRuleEvidenceRow,
} from '@/features/self-knowledge/model/self-rule';
import { addDays } from '@/lib/date';

const HABIT_ID = '11111111-1111-4111-8111-111111111111';
const REVISION_ONE = '22222222-2222-4222-8222-222222222221';
const REVISION_TWO = '22222222-2222-4222-8222-222222222222';

function row(
  offset: number,
  overrides: Partial<SelfRuleEvidenceRow> = {},
): SelfRuleEvidenceRow {
  return {
    habitId: HABIT_ID,
    day: addDays('2026-01-01', offset),
    outcome: 'pending',
    timeOfDay: 'morning',
    targetValue: 5,
    scheduleKey: 'daily:null',
    dayKind: null,
    revisionId: REVISION_ONE,
    revisionNumber: 1,
    revisionSource: 'user',
    revisionReason: 'created',
    isMinimal: false,
    frictionReason: null,
    ...overrides,
  };
}

function outcomes(
  from: number,
  count: number,
  completed: number,
  overrides: Partial<SelfRuleEvidenceRow>,
): SelfRuleEvidenceRow[] {
  return Array.from({ length: count }, (_, index) =>
    row(from + index, {
      outcome: index < completed ? 'completed' : 'pending',
      ...overrides,
    }),
  );
}

describe('deterministyczna Instrukcja obsługi siebie', () => {
  it('nie tworzy porównania poniżej minimalnej próbki', () => {
    const evidence = [
      ...outcomes(0, 5, 5, { timeOfDay: 'evening' }),
      ...outcomes(5, 5, 0, { timeOfDay: 'morning' }),
    ];

    expect(
      buildSelfRuleCandidates(evidence).find((rule) => rule.ruleType === 'time_of_day'),
    ).toBeUndefined();
  });

  it('pokazuje liczniki, zakres i lepszą porę bez procentów', () => {
    const evidence = [
      ...outcomes(0, 6, 1, { timeOfDay: 'morning' }),
      ...outcomes(6, 6, 5, { timeOfDay: 'evening' }),
    ];

    expect(
      buildSelfRuleCandidates(evidence).find((rule) => rule.ruleType === 'time_of_day'),
    ).toEqual({
      ruleType: 'time_of_day',
      subjectHabitId: HABIT_ID,
      preferredValue: 'evening',
      comparisonValue: 'morning',
      preferredCompleted: 5,
      preferredOpportunities: 6,
      comparisonCompleted: 1,
      comparisonOpportunities: 6,
      rangeStart: '2026-01-01',
      rangeEnd: '2026-01-12',
    });
  });

  it('nie porównuje pór z różnych harmonogramów', () => {
    const evidence = [
      ...outcomes(0, 6, 1, { timeOfDay: 'morning', scheduleKey: 'daily:null' }),
      ...outcomes(6, 6, 5, {
        timeOfDay: 'evening',
        scheduleKey: 'weekdays:null',
      }),
    ];

    expect(
      buildSelfRuleCandidates(evidence).find((rule) => rule.ruleType === 'time_of_day'),
    ).toBeUndefined();
  });

  it('porównuje typ dnia tylko w tej samej rewizji i pomija historyczne NULL', () => {
    const withoutSnapshot = [
      ...outcomes(0, 6, 1, { dayKind: null }),
      ...outcomes(6, 6, 5, { dayKind: null }),
    ];
    expect(
      buildSelfRuleCandidates(withoutSnapshot).find(
        (rule) => rule.ruleType === 'day_type',
      ),
    ).toBeUndefined();

    const comparable = [
      ...outcomes(0, 6, 1, { dayKind: 'workday' }),
      ...outcomes(6, 6, 5, { dayKind: 'free' }),
    ];
    expect(
      buildSelfRuleCandidates(comparable).find((rule) => rule.ruleType === 'day_type'),
    ).toMatchObject({ preferredValue: 'free', comparisonValue: 'workday' });
  });

  it('tworzy wzorzec tarcia dopiero od trzech zdarzeń', () => {
    const two = outcomes(0, 2, 0, { frictionReason: 'no_time' });
    expect(
      buildSelfRuleCandidates(two).find((rule) => rule.ruleType === 'friction'),
    ).toBeUndefined();

    const three = outcomes(0, 3, 0, { frictionReason: 'no_time' });
    expect(
      buildSelfRuleCandidates(three).find((rule) => rule.ruleType === 'friction'),
    ).toMatchObject({
      preferredValue: 'no_time',
      preferredOpportunities: 3,
      comparisonValue: null,
    });
  });

  it('porównuje wersję minimalną na kanonicznych okazjach', () => {
    const evidence = [
      ...outcomes(0, 6, 1, { isMinimal: false }),
      ...outcomes(6, 6, 5, {
        isMinimal: true,
        revisionSource: 'downshift',
        revisionReason: 'difficult_period',
      }),
    ];
    expect(
      buildSelfRuleCandidates(evidence).find(
        (rule) => rule.ruleType === 'minimal_version',
      ),
    ).toMatchObject({ preferredValue: 'minimal', comparisonValue: 'standard' });
  });

  it('normalizuje przed/po rewizji liczbą oczekiwanych okazji', () => {
    const evidence = [
      ...outcomes(0, 6, 1, { revisionId: REVISION_ONE, revisionNumber: 1 }),
      ...outcomes(6, 6, 5, { revisionId: REVISION_TWO, revisionNumber: 2 }),
    ];
    expect(
      buildSelfRuleCandidates(evidence).find(
        (rule) => rule.ruleType === 'revision_outcome',
      ),
    ).toMatchObject({ preferredValue: 'after', comparisonValue: 'before' });
  });

  it('nie wpuszcza kandydata ani podważonej reguły do kontekstu planu', () => {
    const base = {
      id: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      ruleKey: `time_of_day:${HABIT_ID}`,
      ruleType: 'time_of_day' as const,
      subjectHabitId: HABIT_ID,
      algorithmVersion: 'self-rules-v1',
      conclusionKey: 'evening',
      evidence: {
        algorithm_version: 'self-rules-v1' as const,
        rule_type: 'time_of_day' as const,
        subject_habit_id: HABIT_ID,
        preferred_value: 'evening',
        comparison_value: 'morning',
        preferred_completed: 5,
        preferred_opportunities: 6,
        comparison_completed: 1,
        comparison_opportunities: 6,
        range_start: '2026-01-01',
        range_end: '2026-01-12',
      },
      evidenceHash: 'a'.repeat(32),
      sampleSize: 12,
      rangeStart: '2026-01-01',
      rangeEnd: '2026-01-12',
      reevaluateOn: '2026-02-12',
      archivedAt: null,
      createdAt: '2026-01-13T00:00:00Z',
      updatedAt: '2026-01-13T00:00:00Z',
    } satisfies Omit<SelfRule, 'status' | 'reviewRequiredAt'>;

    const candidate: SelfRule = {
      ...base,
      status: 'candidate',
      reviewRequiredAt: null,
    };
    const accepted: SelfRule = {
      ...base,
      id: '33333333-3333-4333-8333-333333333334',
      status: 'accepted',
      reviewRequiredAt: null,
    };
    const contradicted: SelfRule = {
      ...base,
      id: '33333333-3333-4333-8333-333333333335',
      status: 'accepted',
      reviewRequiredAt: '2026-02-01T00:00:00Z',
    };

    expect(acceptedSelfRuleContexts([candidate, accepted, contradicted])).toEqual([
      accepted,
    ]);
  });
});
