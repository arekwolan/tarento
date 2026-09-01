import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TextField } from '@/components/ui';
import { useDayNote } from '@/features/journal/api/use-day-note';
import { MAX_NOTE_LENGTH } from '@/features/journal/model/day-note';

type NoteInputProps = {
  initial: string;
  onSave: (body: string) => void;
};

function NoteInput({ initial, onSave }: NoteInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);

  return (
    <TextField
      label={t('journal.field.label')}
      placeholder={t('journal.field.placeholder')}
      value={draft}
      onChangeText={setDraft}
      onBlur={() => {
        onSave(draft);
      }}
      maxLength={MAX_NOTE_LENGTH}
      multiline
      numberOfLines={2}
      autoCapitalize="sentences"
    />
  );
}

/**
 * Jedna linia o dziś.
 *
 * Bez podpowiedzi, bez skali nastroju, bez tagów i bez emoji. Zapis idzie przy
 * utracie fokusu, więc nie ma też przycisku „zapisz" — pole ma być jednym
 * gestem na koniec dnia, a nie formularzem.
 *
 * Pole przemontowuje się kluczem, gdy zmienia się wpis w bazie: wczytanie
 * wpisu i przejście doby to jedyne dwie sytuacje, w których treść ma prawo
 * zmienić się nie z klawiatury.
 */
export function DayNoteField() {
  const { body, save } = useDayNote();

  return <NoteInput key={body} initial={body} onSave={save} />;
}
