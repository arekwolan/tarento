import { z } from 'zod';

import type { ValidationMessageKey } from '@/features/auth/model/validation-messages';

/**
 * Schematy formularzy auth. Komunikaty to klucze i18n — tłumaczy je dopiero
 * komponent, żeby zod nie musiał znać języka interfejsu.
 */
const MESSAGE = {
  emailRequired: 'auth.validation.emailRequired',
  emailInvalid: 'auth.validation.emailInvalid',
  passwordRequired: 'auth.validation.passwordRequired',
  passwordTooShort: 'auth.validation.passwordTooShort',
  passwordTooLong: 'auth.validation.passwordTooLong',
  passwordsDoNotMatch: 'auth.validation.passwordsDoNotMatch',
} as const satisfies Record<string, ValidationMessageKey>;

const email = z
  .string()
  .trim()
  .min(1, { message: MESSAGE.emailRequired })
  .email({ message: MESSAGE.emailInvalid });

// 72 bajty to limit bcrypt po stronie Supabase — dłuższe hasło zostałoby ucięte.
const password = z
  .string()
  .min(8, { message: MESSAGE.passwordTooShort })
  .max(72, { message: MESSAGE.passwordTooLong });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { message: MESSAGE.passwordRequired }),
});

export const signUpSchema = z
  .object({
    email,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: MESSAGE.passwordsDoNotMatch,
  });

export const magicLinkSchema = z.object({ email });
export const forgotPasswordSchema = z.object({ email });
export const linkEmailSchema = z.object({ email, password });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type MagicLinkValues = z.infer<typeof magicLinkSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type LinkEmailValues = z.infer<typeof linkEmailSchema>;
