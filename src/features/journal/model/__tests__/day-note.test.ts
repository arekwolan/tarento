import { pickRecall, recallDates, type DayNote } from '@/features/journal/model/day-note';
import { addDays, type IsoDate } from '@/lib/date';

/**
 * Przywołanie ma wracać najwyżej raz dziennie i zawsze tym samym porządkiem:
 * rok bije kwartał, kwartał bije miesiąc. Dwa wpisy naraz zamieniłyby
 * przypomnienie w kanał.
 */

const TODAY: IsoDate = '2026-06-15';

function note(offset: number, body: string): DayNote {
  return {
    id: `note-${offset}`,
    userId: 'user-1',
    noteDate: addDays(TODAY, -offset),
    body,
    createdAt: '2025-06-15T20:00:00Z',
  };
}

describe('pickRecall', () => {
  it('wybiera rok przed kwartałem i kwartał przed miesiącem', () => {
    const notes = [note(30, 'miesiąc'), note(90, 'kwartał'), note(365, 'rok')];

    expect(pickRecall(notes, TODAY)?.note.body).toBe('rok');
    expect(pickRecall([note(30, 'miesiąc'), note(90, 'kwartał')], TODAY)?.note.body).toBe(
      'kwartał',
    );
    expect(pickRecall([note(30, 'miesiąc')], TODAY)?.note.body).toBe('miesiąc');
  });

  it('oddaje offset razem z wpisem, żeby nagłówek pasował do daty', () => {
    expect(pickRecall([note(90, 'kwartał')], TODAY)?.offset).toBe(90);
  });

  it('nie przywołuje niczego spoza trzech dat', () => {
    expect(
      pickRecall([note(31, 'prawie miesiąc'), note(7, 'tydzień')], TODAY),
    ).toBeNull();
    expect(pickRecall([], TODAY)).toBeNull();
  });
});

describe('recallDates', () => {
  it('daje dokładnie trzy daty, od najstarszej', () => {
    expect(recallDates(TODAY)).toEqual([
      addDays(TODAY, -365),
      addDays(TODAY, -90),
      addDays(TODAY, -30),
    ]);
  });
});
