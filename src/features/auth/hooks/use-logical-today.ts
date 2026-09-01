import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { getLogicalToday, nowMs, resolveTimeZone, type IsoDate } from '@/lib/date';

/** Ta sama wartość co domyślna w kolumnie profiles.day_start_hour. */
const DEFAULT_DAY_START_HOUR = 4;
const TICK_INTERVAL_MS = 60_000;

/**
 * Dzień, który dla użytkownika jest „dzisiaj", liczony z jego strefy
 * i godziny startu doby.
 *
 * Odświeża się w tle, żeby aplikacja otwarta o 3:58 sama przeszła na nowy
 * dzień o 4:00 — bez tego lista zostałaby na wczorajszej dobie do restartu.
 * Stan zmienia się tylko wtedy, gdy zmienia się data, więc minutnik nie
 * wywołuje renderów co minutę.
 */
export function useLogicalToday(): IsoDate {
  const { profile } = useAuth();

  const timeZone = resolveTimeZone(profile?.timezone);
  const dayStartHour = profile?.dayStartHour ?? DEFAULT_DAY_START_HOUR;

  const [instant, setInstant] = useState(nowMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setInstant((previous) => {
        const current = nowMs();
        return getLogicalToday(timeZone, dayStartHour, current) ===
          getLogicalToday(timeZone, dayStartHour, previous)
          ? previous
          : current;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [timeZone, dayStartHour]);

  return useMemo(
    () => getLogicalToday(timeZone, dayStartHour, instant),
    [timeZone, dayStartHour, instant],
  );
}
