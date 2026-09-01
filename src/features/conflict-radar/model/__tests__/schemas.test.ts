import {
  canActivateConflictReview,
  protocolConflictReviewSchema,
} from '@/features/conflict-radar/model/schemas';

const conflict = {
  id: '10000000-0000-4000-8000-000000000001',
  type: 'execution',
  stage_id: '10000000-0000-4000-8000-000000000002',
  incoming_practice_id: '10000000-0000-4000-8000-000000000003',
  incoming_title: 'Nowa praktyka',
  existing_habit_id: '10000000-0000-4000-8000-000000000004',
  existing_title: 'Obecna praktyka',
  note_a_id: null,
  note_a_text: null,
  note_b_id: null,
  note_b_text: null,
  description: null,
  confidence: null,
  day_kinds: ['workday'],
  time_of_day: 'morning',
  required_minutes: null,
  available_minutes: null,
  decision: null,
  context_a: null,
  context_b: null,
};

it('blokuje aktywację bez odpowiedzi oraz po odrzuceniu nowej praktyki', () => {
  const unresolved = protocolConflictReviewSchema.parse({
    review_id: '10000000-0000-4000-8000-000000000005',
    semantic_status: 'complete',
    conflicts: [conflict],
  });
  expect(canActivateConflictReview(unresolved)).toBe(false);

  expect(
    canActivateConflictReview({
      ...unresolved,
      conflicts: [{ ...unresolved.conflicts[0]!, decision: 'reject_incoming' }],
    }),
  ).toBe(false);
});

it('pozwala aktywować pusty lub jawnie rozwiązany review', () => {
  const review = protocolConflictReviewSchema.parse({
    review_id: '10000000-0000-4000-8000-000000000005',
    semantic_status: 'not_needed',
    conflicts: [],
  });
  expect(canActivateConflictReview(review)).toBe(true);

  expect(
    canActivateConflictReview({
      ...review,
      conflicts: [
        {
          ...protocolConflictReviewSchema.parse({
            review_id: review.reviewId,
            semantic_status: 'complete',
            conflicts: [{ ...conflict, decision: 'reject_existing' }],
          }).conflicts[0]!,
        },
      ],
    }),
  ).toBe(true);
});
