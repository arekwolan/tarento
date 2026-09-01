import { getCalendars } from 'expo-localization';
import type { Session, User } from '@supabase/supabase-js';

import { authRedirectUrl } from '@/features/auth/api/redirect';
import { AuthFailure } from '@/features/auth/model/errors';
import { supabase } from '@/lib/supabase';

/** Podzbiór profilu potrzebny do routingu i ustawień. */
export type AuthProfile = {
  id: string;
  displayName: string | null;
  timezone: string;
  dayStartHour: number;
  locale: string;
  /** Ile pozycji maksymalnie widać na liście „Dziś". */
  dailyCeiling: number;
  onboardingCompletedAt: string | null;
};

/** Rezultat rejestracji: czy trzeba jeszcze kliknąć w link z maila. */
export type SignUpOutcome = { needsEmailConfirmation: boolean };

function fail(error: unknown): never {
  throw new AuthFailure(error);
}

// Logowanie ------------------------------------------------------------------

export async function signInWithPassword(email: string, password: string): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<SignUpOutcome> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error !== null) fail(error);

    return { needsEmailConfirmation: data.session === null };
  } catch (error) {
    fail(error);
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
    });
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl(),
    });
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

/**
 * Tryb gościa. Zakłada prawdziwe konto anonimowe w auth.users, więc trigger
 * handle_new_user() tworzy profil i wszystkie dane zapisują się normalnie.
 * Gość może później podpiąć maila przez linkEmailToCurrentUser() bez utraty
 * czegokolwiek — to ten sam wiersz w auth.users.
 */
export async function signInAsGuest(): Promise<void> {
  try {
    const { error } = await supabase.auth.signInAnonymously();
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

/**
 * Podpięcie maila i hasła do bieżącego konta — ścieżka wyjścia z trybu gościa.
 * Hasło ustawia się od razu, adres dopiero po kliknięciu w link z maila.
 * Konto zostaje to samo, więc nawyki i historia zostają.
 */
export async function linkEmailToCurrentUser(
  email: string,
  password: string,
): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser(
      { email, password },
      { emailRedirectTo: authRedirectUrl() },
    );
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

// Wylogowanie i kasowanie konta ----------------------------------------------

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

/**
 * Kasuje konto wraz z danymi (funkcja SECURITY DEFINER po stronie bazy).
 * Sesję czyścimy lokalnie — po usunięciu użytkownika serwerowy signOut
 * i tak zwróciłby błąd, bo nie ma już czego unieważniać.
 */
export async function deleteAccount(): Promise<void> {
  try {
    const { error } = await supabase.rpc('delete_user_account');
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }

  await supabase.auth.signOut({ scope: 'local' });
}

// Profil ---------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    // Jeden literał, bez sklejania: PostgREST wyprowadza kształt wiersza
    // z typu tego stringa, a sklejony traci literalność i zostaje `string`.
    .select(
      'id, display_name, timezone, day_start_hour, locale, daily_ceiling, onboarding_completed_at',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error !== null) fail(error);
  if (data === null) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    timezone: data.timezone,
    dayStartHour: data.day_start_hour,
    locale: data.locale,
    dailyCeiling: data.daily_ceiling,
    onboardingCompletedAt: data.onboarding_completed_at,
  };
}

/** Strefa czasowa urządzenia, albo null jeśli system jej nie poda. */
export function deviceTimezone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

/**
 * Ustawia profiles.timezone na strefę urządzenia. Wołane przy każdym
 * zalogowaniu — użytkownik może przecież zmienić strefę między sesjami,
 * a od niej zależy granica doby logicznej.
 *
 * Cichy błąd jest tu w porządku: nieudana synchronizacja strefy nie może
 * blokować wejścia do aplikacji.
 */
export async function syncProfileTimezone(userId: string): Promise<string | null> {
  const timezone = deviceTimezone();
  if (timezone === null) return null;

  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userId)
    .neq('timezone', timezone);

  return error === null ? timezone : null;
}

/** Znacznik stawia zegar serwera (RPC), nie zegar urządzenia. */
export async function completeOnboarding(): Promise<string | null> {
  const { data, error } = await supabase.rpc('complete_onboarding');
  if (error !== null) fail(error);

  return data;
}

export type { Session, User };

// Sesja ----------------------------------------------------------------------

/**
 * Subskrypcja zmian sesji. Zwraca funkcję odsubskrybowania.
 *
 * Callback nie może wołać innych metod supabase-js — biblioteka ostrzega
 * przed zakleszczeniem. Pobieranie danych rób w reakcji na zmianę stanu,
 * a nie w środku tego wywołania.
 */
export function subscribeToAuthState(
  onChange: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

/** Sesja zapisana w storage, po ewentualnym odświeżeniu tokenu. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error !== null) fail(error);

  return data.session;
}

/** Domyka przepływ PKCE: kod z linku w mailu wymienia na sesję. */
export async function exchangeAuthCode(code: string): Promise<void> {
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

/** Starszy przepływ: tokeny przychodzą wprost we fragmencie adresu. */
export async function restoreSessionFromTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error !== null) fail(error);
  } catch (error) {
    fail(error);
  }
}

// Ustawienia profilu ---------------------------------------------------------

export type ProfileSettingsInput = {
  locale?: string;
  dayStartHour?: number;
  dailyCeiling?: number;
};

/**
 * Zapisuje ustawienia profilu.
 *
 * `day_start_hour` ma w bazie CHECK 0–12, a `daily_ceiling` 1–12; przycinamy
 * po stronie klienta, żeby kontrolka nie potrafiła wygenerować odrzuconego
 * zapisu.
 */
export async function updateProfileSettings(
  userId: string,
  input: ProfileSettingsInput,
): Promise<void> {
  const patch: { locale?: string; day_start_hour?: number; daily_ceiling?: number } = {};
  if (input.locale !== undefined) patch.locale = input.locale;
  if (input.dayStartHour !== undefined) {
    patch.day_start_hour = Math.min(12, Math.max(0, Math.trunc(input.dayStartHour)));
  }
  if (input.dailyCeiling !== undefined) {
    patch.daily_ceiling = Math.min(12, Math.max(1, Math.trunc(input.dailyCeiling)));
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error !== null) fail(error);
}
