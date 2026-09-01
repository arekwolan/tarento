import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/theme-provider';

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Gotowe teksty — przekazuj wynik t(), nigdy literał. */
  title: string;
  /** Jedno zdanie. Stan pusty tłumaczy, nie opowiada. */
  description?: string;
  /** Jedno CTA. Więcej niż jedno oznacza, że ekran nie ma głównej akcji. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon = 'leaf-outline',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const { color } = useTheme();

  return (
    <View className={cn('flex-1 items-center justify-center gap-3 py-8', className)}>
      <Ionicons name={icon} size={28} color={color('text-tertiary')} />
      <Text variant="title" className="text-center">
        {title}
      </Text>
      {description === undefined ? null : (
        <Text variant="body" tone="secondary" className="text-center">
          {description}
        </Text>
      )}
      {action === null || action === undefined ? null : (
        <View className="mt-2 self-stretch">{action}</View>
      )}
    </View>
  );
}
