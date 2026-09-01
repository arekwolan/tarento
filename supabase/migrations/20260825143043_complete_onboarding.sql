-- Domknięcie onboardingu.
--
-- Jako RPC, a nie UPDATE z klienta, żeby znacznik stawiał zegar serwera.
-- Zegar urządzenia bywa przestawiony, a od onboarding_completed_at zależy
-- routing przy starcie aplikacji.
create or replace function public.complete_onboarding()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'complete_onboarding: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_user_id
  returning onboarding_completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

comment on function public.complete_onboarding() is
  'Stempluje profiles.onboarding_completed_at zegarem serwera. Idempotentne.';

revoke all on function public.complete_onboarding() from public;
grant execute on function public.complete_onboarding() to authenticated, service_role;
