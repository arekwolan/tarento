import { useEffect, useRef } from 'react';

import { useLogicalToday } from '@/features/auth';
import { habitKeys } from '@/features/habits';
import { pathKeys } from '@/features/paths/api/keys';
import { restorePathParameters } from '@/features/paths/api/path-actions-api';
import { useActiveUserPath } from '@/features/paths/api/use-active-user-path';
import { needsParameterRestore } from '@/features/paths/model/parameters';
import { queryClient } from '@/lib/query-client';

/**
 * Koniec tygodnia wejściowego.
 *
 * Sprawdzane przy wejściu na ekran „Dziś", tak samo jak przejście etapu —
 * bez crona i bez funkcji brzegowej. Przywrócenie idzie cicho: żadnego
 * toasta, żadnego komunikatu o końcu taryfy ulgowej, bo z punktu widzenia
 * użytkownika żadnej taryfy nie było. Liczby po prostu wracają na swoje
 * miejsce.
 *
 * Gdy ktoś nie otworzy aplikacji przez miesiąc, obniżone parametry przeczekają
 * ten miesiąc — i dobrze: przez ten czas nikt o nic nie prosił.
 */
export function useReentryReconcile(): void {
  const today = useLogicalToday();
  const { userPath } = useActiveUserPath();

  /** Jedno wywołanie na zapis — inwalidacja i tak przyniesie świeży stan. */
  const restored = useRef<string | null>(null);

  useEffect(() => {
    if (userPath === null) return;
    if (!needsParameterRestore(userPath, today)) return;
    if (restored.current === userPath.id) return;

    restored.current = userPath.id;

    void restorePathParameters(userPath.id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: habitKeys.all });
        void queryClient.invalidateQueries({ queryKey: pathKeys.all });
      })
      .catch(() => {
        // Bez sieci parametry zostają obniżone do następnego wejścia.
        // To nie jest stan błędny, tylko odłożony.
        restored.current = null;
      });
  }, [userPath, today]);
}
