import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Divider, Text } from '@/components/ui';
import type { Habit } from '@/features/habits/model/habit';

export type RetiredHabitsSectionProps = {
  habits: readonly Habit[];
  isRestoring: boolean;
  onRestore: (habitId: string) => void;
};

/**
 * Nawyki zdjęte z listy.
 *
 * Zwinięta domyślnie: to nie jest gablota z trofeami, tylko miejsce, w którym
 * da się coś odzyskać. Kiedy lista jest pusta, sekcja nie istnieje — pusty
 * stan namawiałby do zdejmowania nawyków, a to ma być decyzja użytkownika,
 * nie sugestia interfejsu.
 */
export function RetiredHabitsSection({
  habits,
  isRestoring,
  onRestore,
}: RetiredHabitsSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  if (habits.length === 0) return null;

  return (
    <Card className="gap-3">
      <Button
        label={t(isOpen ? 'habits.retired.hide' : 'habits.retired.show', {
          count: habits.length,
        })}
        variant="ghost"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => {
          setOpen((current) => !current);
        }}
      />

      {isOpen
        ? habits.map((habit, index) => (
            <View key={habit.id} className="gap-3">
              {index === 0 ? null : <Divider />}
              <Text variant="bodyLg">{habit.title}</Text>
              <Button
                label={t('habits.retired.restore')}
                variant="secondary"
                disabled={isRestoring}
                onPress={() => {
                  onRestore(habit.id);
                }}
              />
            </View>
          ))
        : null}
    </Card>
  );
}
