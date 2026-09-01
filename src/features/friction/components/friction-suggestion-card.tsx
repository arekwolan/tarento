import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '@/components/ui';
import { FRICTION_REASON_KEYS } from '@/features/friction/components/friction-reason-sheet';
import type {
  FrictionSuggestion,
  FrictionSuggestionAction,
} from '@/features/friction/model/friction';
import type { TranslationKey } from '@/i18n/keys';

const ACTION_KEYS: Record<FrictionSuggestionAction, TranslationKey> = {
  reminder: 'friction.suggestion.actions.reminder',
  downshift: 'friction.suggestion.actions.downshift',
  time: 'friction.suggestion.actions.time',
  prepare: 'friction.suggestion.actions.prepare',
  rest: 'friction.suggestion.actions.rest',
};

export type FrictionSuggestionCardProps = {
  suggestion: FrictionSuggestion;
  habitTitle: string;
  isPending: boolean;
  onAction: () => void;
  onDismiss: () => void;
};

export function FrictionSuggestionCard({
  suggestion,
  habitTitle,
  isPending,
  onAction,
  onDismiss,
}: FrictionSuggestionCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Text variant="title">{t('friction.suggestion.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('friction.suggestion.observation', {
          habit: habitTitle,
          reason: t(FRICTION_REASON_KEYS[suggestion.reason]),
          count: suggestion.count,
          days: suggestion.windowDays,
        })}
      </Text>
      <Text variant="caption" tone="tertiary">
        {t('friction.suggestion.neutral')}
      </Text>
      <Button
        label={t(ACTION_KEYS[suggestion.action])}
        variant="secondary"
        disabled={isPending}
        onPress={onAction}
      />
      <Button
        label={t('friction.suggestion.dismiss')}
        variant="ghost"
        disabled={isPending}
        onPress={onDismiss}
      />
    </Card>
  );
}
