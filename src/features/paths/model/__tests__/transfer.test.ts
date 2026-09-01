import {
  createPathTransferRequestId,
  isTransferDecisionAllowed,
  isTransferSuppressed,
  pathTransferFormSchema,
  TRANSFER_EVIDENCE_MAX_LENGTH,
  type PathTransferResponse,
} from '@/features/paths/model/transfer';

const latest = (
  decision: PathTransferResponse['decision'],
  deferUntil: string | null,
): Pick<PathTransferResponse, 'decision' | 'deferUntil'> => ({
  decision,
  deferUntil,
});

describe('sprawdzian transferu', () => {
  it.each(['yes', 'not_yet', 'no_opportunity'] as const)(
    'przyjmuje odpowiedź %s bez obowiązkowego tekstu',
    (response) => {
      expect(pathTransferFormSchema.safeParse({ response, evidence: '' }).success).toBe(
        true,
      );
    },
  );

  it('pilnuje jednego krótkiego zdania dowodu', () => {
    expect(
      pathTransferFormSchema.safeParse({
        response: 'yes',
        evidence: 'a'.repeat(TRANSFER_EVIDENCE_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      pathTransferFormSchema.safeParse({
        response: 'yes',
        evidence: 'a'.repeat(TRANSFER_EVIDENCE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('daje downshift tylko po „jeszcze nie”, ale zawsze pozwala zostać lub przejść', () => {
    expect(isTransferDecisionAllowed('not_yet', 'downshift')).toBe(true);
    expect(isTransferDecisionAllowed('yes', 'downshift')).toBe(false);
    expect(isTransferDecisionAllowed('no_opportunity', 'downshift')).toBe(false);
    expect(isTransferDecisionAllowed('not_yet', 'advance')).toBe(true);
    expect(isTransferDecisionAllowed('no_opportunity', 'stay')).toBe(true);
  });

  it('nie pyta w tygodniu ponownego wejścia ani podczas neutralnego odłożenia', () => {
    expect(isTransferSuppressed('2026-08-29', '2026-09-05', null)).toBe(true);
    expect(isTransferSuppressed('2026-08-29', null, latest('stay', '2026-09-05'))).toBe(
      true,
    );
    expect(isTransferSuppressed('2026-09-06', null, latest('stay', '2026-09-05'))).toBe(
      false,
    );
  });

  it('optymistyczna decyzja przejścia wycisza duplikat podczas retry offline', () => {
    expect(isTransferSuppressed('2026-08-29', null, latest('advance', null))).toBe(true);
  });

  it('tworzy stabilny UUID v4 do idempotentnego retry', () => {
    expect(createPathTransferRequestId(() => 0)).toBe(
      '00000000-0000-4000-8000-000000000000',
    );
  });
});
