import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';
import { IntentSuggestions } from '@/features/ai-plan';
import {
  DEFAULT_HABIT_FORM,
  useSaveHabit,
  type HabitFormValues,
} from '@/features/habits';
import { HabitForm } from '@/features/habits/components/habit-form';
import { toFormValuesFromTemplate, useHabitTemplates } from '@/features/templates';
import { AcceptedRuleContext } from '@/features/self-knowledge';
import { useTheme } from '@/theme/theme-provider';

/**
 * Nowy nawyk.
 *
 * Trzy drogi do tych samych pól: pusty formularz, szablon z biblioteki
 * (`templateId` w adresie) i podpowiedź modelu z jednego zdania. Wszystkie
 * kończą się tak samo — użytkownik przechodzi przez wszystkie kroki i może
 * zmienić każdą wartość, zanim cokolwiek powstanie.
 */
export default function NewHabitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { templates, isLoading } = useHabitTemplates();
  const { create, isPending, error } = useSaveHabit();

  // Wartości startowe wchodzą do useForm tylko przy montowaniu, więc podpowiedź
  // nie nadpisuje pól przez ref — przemontowuje formularz kluczem. Prostsze
  // i pewniejsze niż reset() na cudzym stanie, a użytkownik i tak nie zdążył
  // niczego wpisać: kartę wybiera się przed wypełnianiem, nie po.
  const [suggestion, setSuggestion] = useState<HabitFormValues | null>(null);
  const [formKey, setFormKey] = useState(0);

  const wantsTemplate = typeof templateId === 'string' && templateId !== '';
  const template = templates.find((candidate) => candidate.id === templateId);

  if (wantsTemplate && isLoading) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color('text-secondary')} />
        </View>
      </Screen>
    );
  }

  const templateValues =
    template === undefined ? DEFAULT_HABIT_FORM : toFormValuesFromTemplate(template);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <Text variant="titleLg" accessibilityRole="header">
        {t('habits.new.title')}
      </Text>

      <IntentSuggestions
        onSelect={(values) => {
          setSuggestion(values);
          setFormKey((current) => current + 1);
        }}
      />

      <HabitForm
        key={formKey}
        initialValues={suggestion ?? templateValues}
        submitLabel={t('habits.form.save')}
        isSubmitting={isPending}
        errorMessage={error === null ? undefined : t('habits.form.saveError')}
        previewContext={<AcceptedRuleContext />}
        onCancel={() => {
          router.back();
        }}
        onSubmit={(values) => {
          void create(values, { fromTemplate: template !== undefined }).then((habit) => {
            if (habit !== null) router.back();
          });
        }}
      />
    </Screen>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/components/route-error-boundary';
