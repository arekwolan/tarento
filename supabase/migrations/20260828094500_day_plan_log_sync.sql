-- Domknięcie kontraktu offline P0.
--
-- Wstrzymana mutacja habit_log może wrócić po restarcie, kiedy ekran starej
-- daty logicznej nie jest już zamontowany. RPC najpierw idempotentnie zapewnia
-- snapshot dnia, a dopiero potem zapisuje log. Kolejność jest atomowa w jednej
-- transakcji Postgresa i nie zależy od wyścigu query kontra mutation.

create or replace function public.upsert_habit_log_for_plan(
  p_habit_id uuid,
  p_log_date date,
  p_status text,
  p_target_value numeric,
  p_value_completed numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.habit_logs%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_status not in ('done', 'partial', 'skipped') then
    raise exception 'invalid habit log status' using errcode = '22023';
  end if;

  if p_target_value < 0 then
    raise exception 'target must be non-negative' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.habits h
    where h.id = p_habit_id
      and h.user_id = v_user_id
  ) then
    raise exception 'habit not found' using errcode = 'P0002';
  end if;

  perform public.ensure_day_plan(p_log_date);

  insert into public.habit_logs (
    habit_id,
    user_id,
    log_date,
    status,
    target_value,
    value_completed,
    note
  ) values (
    p_habit_id,
    v_user_id,
    p_log_date,
    p_status,
    p_target_value,
    p_value_completed,
    p_note
  )
  on conflict (habit_id, log_date) do update
    set
      user_id = excluded.user_id,
      status = excluded.status,
      target_value = excluded.target_value,
      value_completed = excluded.value_completed,
      note = excluded.note,
      completed_at = now()
  returning * into v_log;

  return to_jsonb(v_log);
end;
$$;

comment on function public.upsert_habit_log_for_plan(
  uuid,
  date,
  text,
  numeric,
  numeric,
  text
) is
  'Atomowo zapewnia snapshot dnia i idempotentnie zapisuje habit_log. Używane przez kolejkę offline.';

revoke all on function public.upsert_habit_log_for_plan(
  uuid,
  date,
  text,
  numeric,
  numeric,
  text
) from public;
grant execute on function public.upsert_habit_log_for_plan(
  uuid,
  date,
  text,
  numeric,
  numeric,
  text
) to authenticated, service_role;

