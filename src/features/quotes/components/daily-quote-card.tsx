import { Pressable, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card, Text, usePressClass } from '@/components/ui';
import { trackEvent } from '@/features/analytics';
import type { Quote } from '@/features/quotes/model/quote';
import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/theme-provider';

const ICON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export type DailyQuoteCardProps = {
  quote: Quote;
  isFavorite: boolean;
  onToggleFavorite: (quoteId: string) => void;
};

/**
 * Cytat dnia. Ma być obecny, ale nie ma przejmować ekranu.
 *
 * Jedyne miejsce z krojem szeryfowym: cytaty pochodzą z książek, więc krój
 * niesie znaczenie, a nie dekorację.
 */
export function DailyQuoteCard({
  quote,
  isFavorite,
  onToggleFavorite,
}: DailyQuoteCardProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const pressClass = usePressClass();

  const attribution =
    quote.sourceBook === null ? quote.author : `${quote.author} · ${quote.sourceBook}`;

  const share = () => {
    trackEvent('quote_shared', { quote_id: quote.id, author: quote.author });

    void Share.share({
      message: t('quote.shareMessage', { content: quote.content, author: quote.author }),
    });
  };

  return (
    <Card className="gap-4">
      <Text variant="quote">{quote.content}</Text>

      <View className="flex-row items-center justify-between gap-4">
        <Text variant="caption" tone="tertiary" className="flex-1">
          {attribution}
        </Text>

        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(isFavorite ? 'quote.unfavorite' : 'quote.favorite')}
            accessibilityState={{ selected: isFavorite }}
            hitSlop={ICON_HIT_SLOP}
            onPress={() => {
              onToggleFavorite(quote.id);
            }}
            className={cn('min-h-12 min-w-12 items-center justify-center', pressClass)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? color('text-primary') : color('text-tertiary')}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('quote.share')}
            hitSlop={ICON_HIT_SLOP}
            onPress={share}
            className={cn('min-h-12 min-w-12 items-center justify-center', pressClass)}
          >
            <Ionicons name="share-outline" size={18} color={color('text-tertiary')} />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
