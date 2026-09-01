export { AuthProvider } from '@/features/auth/auth-provider';
export type { AuthContextValue } from '@/features/auth/auth-provider';
export { useAuth } from '@/features/auth/use-auth';
export { useAuthDeepLinks } from '@/features/auth/hooks/use-auth-deep-links';

export {
  deviceTimezone,
  linkEmailToCurrentUser,
  sendMagicLink,
  sendPasswordReset,
  signInAsGuest,
  signInWithPassword,
  signUpWithPassword,
} from '@/features/auth/api/auth-api';
export type { AuthProfile, SignUpOutcome } from '@/features/auth/api/auth-api';

export { isAppleSignInAvailable, signInWithApple } from '@/features/auth/api/apple';

export {
  authErrorKeyOf,
  AuthFailure,
  toAuthErrorKey,
} from '@/features/auth/model/errors';
export type { AuthErrorKey } from '@/features/auth/model/errors';

export {
  forgotPasswordSchema,
  linkEmailSchema,
  magicLinkSchema,
  signInSchema,
  signUpSchema,
} from '@/features/auth/model/schemas';
export type {
  ForgotPasswordValues,
  LinkEmailValues,
  MagicLinkValues,
  SignInValues,
  SignUpValues,
} from '@/features/auth/model/schemas';

export { AccountCard } from '@/features/auth/components/account-card';
export { GuestUpgradeCard } from '@/features/auth/components/guest-upgrade-card';

export { useLogicalToday } from '@/features/auth/hooks/use-logical-today';
