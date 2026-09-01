import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import {
  completeOnboarding,
  deleteAccount as deleteAccountRequest,
  fetchProfile,
  getCurrentSession,
  signOut as signOutRequest,
  subscribeToAuthState,
  syncProfileTimezone,
  type AuthProfile,
} from '@/features/auth/api/auth-api';
import { authErrorKeyOf, type AuthErrorKey } from '@/features/auth/model/errors';
import { isGuestSession, readPersistedSessionHint } from '@/features/auth/model/session';
import { clearBookLabLocalDraft } from '@/features/book-lab/api/storage';
import { queryClient } from '@/lib/query-client';

type SessionStatus = 'loading' | 'signed-out' | 'signed-in';
type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Profil trzymamy razem z id użytkownika, do którego należy. Dzięki temu
 * po przelogowaniu stary profil jest od razu nieaktualny (wyliczamy to),
 * zamiast być kasowany osobnym setState w efekcie.
 */
type ProfileState = {
  userId: string;
  status: Extract<ProfileStatus, 'ready' | 'error'>;
  profile: AuthProfile | null;
  errorKey: AuthErrorKey | null;
};

export type AuthContextValue = {
  /** Dopóki true, nie wiadomo jeszcze, dokąd routować — nie renderuj nawigacji. */
  isBootstrapping: boolean;
  session: Session | null;
  user: User | null;
  isSignedIn: boolean;
  /** Konto anonimowe (tryb gościa). */
  isGuest: boolean;
  profile: AuthProfile | null;
  needsOnboarding: boolean;
  /** Błąd tła, np. brak sieci przy pobieraniu profilu. Klucz i18n. */
  errorKey: AuthErrorKey | null;
  refreshProfile: () => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * Synchroniczny odczyt z MMKV. Dzięki temu pierwszy render już wie, że
   * sesja istnieje, i użytkownik nie widzi mignięcia ekranu logowania,
   * zanim supabase-js zdąży wczytać sesję ze storage.
   */
  const [hint] = useState(readPersistedSessionHint);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('loading');
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [profileReloadToken, setProfileReloadToken] = useState(0);

  const timezoneSyncedFor = useRef<string | null>(null);

  useEffect(() => {
    // Pobranie profilu robi efekt niżej — w tym callbacku nie wolno wołać
    // innych metod supabase-js.
    const unsubscribe = subscribeToAuthState((nextSession) => {
      setSession(nextSession);
      setSessionStatus(nextSession === null ? 'signed-out' : 'signed-in');
    });

    // Zapasowo, gdyby INITIAL_SESSION nie doszło (np. odświeżanie tokenu
    // zawiesiło się na braku sieci) — inaczej ekran startowy zostałby na zawsze.
    void getCurrentSession()
      .then((current) => {
        setSession((previous) => previous ?? current);
        setSessionStatus((previous) =>
          previous === 'loading'
            ? current === null
              ? 'signed-out'
              : 'signed-in'
            : previous,
        );
      })
      .catch(() => {
        setSessionStatus((previous) =>
          previous === 'loading' ? 'signed-out' : previous,
        );
      });

    return unsubscribe;
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (userId === null) return;

    let cancelled = false;

    void (async () => {
      try {
        const profile = await fetchProfile(userId);
        if (!cancelled) {
          setProfileState({ userId, status: 'ready', profile, errorKey: null });
        }
      } catch (error) {
        if (!cancelled) {
          setProfileState({
            userId,
            status: 'error',
            profile: null,
            errorKey: authErrorKeyOf(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profileReloadToken]);

  /**
   * Strefa czasowa idzie do bazy przy każdym zalogowaniu — raz na sesję
   * danego użytkownika, nie przy każdym odświeżeniu tokenu.
   */
  useEffect(() => {
    if (userId === null || timezoneSyncedFor.current === userId) return;
    timezoneSyncedFor.current = userId;

    void syncProfileTimezone(userId).then((timezone) => {
      if (timezone === null) return;
      setProfileState((previous) =>
        previous === null || previous.userId !== userId || previous.profile === null
          ? previous
          : { ...previous, profile: { ...previous.profile, timezone } },
      );
    });
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    setProfileReloadToken((token) => token + 1);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    const completedAt = await completeOnboarding();
    setProfileState((previous) =>
      previous === null || previous.profile === null
        ? previous
        : {
            ...previous,
            profile: { ...previous.profile, onboardingCompletedAt: completedAt },
          },
    );
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteAccountRequest();
    if (userId !== null) clearBookLabLocalDraft(userId);
    queryClient.clear();
  }, [userId]);

  const isSignedIn = sessionStatus === 'signed-in';

  // Profil ze starego użytkownika jest nieaktualny z definicji.
  const currentProfileState =
    profileState !== null && profileState.userId === userId ? profileState : null;

  const profileStatus: ProfileStatus =
    userId === null ? 'idle' : (currentProfileState?.status ?? 'loading');

  /**
   * Dopóki nie znamy sesji — czekamy. Gdy sesja jest, czekamy jeszcze na
   * profil, bo to on decyduje o onboardingu.
   *
   * Podpowiedź z MMKV skraca tylko pierwszy etap: gdy w storage leży ważna
   * sesja, od razu wiemy, że nie idziemy na ekran logowania.
   */
  const isBootstrapping =
    (sessionStatus === 'loading' && !(hint !== null && !hint.isExpired)) ||
    (isSignedIn && profileStatus === 'loading');

  /**
   * Gdy profilu nie udało się pobrać (np. offline), nie zaganiamy użytkownika
   * do onboardingu — wpuszczamy do aplikacji, a brak danych pokaże swój własny
   * stan. Powtórny onboarding byłby gorszy niż pusta lista.
   */
  const needsOnboarding =
    isSignedIn &&
    profileStatus === 'ready' &&
    (currentProfileState?.profile?.onboardingCompletedAt ?? null) === null;

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping,
      session,
      user: session?.user ?? null,
      isSignedIn,
      isGuest: isGuestSession(session),
      profile: currentProfileState?.profile ?? null,
      needsOnboarding,
      errorKey: currentProfileState?.errorKey ?? null,
      refreshProfile,
      markOnboardingComplete,
      signOut,
      deleteAccount,
    }),
    [
      isBootstrapping,
      session,
      isSignedIn,
      currentProfileState,
      needsOnboarding,
      refreshProfile,
      markOnboardingComplete,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
