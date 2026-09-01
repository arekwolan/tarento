import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Divider, Sheet, Text, TextField } from '@/components/ui';
import type { PracticesDecision } from '@/features/paths/api/path-actions-api';
import type { Path } from '@/features/paths/model/schemas';

export type PathEndSheetProps = {
  /** Ścieżka, która się kończy. `null` zamyka arkusz. */
  path: Path | null;
  /** Zmienia wyłącznie nagłówek. Pytanie o praktyki jest to samo. */
  reason: 'completed' | 'abandoned';
  isPending: boolean;
  onClose: () => void;
  onDecide: (decision: PracticesDecision) => void;
  /** Zapisuje list do siebie za rok. Wołane tylko dla ścieżek, które go mają. */
  onWriteLetter: (body: string) => Promise<boolean>;
};

/**
 * Zamknięcie ścieżki: jedno pytanie i dwie odpowiedzi.
 *
 * Nagłówek jest zdaniem oznajmującym, nie pytaniem — decyzja już zapadła,
 * a arkusz służy do rozstrzygnięcia, co zostaje na liście. Nie ma tu liczby
 * dni, procentu ukończenia ani pytania „dlaczego". Przy zakończeniu z sukcesem
 * nie ma też gratulacji, odznaki ani propozycji kolejnej ścieżki.
 *
 * Ścieżki, które przewidują list do siebie za rok, dostają go jako krok przed
 * pytaniem o praktyki — raz, bez przypominania i bez powiadomienia.
 */
export function PathEndSheet({
  path,
  reason,
  isPending,
  onClose,
  onDecide,
  onWriteLetter,
}: PathEndSheetProps) {
  const { t } = useTranslation();
  const [letter, setLetter] = useState('');
  const [isLetterDone, setLetterDone] = useState(false);
  const [isSavingLetter, setSavingLetter] = useState(false);

  if (path === null) return null;

  const wantsLetter = reason === 'completed' && path.closingLetter && !isLetterDone;

  const title =
    reason === 'completed'
      ? t('path.end.completedTitle', { path: path.title })
      : t('path.end.abandonedTitle');

  const saveLetter = () => {
    setSavingLetter(true);
    void onWriteLetter(letter).then(() => {
      setSavingLetter(false);
      setLetterDone(true);
    });
  };

  return (
    <Sheet visible onClose={onClose} title={title} closeLabel={t('path.end.close')}>
      {reason === 'completed' && path.completionNote !== null ? (
        <Text variant="body" tone="secondary">
          {path.completionNote}
        </Text>
      ) : null}

      {wantsLetter ? (
        <View className="gap-3">
          <Divider />
          <Text variant="title">{t('letter.write.title')}</Text>
          <Text variant="body" tone="secondary">
            {t('letter.write.description')}
          </Text>
          <TextField
            label={t('letter.write.title')}
            placeholder={t('letter.write.placeholder')}
            multiline
            numberOfLines={4}
            value={letter}
            onChangeText={setLetter}
          />
          <Button
            label={t('letter.write.save')}
            size="lg"
            loading={isSavingLetter}
            disabled={letter.trim() === ''}
            onPress={saveLetter}
          />
          <Button
            label={t('letter.write.skip')}
            variant="ghost"
            onPress={() => {
              setLetterDone(true);
            }}
          />
        </View>
      ) : (
        <View className="gap-3">
          <Divider />
          <Text variant="title">{t('path.end.question')}</Text>
          <Button
            label={t('path.end.keep')}
            size="lg"
            loading={isPending}
            onPress={() => {
              onDecide('keep');
            }}
          />
          <Button
            label={t('path.end.remove')}
            variant="secondary"
            disabled={isPending}
            onPress={() => {
              onDecide('remove');
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
