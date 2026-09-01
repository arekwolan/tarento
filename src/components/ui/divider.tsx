import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Włosowy separator.
 *
 * `hairline`, nie `border`: to nie jest obrys niosący znaczenie, tylko kreska
 * rozdzielająca dwie rzeczy na tej samej płaszczyźnie.
 */
export function Divider({ className, ...rest }: ViewProps) {
  return (
    <View
      accessibilityRole="none"
      className={cn('h-px w-full bg-hairline', className)}
      {...rest}
    />
  );
}
