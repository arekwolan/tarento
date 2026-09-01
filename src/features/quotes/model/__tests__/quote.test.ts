import { pickQuoteIndex } from '@/features/quotes/model/quote';

describe('pickQuoteIndex', () => {
  it('daje ten sam wynik dla tego samego ziarna', () => {
    const first = pickQuoteIndex('user-1:2026-03-16', 30);
    const second = pickQuoteIndex('user-1:2026-03-16', 30);
    expect(first).toBe(second);
  });

  it('zmienia wynik z dniem', () => {
    const days = ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20'];
    const picks = days.map((day) => pickQuoteIndex(`user-1:${day}`, 30));
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('mieści się w zakresie puli', () => {
    for (let count = 1; count <= 50; count += 1) {
      const index = pickQuoteIndex(`user-1:2026-03-16`, count);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(count);
    }
  });

  it('pusta pula daje -1', () => {
    expect(pickQuoteIndex('user-1:2026-03-16', 0)).toBe(-1);
  });

  it('rozkłada się po całej puli', () => {
    const picks = new Set<number>();
    for (let day = 1; day <= 200; day += 1) {
      picks.add(pickQuoteIndex(`user-1:2026-03-${String(day).padStart(2, '0')}`, 30));
    }
    // Nie musi trafić w każdy indeks, ale nie może kleić się do kilku.
    expect(picks.size).toBeGreaterThan(15);
  });
});
