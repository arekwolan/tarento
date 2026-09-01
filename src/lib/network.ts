import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Czy jest połączenie.
 *
 * Czytamy z onlineManagera, a nie wprost z NetInfo, żeby ekran pokazywał ten
 * sam stan, którym kieruje się kolejka mutacji — inaczej banner „offline"
 * mógłby się rozjechać z tym, czy żądania faktycznie lecą.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  return isOnline;
}
