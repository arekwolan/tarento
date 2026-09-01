import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Banner, Button, OptionCard, Skeleton, Text, TextField } from '@/components/ui';
import { MAX_INTENT_LENGTH } from '@/features/ai-plan/api/suggest-habit-api';
import { useSuggestHabit } from '@/features/ai-plan/api/use-suggest-habit';
import { toHabitFormValues } from '@/features/ai-plan/model/plan';
import { suggestionMinutes } from '@/features/ai-plan/model/suggestion';
import type { HabitFormValues } from '@/features/habits/model/habit-form';
import { useIsOnline } from '@/lib/network';
import { useTheme } from '@/theme/theme-provider';

export type IntentSuggestionsProps = {
  /** Dostaje gotowe wartości formularza. Nic się przy tym nie zapisuje. */
  onSelect: (values: HabitFormValues) => void;
};

/**
 * Zamiar → praktyka.
 *
 * Jedno zdanie zamienia się w od jednej do trzech kandydatek. Wybór karty
 * WYPEŁNIA FORMULARZ i nic poza tym: użytkownik widzi wszystkie pola i może
 * je zmienić przed zapisem. Zapis jednym dotknięciem nie istnieje i nie ma
 * powstać przy żadnej późniejszej zmianie tego pliku.
 */
export function IntentSuggestions({ onSelect }: IntentSuggestionsProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const isOnline = useIsOnline();
  const { candidates, status, remaining, isSuggesting, errorKey, suggest, markAccepted } =
    useSuggestHabit();

  const [intent, setIntent] = useState('');
  const [isApplied, setIsApplied] = useState(false);

  const canAsk = intent.trim() !== '' && isOnline && !isSuggesting;

  const ask = () => {
    setIsApplied(false);
    void suggest(intent);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2 self-start rounded-full border border-border bg-surface-sunken px-3 py-1">
        <Ionicons name="sparkles-outline" size={12} color={color('text-tertiary')} />
        <Text variant="label" tone="tertiary">
          {t('aiPlan.badge')}
        </Text>
      </View>

      <TextField
        label={t('aiPlan.suggest.label')}
        placeholder={t('aiPlan.suggest.placeholder')}
        value={intent}
        onChangeText={setIntent}
        maxLength={MAX_INTENT_LENGTH}
        multiline
        numberOfLines={2}
        autoCapitalize="sentences"
        hint={t('aiPlan.suggest.hint')}
      />

      <Button
        label={isSuggesting ? t('aiPlan.suggest.pending') : t('aiPlan.suggest.action')}
        variant="secondary"
        loading={isSuggesting}
        disabled={!canAsk}
        onPress={ask}
      />

      {/*
        Ton informacyjny, nie `danger`: żaden z tych komunikatów nie jest
        awarią. Formularz stoi obok i działa bez modelu, a czerwień zostaje
        dla akcji niszczących (CLAUDE.md, reguła 7).
      */}
      {!isOnline ? <Banner message={t('aiPlan.suggest.errors.offline')} /> : null}
      {errorKey === null || !isOnline ? null : <Banner message={t(errorKey)} />}

      {isSuggesting ? (
        <View
          className="gap-3"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </View>
      ) : null}

      {status === 'out_of_scope' ? (
        <Text variant="body" tone="secondary">
          {t('aiPlan.suggest.outOfScope')}
        </Text>
      ) : null}

      {status === 'unclear' ? (
        <Text variant="body" tone="secondary">
          {t('aiPlan.suggest.unclear')}
        </Text>
      ) : null}

      {candidates.map((item, index) => (
        <OptionCard
          key={`${item.title}-${index}`}
          accessibilityRole="button"
          title={item.title}
          description={
            item.rationale === ''
              ? t('aiPlan.suggest.estimate', { minutes: suggestionMinutes(item) })
              : `${item.rationale} ${t('aiPlan.suggest.estimate', {
                  minutes: suggestionMinutes(item),
                })}`
          }
          onPress={() => {
            markAccepted();
            setIsApplied(true);
            onSelect(toHabitFormValues(item));
          }}
        />
      ))}

      {isApplied ? (
        <Text variant="caption" tone="secondary">
          {t('aiPlan.suggest.applied')}
        </Text>
      ) : null}

      {remaining === null || candidates.length === 0 ? null : (
        <Text variant="num" tone="tertiary">
          {t('aiPlan.suggest.remaining', { remaining })}
        </Text>
      )}
    </View>
  );
}
