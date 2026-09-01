import type { ViewStyle } from 'react-native';

import { resolveColor, resolveColorAlpha, type ColorScheme } from '@/theme/palette';

/**
 * Głębia.
 *
 * Hierarchia nie wynika z kresek. W motywie ciemnym niosą ją płaszczyzny
 * tonalne (`surface` → `surface-elevated`) plus jedna świetlna krawędź górna,
 * czyli to samo, co robi światło padające na uniesiony przedmiot. W jasnym
 * niesie ją płaszczyzna plus miękki cień, bo biała krawędź na białym tle jest
 * niewidoczna.
 *
 * Obrys zostaje wyjątkiem: karta go dostaje wyłącznie w wariancie `outlined`,
 * gdzie naprawdę coś znaczy.
 */
export type ElevationLevel = 'card' | 'raised' | 'sheet';

/**
 * Krycie świetlnej krawędzi.
 *
 * Wartości siedzą tutaj, a nie w nazwie klasy, bo są systemowe i muszą dać się
 * zaimportować do testu kontrastu. Sufit to 0.12 — powyżej krawędź przestaje
 * być światłem, a zaczyna być obrysem, czyli dokładnie tym, od czego uciekamy.
 */
export const EDGE_ALPHA: Record<ElevationLevel, number> = {
  card: 0.06,
  raised: 0.09,
  sheet: 0.09,
};

const SHADOW: Record<ElevationLevel, ViewStyle> = {
  card: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  sheet: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
};

/**
 * Cień płaszczyzny.
 *
 * Motyw ciemny dostaje cień wyłącznie pod arkuszem i toastem: te unoszą się
 * nad dowolną treścią i bez cienia ich górna krawędź ginie w ciemnym tle.
 * Karta w ciemnym nadal nie rzuca cienia — cień na grafitowym tle i tak jest
 * niewidoczny, a na Androidzie `elevation` dokłada jasną poświatę, która
 * rozjaśnia płaszczyznę. Dlatego w ciemnym `elevation` zostaje na zerze
 * i cień pokazuje się tylko na iOS.
 */
export function elevation(scheme: ColorScheme, level: ElevationLevel): ViewStyle {
  const shadowColor = resolveColor(scheme, 'scrim');

  if (scheme === 'dark') {
    return level === 'sheet'
      ? {
          shadowColor,
          // Do góry, bo arkusz wychodzi od dołu ekranu i tylko jego górna
          // krawędź w ogóle jest widoczna.
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.45,
          shadowRadius: 20,
          elevation: 0,
        }
      : {};
  }

  return { shadowColor, ...SHADOW[level] };
}

/**
 * Świetlna krawędź górna.
 *
 * Jedyna kreska, jaka zostaje na płaszczyźnie w motywie ciemnym — i nie jest
 * obrysem, tylko odbiciem światła na górnej krawędzi. W jasnym motywie biel na
 * bieli nic nie rysuje, więc zwracamy pusty styl zamiast udawać, że coś robi.
 */
export function edgeHighlight(scheme: ColorScheme, level: ElevationLevel): ViewStyle {
  if (scheme === 'light') return {};

  return {
    borderTopWidth: 1,
    borderTopColor: resolveColorAlpha(scheme, 'edge', EDGE_ALPHA[level]),
  };
}
