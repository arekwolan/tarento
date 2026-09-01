-- Kontekst rewizji jest transakcyjny. Czyścimy go po całym statement na
-- habits (po wszystkich triggerach row-level), żeby kilka RPC wykonanych w
-- jednej transakcji testowej nie odziedziczyło źródła poprzedniej mutacji.

create or replace function public.clear_habit_revision_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('tarento.habit_revision_source', '', true);
  perform set_config('tarento.habit_revision_reason', '', true);
  perform set_config('tarento.habit_revision_effective_on', '', true);
  perform set_config('tarento.habit_revision_idempotency_key', '', true);
  perform set_config('tarento.habit_revision_restore_id', '', true);
  perform set_config('tarento.habit_revision_fingerprint', '', true);
  return null;
end;
$$;

create trigger habits_clear_revision_context
  after insert or update on public.habits
  for each statement execute function public.clear_habit_revision_context();

-- Zakończenie ma pierwszeństwo przed końcem reentry: jeśli ścieżka kończy
-- się w tygodniu wejściowym, rewizja praktyki ma powód path_end.
create or replace function public.set_habit_revision_context_from_user_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state is distinct from new.state and new.state = 'ended' then
    perform set_config('tarento.habit_revision_source', 'path', true);
    perform set_config('tarento.habit_revision_reason', 'path_end', true);
  elsif old.state = 'active' and new.state = 'paused' then
    perform set_config('tarento.habit_revision_source', 'path', true);
    perform set_config('tarento.habit_revision_reason', 'path_pause', true);
  elsif old.state = 'paused' and new.state = 'active' then
    perform set_config(
      'tarento.habit_revision_source',
      case when new.reentry_until is null then 'restore' else 'reentry' end,
      true
    );
    perform set_config(
      'tarento.habit_revision_reason',
      case when new.reentry_until is null then 'restored' else 'reentry' end,
      true
    );
  elsif old.reentry_until is not null and new.reentry_until is null then
    perform set_config('tarento.habit_revision_source', 'reentry', true);
    perform set_config('tarento.habit_revision_reason', 'reentry_complete', true);
  end if;

  return new;
end;
$$;

revoke all on function public.clear_habit_revision_context() from public;
revoke all on function public.set_habit_revision_context_from_user_path() from public;
revoke all on function public.capture_habit_revision() from public;
