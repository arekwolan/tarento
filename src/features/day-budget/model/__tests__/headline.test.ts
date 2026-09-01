import { windowHeadline } from '@/features/day-budget/model/headline';
import type { TimeWindow } from '@/features/day-budget/model/windows';

const WINDOW: TimeWindow = { start: '17:00', end: '17:30', minutes: 30 };

describe('windowHeadline', () => {
  it('dopóki zostaje co najmniej połowa okna, mówi o całości', () => {
    expect(windowHeadline(WINDOW, 30)).toEqual({
      key: 'today.window.total',
      minutes: 30,
    });
    expect(windowHeadline(WINDOW, 15)).toEqual({
      key: 'today.window.total',
      minutes: 30,
    });
  });

  it('poniżej połowy mówi o reszcie', () => {
    expect(windowHeadline(WINDOW, 14)).toEqual({
      key: 'today.window.left',
      minutes: 10,
    });
  });

  it('zaokrągla w dół do pięciu minut, żeby nagłówek nie tykał', () => {
    expect(windowHeadline(WINDOW, 13)?.minutes).toBe(10);
    expect(windowHeadline(WINDOW, 11)?.minutes).toBe(10);
  });

  it('nie pokazuje więcej minut, niż daje okno', () => {
    expect(windowHeadline(WINDOW, 900)).toEqual({
      key: 'today.window.total',
      minutes: 30,
    });
  });

  it('bez okna i po jego wyczerpaniu nie ma linii', () => {
    expect(windowHeadline(null, 30)).toBeNull();
    expect(windowHeadline(WINDOW, 0)).toBeNull();
    expect(windowHeadline(WINDOW, 4)).toBeNull();
  });
});
