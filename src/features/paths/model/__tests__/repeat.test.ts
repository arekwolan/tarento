import { isRepeatBlocked, type EndedPath } from '@/features/paths/model/repeat';

const TODAY = '2026-08-27';

const COMEBACK = { slug: 'comeback', repeatCooldownDays: 60 };
const CHAOS = { slug: 'out-of-chaos', repeatCooldownDays: null };

function ended(slug: string, endedOn: string): EndedPath {
  return {
    id: `ended:${slug}:${endedOn}`,
    pathId: `path:${slug}`,
    slug,
    title: slug,
    endedAt: `${endedOn}T20:00:00.000Z`,
  };
}

describe('isRepeatBlocked', () => {
  it('ścieżka bez karencji nigdy nie jest zablokowana', () => {
    expect(isRepeatBlocked(CHAOS, [ended('out-of-chaos', '2026-08-26')], TODAY)).toBe(
      false,
    );
  });

  it('bez historii nie ma czego blokować', () => {
    expect(isRepeatBlocked(COMEBACK, [], TODAY)).toBe(false);
  });

  it('blokuje, gdy ta sama ścieżka skończyła się w oknie karencji', () => {
    expect(isRepeatBlocked(COMEBACK, [ended('comeback', '2026-07-01')], TODAY)).toBe(
      true,
    );
  });

  it('nie blokuje po upływie karencji', () => {
    // 2026-06-28 to 60 dni przed 2026-08-27 — karencja właśnie minęła.
    expect(isRepeatBlocked(COMEBACK, [ended('comeback', '2026-06-28')], TODAY)).toBe(
      false,
    );
    expect(isRepeatBlocked(COMEBACK, [ended('comeback', '2026-06-29')], TODAY)).toBe(
      true,
    );
  });

  it('inna ścieżka zakończona wczoraj nie blokuje', () => {
    expect(isRepeatBlocked(COMEBACK, [ended('out-of-chaos', '2026-08-26')], TODAY)).toBe(
      false,
    );
  });

  it('wystarczy jedno zakończenie w oknie, choćby starsze były poza nim', () => {
    const history = [ended('comeback', '2024-01-01'), ended('comeback', '2026-08-01')];

    expect(isRepeatBlocked(COMEBACK, history, TODAY)).toBe(true);
  });
});
