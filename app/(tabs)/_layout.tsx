import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { FONT_FAMILY } from '@/theme/font-families';
import { useTheme } from '@/theme/theme-provider';
import { textMetrics } from '@/theme/typography';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Aktywna zakładka to kontrast, nie kolor — akcent zostaje dla postępu.
        tabBarActiveTintColor: color('text-primary'),
        tabBarInactiveTintColor: color('text-tertiary'),
        tabBarStyle: {
          backgroundColor: color('surface'),
          borderTopColor: color('border'),
        },
        tabBarLabelStyle: {
          fontFamily: FONT_FAMILY['sans-medium'],
          fontSize: textMetrics.label.fontSize,
          letterSpacing: textMetrics.label.letterSpacing,
        },
        sceneStyle: { backgroundColor: color('background') },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon('today-outline') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: t('tabs.stats'), tabBarIcon: tabIcon('stats-chart-outline') }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: t('tabs.library'), tabBarIcon: tabIcon('book-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: tabIcon('ellipsis-horizontal'),
        }}
      />
    </Tabs>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
