import { useEffect } from 'react';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { reportError } from '@/features/analytics';
import { FONT_FAMILY } from '@/theme/font-families';
import { palette, type ColorToken } from '@/theme/palette';
import { radii } from '@/theme/radii';
import { space } from '@/theme/spacing';
import { textMetrics } from '@/theme/typography';

/**
 * Ekran awaryjny trasy.
 *
 * Świadomie nie korzysta z ThemeProvider ani z żadnego innego kontekstu
 * aplikacji: błąd mógł wywalić się właśnie w drzewie providerów, a wtedy
 * komponent sięgający po kontekst poszedłby na dno razem z nim i użytkownik
 * zobaczyłby białą kartkę. Kolory bierzemy wprost z palety, motyw z systemu,
 * style ze zwykłych obiektów zamiast z klas.
 *
 * To jedyne miejsce w aplikacji, w którym wolno budować style ręcznie —
 * i nawet tutaj wartości pochodzą z tokenów, nie z liczb wpisanych na oko.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const color = (token: ColorToken) => `rgb(${palette[scheme][token]})`;

  useEffect(() => {
    reportError(error, { boundary: 'route' });
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: color('background') }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(4),
          padding: space(5),
        }}
      >
        <Ionicons name="cloud-offline-outline" size={28} color={color('text-tertiary')} />

        <Text
          allowFontScaling
          accessibilityRole="header"
          style={{
            color: color('text-primary'),
            fontFamily: FONT_FAMILY['sans-semibold'],
            fontSize: textMetrics.title.fontSize,
            lineHeight: textMetrics.title.lineHeight,
            letterSpacing: textMetrics.title.letterSpacing,
            textAlign: 'center',
          }}
        >
          {t('errors.route.title')}
        </Text>

        <Text
          allowFontScaling
          style={{
            color: color('text-secondary'),
            fontFamily: FONT_FAMILY.sans,
            fontSize: textMetrics.body.fontSize,
            lineHeight: textMetrics.body.lineHeight,
            textAlign: 'center',
          }}
        >
          {t('errors.route.description')}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('errors.route.retry')}
          onPress={() => {
            void retry();
          }}
          style={{
            backgroundColor: color('action'),
            borderRadius: radii.sm,
            paddingHorizontal: space(6),
            paddingVertical: space(3),
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text
            allowFontScaling
            style={{
              color: color('on-action'),
              fontFamily: FONT_FAMILY['sans-medium'],
              fontSize: textMetrics.label.fontSize,
              lineHeight: textMetrics.label.lineHeight,
              letterSpacing: textMetrics.label.letterSpacing,
            }}
          >
            {t('errors.route.retry')}
          </Text>
        </Pressable>

        {/* Szczegóły techniczne tylko w buildzie deweloperskim. */}
        {__DEV__ ? (
          <Text
            allowFontScaling
            style={{
              color: color('text-tertiary'),
              fontFamily: FONT_FAMILY.mono,
              fontSize: textMetrics.num.fontSize,
              lineHeight: textMetrics.num.lineHeight,
              textAlign: 'center',
            }}
          >
            {error.message}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
