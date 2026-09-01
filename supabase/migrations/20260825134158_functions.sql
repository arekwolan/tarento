-- Funkcje domenowe wołane z klienta przez RPC.

-- Seria dni ---------------------------------------------------------------
--
-- Zasady liczenia (instrukcja ich nie rozstrzygała, więc ustalone tutaj):
--   * 'done' i 'partial'          — przedłużają serię
--   * 'skipped'                   — nie przerywa serii, ale jej nie przedłuża
--   * dzień z harmonogramu bez wpisu — przerywa serię
--   * dzień spoza harmonogramu    — neutralny, nie przerywa
--   * dzisiaj bez wpisu           — neutralne, doba jeszcze trwa
--
-- security invoker: bez własnego nawyku SELECT nic nie zwróci przez RLS.
create or replace function public.get_habit_streak(p_habit_id uuid)
returns table (current_streak integer, longest_streak integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_habit public.habits%rowtype;
  v_day date;
  v_status text;
  v_running integer := 0;
  v_longest integer := 0;
begin
  select * into v_habit
  from public.habits
  where id = p_habit_id;

  if not found then
    current_streak := 0;
    longest_streak := 0;
    return next;
    return;
  end if;

  for v_day in
    select generate_series(v_habit.started_on, current_date, interval '1 day')::date
  loop
    if not public.habit_is_scheduled_on(
      v_habit.schedule_type, v_habit.schedule_days, v_day
    ) then
      continue;
    end if;

    select l.status into v_status
    from public.habit_logs l
    where l.habit_id = p_habit_id
      and l.log_date = v_day;

    if v_status in ('done', 'partial') then
      v_running := v_running + 1;
      if v_running > v_longest then
        v_longest := v_running;
      end if;
    elsif v_status = 'skipped' then
      null;
    elsif v_day = current_date then
      null;
    else
      v_running := 0;
    end if;
  end loop;

  current_streak := v_running;
  longest_streak := v_longest;
  return next;
end;
$$;

comment on function public.get_habit_streak(uuid) is
  'Zwraca (current_streak, longest_streak) dla nawyku, z uwzględnieniem
   harmonogramu. Dzień spoza harmonogramu nie przerywa serii.';

revoke all on function public.get_habit_streak(uuid) from public;
grant execute on function public.get_habit_streak(uuid) to authenticated;

-- Kasowanie konta ---------------------------------------------------------
--
-- Jedyne miejsce w schemacie, gdzie kasujemy fizycznie. CLAUDE.md reguła 4
-- (archived_at zamiast DELETE) dotyczy zwykłej pracy z danymi; usunięcie
-- konta musi faktycznie usuwać dane — wymóg App Store i RODO.
--
-- security definer, bo klient nie ma i nie powinien mieć praw do auth.users.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'delete_user_account: brak zalogowanego użytkownika'
      using errcode = '28000';
  end if;

  delete from public.ai_generations where user_id = v_user_id;
  delete from public.quote_favorites where user_id = v_user_id;
  delete from public.daily_quotes where user_id = v_user_id;
  delete from public.habit_logs where user_id = v_user_id;
  delete from public.habits where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

comment on function public.delete_user_account() is
  'Kasuje konto wywołującego wraz ze wszystkimi jego danymi.';

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;

grant execute on function public.get_habit_streak(uuid) to service_role;
grant execute on function public.delete_user_account() to service_role;
