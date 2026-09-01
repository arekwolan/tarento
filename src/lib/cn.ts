import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge nie zna naszych skal, więc bez tego `text-body` (rozmiar)
 * i `text-primary` (kolor) trafiłyby do tej samej grupy i jedna z klas
 * zostałaby po cichu wyrzucona.
 *
 * Listy muszą odpowiadać tailwind.config.js. Nowy wariant typografii albo nowy
 * token koloru tekstu dopisujemy tutaj w tym samym commicie.
 */
const twMerge = extendTailwindMerge({
  override: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'title-lg',
            'title',
            'body-lg',
            'body',
            'caption',
            'label',
            'quote',
            'num-lg',
            'num',
          ],
        },
      ],
      'text-color': [
        {
          text: [
            'primary',
            'secondary',
            'tertiary',
            'text-primary',
            'text-secondary',
            'text-tertiary',
            'accent',
            'accent-strong',
            'accent-fill',
            'on-accent',
            'action',
            'on-action',
            'success',
            'warning',
            'danger',
          ],
        },
      ],
      'font-family': [
        {
          font: ['sans', 'sans-medium', 'sans-semibold', 'serif', 'serif-italic', 'mono'],
        },
      ],
      tracking: [{ tracking: ['display', 'title-lg', 'title', 'normal', 'label'] }],
    },
  },
});

/** Łączy klasy i rozstrzyga konflikty na korzyść ostatniej. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
