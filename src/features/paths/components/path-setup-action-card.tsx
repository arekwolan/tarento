import { Button, Card, Skeleton, Text } from '@/components/ui';
import type { PathSetupAction } from '@/features/paths/model/setup-action';
import { useTranslation } from 'react-i18next';

export type PathSetupActionCardProps = {
  action: PathSetupAction;
  isPending: boolean;
  onComplete: (action: PathSetupAction) => void;
  onDismiss: (action: PathSetupAction) => void;
};

/** Jednorazowy krok przed praktyką — bez celu, serii i gestu odhaczania nawyku. */
export function PathSetupActionCard({
  action,
  isPending,
  onComplete,
  onDismiss,
}: PathSetupActionCardProps) {
  const { t } = useTranslation();

  return (
    <Card variant="raised" className="gap-3">
      <Text variant="label" tone="secondary">
        {t('path.setup.oneTime')}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {action.title}
      </Text>
      {action.explanation === null ? null : (
        <Text variant="body" tone="secondary">
          {action.explanation}
        </Text>
      )}
      <Text variant="caption" tone="tertiary">
        {t('path.setup.informational')}
      </Text>
      <Button
        label={t('path.setup.complete')}
        disabled={isPending}
        onPress={() => {
          onComplete(action);
        }}
      />
      <Button
        label={t('path.setup.dismiss')}
        variant="ghost"
        disabled={isPending}
        onPress={() => {
          onDismiss(action);
        }}
      />
    </Card>
  );
}

export function PathSetupActionSkeleton() {
  return (
    <Card variant="raised" className="gap-3">
      <Skeleton className="w-36 h-4" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-12 w-full rounded-md" />
    </Card>
  );
}
