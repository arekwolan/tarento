import type { TranslationKey } from '@/i18n/keys';

/**
 * Komunikaty walidacji, które mogą wyjść z zod.
 *
 * `satisfies` pilnuje, żeby każdy z nich istniał w pl.json — literówka
 * w schemacie jest błędem kompilacji, a nie surowym kluczem na ekranie.
 */
const VALIDATION_KEYS = [
  'auth.validation.emailRequired',
  'auth.validation.emailInvalid',
  'auth.validation.passwordRequired',
  'auth.validation.passwordTooShort',
  'auth.validation.passwordTooLong',
  'auth.validation.passwordsDoNotMatch',
] as const satisfies readonly TranslationKey[];

export type ValidationMessageKey = (typeof VALIDATION_KEYS)[number];

/**
 * react-hook-form oddaje `message` jako zwykły string. To jedyne przejście
 * z tamtego świata do typowanych kluczy — nieznana wartość nie przecieka
 * na ekran, tylko ląduje na komunikacie ogólnym.
 */
export function validationMessageKey(
  message: string | undefined,
): TranslationKey | undefined {
  if (message === undefined) return undefined;

  const known = VALIDATION_KEYS.find((key) => key === message);
  return known ?? 'auth.errors.unknown';
}
