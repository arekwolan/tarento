-- P0: trwały plan dnia bez ukrytego długu.
--
-- `day_plans` jest nagłówkiem jednego logicznego dnia, a `day_plan_items`
-- przechowuje dokładny zbiór planned/overflow wraz ze snapshotem celu. Dzięki
-- temu ekran, serie i statystyki nie próbują ponownie odgadywać, co użytkownik
-- miał danego dnia zobaczyć.

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  daily_ceiling smallint not null
    check (daily_ceiling between 1 and 12),
  minute_budget integer
    check (minute_budget is null or minute_budget >= 0),
  timezone text not null,
  day_start_hour smallint not null
    check (day_start_hour between 0 and 23),
  is_rest boolean not null default false,
  is_quiet_week boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date),
  unique (id, user_id)
);

comment on table public.day_plans is
  'Trwały snapshot planu jednej daty logicznej. Jeden wiersz na użytkownika i dzień.';
comment on column public.day_plans.minute_budget is
  'Snapshot stabilnego okna dnia w minutach. NULL oznacza brak skonfigurowanego budżetu.';
comment on column public.day_plans.is_rest is
  'Snapshot/reconciled flag dnia odpoczynku. W takim dniu pozycje są neutralnym overflow.';
comment on column public.day_plans.is_quiet_week is
  'Snapshot/reconciled flag quiet week. Niewykonane pozycje są wtedy neutralne.';

create index day_plans_user_id_plan_date_idx
  on public.day_plans (user_id, plan_date desc);

create trigger day_plans_set_updated_at
  before update on public.day_plans
  for each row execute function public.set_updated_at();

create table public.day_plan_items (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid not null,
  user_id uuid not null,
  habit_id uuid not null references public.habits (id) on delete cascade,
  plan_state text not null
    check (plan_state in ('planned', 'overflow')),
  reason text not null check (
    reason in (
      'within_limit',
      'daily_ceiling',
      'minute_budget',
      'rest',
      'quiet_week',
      'retired',
      'archived',
      'schedule_changed',
      'legacy_fallback'
    )
  ),
  sort_order integer not null,
  target_value numeric not null check (target_value >= 0),
  estimated_minutes numeric not null check (estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_plan_items_plan_owner_fkey
    foreign key (day_plan_id, user_id)
    references public.day_plans (id, user_id)
    on delete cascade,
  unique (day_plan_id, habit_id)
);

comment on table public.day_plan_items is
  'Snapshot pozycji dnia. planned tworzy oczekiwaną okazję; niewykonany overflow jest neutralny.';
comment on column public.day_plan_items.reason is
  'Jawny powód klasyfikacji. Nigdy nie jest zapisywany jako status skipped w habit_logs.';
comment on column public.day_plan_items.target_value is
  'Cel obowiązujący w planie tego dnia, niezależny od późniejszej edycji nawyku.';

create index day_plan_items_user_id_habit_id_idx
  on public.day_plan_items (user_id, habit_id);
create index day_plan_items_plan_state_idx
  on public.day_plan_items (day_plan_id, plan_state, sort_order);

create trigger day_plan_items_set_updated_at
  before update on public.day_plan_items
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------

alter table public.day_plans enable row level security;

create policy "day_plans_select_own"
  on public.day_plans for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.day_plan_items enable row level security;

create policy "day_plan_items_select_own"
  on public.day_plan_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Klient może tylko czytać snapshoty. Tworzenie i rekoncyliacja przechodzą
-- przez ensure_day_plan(), więc nie da się samodzielnie zmienić overflow na
-- planned ani odwrotnie.
revoke all on public.day_plans from anon, authenticated;
grant all on public.day_plans to service_role;
grant select on public.day_plans to authenticated;

revoke all on public.day_plan_items from anon, authenticated;
grant all on public.day_plan_items to service_role;
grant select on public.day_plan_items to authenticated;

-- Wspólna definicja neutralnych dni -----------------------------------------

create or replace function public.day_is_rest(p_user_id uuid, p_day date)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.rest_days r
    where r.user_id = p_user_id
      and (
        r.rest_date = p_day
        or r.weekday = extract(dow from p_day)::smallint
      )
  );
$$;

comment on function public.day_is_rest(uuid, date) is
  'Czy wskazana data jest jednorazowym albo cyklicznym dniem odpoczynku użytkownika.';

create or replace function public.day_is_quiet(p_user_id uuid, p_day date)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiet_weeks q
    join public.profiles p on p.id = q.user_id
    where q.user_id = p_user_id
      and p_day between q.started_on and q.ends_on
      and (
        q.ended_early_at is null
        or (q.ended_early_at at time zone p.timezone)::date > p_day
      )
  );
$$;

comment on function public.day_is_quiet(uuid, date) is
  'Czy data leży w aktywnej części quiet week. Dni przed wcześniejszym zakończeniem pozostają historycznie neutralne.';

revoke all on function public.day_is_rest(uuid, date) from public;
grant execute on function public.day_is_rest(uuid, date) to authenticated, service_role;
revoke all on function public.day_is_quiet(uuid, date) from public;
grant execute on function public.day_is_quiet(uuid, date) to authenticated, service_role;

-- Jedno źródło prawdy oczekiwanej okazji -----------------------------------
--
-- Dla dat ze snapshotem:
--   * planned jest oczekiwane;
--   * overflow staje się okazją tylko po done/partial (pozytywny bonus);
--   * skipped w overflow pozostaje neutralne.
-- Dla starych dat bez snapshotu zachowujemy harmonogram/retirement jako
-- kompatybilny fallback. Rest i quiet week są neutralne, a wykonanie poza
-- obowiązkiem nadal jest pozytywną okazją.

create or replace function public.get_expected_habit_opportunities(
  p_from date,
  p_to date
)
returns table (habit_id uuid, day date, outcome text)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
    where p_to >= p_from
  ),
  snapshotted as (
    select
      i.habit_id,
      p.plan_date as day,
      case
        when l.status in ('done', 'partial') then 'completed'
        when l.status = 'skipped' then 'skipped'
        else 'pending'
      end as outcome
    from public.day_plans p
    join public.day_plan_items i on i.day_plan_id = p.id
    left join public.habit_logs l
      on l.habit_id = i.habit_id
     and l.log_date = p.plan_date
    where p.user_id = (select auth.uid())
      and p.plan_date between p_from and p_to
      and (
        (
          i.plan_state = 'planned'
          and not p.is_rest
          and not p.is_quiet_week
        )
        or l.status in ('done', 'partial')
      )
  ),
  legacy as (
    select
      h.id as habit_id,
      d.day,
      case
        when l.status in ('done', 'partial') then 'completed'
        when l.status = 'skipped' then 'skipped'
        else 'pending'
      end as outcome
    from days d
    join public.habits h
      on h.user_id = (select auth.uid())
     and h.archived_at is null
    left join public.habit_logs l
      on l.habit_id = h.id
     and l.log_date = d.day
    where not exists (
        select 1
        from public.day_plans p
        where p.user_id = h.user_id
          and p.plan_date = d.day
      )
      and (
        l.status in ('done', 'partial')
        or (
          h.started_on <= d.day
          and (
            h.retired_at is null
            or d.day <= (h.retired_at at time zone 'UTC')::date
          )
          and public.habit_is_scheduled_on(
            h.schedule_type,
            h.schedule_days,
            d.day
          )
          and not public.day_is_rest(h.user_id, d.day)
          and not public.day_is_quiet(h.user_id, d.day)
        )
      )
  )
  select s.habit_id, s.day, s.outcome from snapshotted s
  union all
  select l.habit_id, l.day, l.outcome from legacy l;
$$;

comment on function public.get_expected_habit_opportunities(date, date) is
  'Kanoniczny zbiór okazji dla serii, statystyk, obserwacji, ścieżek i prognoz. Dni bez day_plan używają kompatybilnego fallbacku.';

revoke all on function public.get_expected_habit_opportunities(date, date) from public;
grant execute on function public.get_expected_habit_opportunities(date, date)
  to authenticated, service_role;

-- Tworzenie i rekoncyliacja planu -------------------------------------------

create or replace function public.ensure_day_plan(p_plan_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_plan public.day_plans%rowtype;
  v_plan_exists boolean := false;
  v_today date;
  v_rest boolean;
  v_quiet boolean;
  v_minute_budget integer;
  v_candidate record;
  v_step integer;
  v_target numeric;
  v_minutes numeric;
  v_planned integer := 0;
  v_used_minutes numeric := 0;
  v_state text;
  v_reason text;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  select public.logical_today(v_user_id) into v_today;

  -- Istniejący historyczny snapshot wolno odczytać zawsze. Nowy powstaje
  -- tylko dla bieżącej lub niedawnej daty logicznej: dwie doby wystarczają
  -- kolejce offline i zmianie strefy, a nie pozwalają przepisywać historii.
  select * into v_plan
  from public.day_plans p
  where p.user_id = v_user_id
    and p.plan_date = p_plan_date;
  v_plan_exists := found;

  if not v_plan_exists and (p_plan_date < v_today - 2 or p_plan_date > v_today + 1) then
    raise exception 'plan date outside reconciliation window'
      using errcode = '22007';
  end if;

  v_rest := public.day_is_rest(v_user_id, p_plan_date);
  v_quiet := public.day_is_quiet(v_user_id, p_plan_date);
  v_minute_budget := public.allocated_window_minutes(v_user_id, p_plan_date);

  if not v_plan_exists then
    insert into public.day_plans (
      user_id,
      plan_date,
      daily_ceiling,
      minute_budget,
      timezone,
      day_start_hour,
      is_rest,
      is_quiet_week
    ) values (
      v_user_id,
      p_plan_date,
      v_profile.daily_ceiling,
      v_minute_budget,
      v_profile.timezone,
      v_profile.day_start_hour,
      v_rest,
      v_quiet
    )
    on conflict (user_id, plan_date) do update
      set updated_at = public.day_plans.updated_at
    returning * into v_plan;
  else
    update public.day_plans p
    set
      daily_ceiling = v_profile.daily_ceiling,
      minute_budget = v_minute_budget,
      timezone = v_profile.timezone,
      day_start_hour = v_profile.day_start_hour,
      is_rest = v_rest,
      is_quiet_week = v_quiet
    where p.id = v_plan.id
    returning * into v_plan;
  end if;

  -- Dodajemy brakujące nawyki deterministycznie. Snapshot celu liczy tryb
  -- completion z wykonań, a calendar z kanonicznych okazji sprzed tego dnia.
  for v_candidate in
    select h.*
    from public.habits h
    where h.user_id = v_user_id
      and h.archived_at is null
      and h.retired_at is null
      and h.started_on <= p_plan_date
      and public.habit_is_scheduled_on(
        h.schedule_type,
        h.schedule_days,
        p_plan_date
      )
      and not exists (
        select 1
        from public.day_plan_items i
        where i.day_plan_id = v_plan.id
          and i.habit_id = h.id
      )
    order by h.sort_order, h.id
  loop
    if v_candidate.progression_mode = 'completion' then
      select count(*)::integer into v_step
      from public.habit_logs l
      where l.habit_id = v_candidate.id
        and l.log_date < p_plan_date
        and l.status in ('done', 'partial');
    else
      select count(*)::integer into v_step
      from public.get_expected_habit_opportunities(
        v_candidate.started_on,
        p_plan_date - 1
      ) o
      where o.habit_id = v_candidate.id;
    end if;

    v_target := v_candidate.start_value
      + v_candidate.increment_value * greatest(v_step, 0);
    if v_candidate.target_value is not null then
      v_target := least(v_target, v_candidate.target_value);
    end if;
    v_target := greatest(v_target, 0);

    v_minutes := case v_candidate.unit
      when 'minutes' then v_target
      when 'seconds' then v_target / 60
      else 3
    end;

    insert into public.day_plan_items (
      day_plan_id,
      user_id,
      habit_id,
      plan_state,
      reason,
      sort_order,
      target_value,
      estimated_minutes
    ) values (
      v_plan.id,
      v_user_id,
      v_candidate.id,
      'overflow',
      'daily_ceiling',
      v_candidate.sort_order,
      v_target,
      v_minutes
    )
    on conflict (day_plan_id, habit_id) do nothing;
  end loop;

  -- Dzień neutralny ma wyższy priorytet niż wcześniejsza klasyfikacja.
  if v_plan.is_rest or v_plan.is_quiet_week then
    update public.day_plan_items i
    set
      plan_state = 'overflow',
      reason = case when v_plan.is_rest then 'rest' else 'quiet_week' end
    where i.day_plan_id = v_plan.id;
  else
    -- Nieaktywny nawyk nie tworzy długu. Wpis zostaje w snapshotcie, dzięki
    -- czemu done/skipped może pozostać widoczne w bieżącym dniu.
    update public.day_plan_items i
    set
      plan_state = 'overflow',
      reason = case
        when h.archived_at is not null then 'archived'
        when h.retired_at is not null then 'retired'
        else 'schedule_changed'
      end
    from public.habits h
    where i.day_plan_id = v_plan.id
      and h.id = i.habit_id
      and (
        h.archived_at is not null
        or h.retired_at is not null
        or not public.habit_is_scheduled_on(
          h.schedule_type,
          h.schedule_days,
          p_plan_date
        )
      );

    -- Pozycje już rozstrzygnięte zachowują swoją klasę podczas zmiany limitu.
    -- W szczególności completed planned nie znika po 3 -> 2, a completed
    -- overflow nie staje się obowiązkiem po 2 -> 4.
    select
      count(*)::integer,
      coalesce(sum(i.estimated_minutes), 0)
    into v_planned, v_used_minutes
    from public.day_plan_items i
    join public.habits h on h.id = i.habit_id
    join public.habit_logs l
      on l.habit_id = i.habit_id
     and l.log_date = p_plan_date
    where i.day_plan_id = v_plan.id
      and i.plan_state = 'planned'
      and h.archived_at is null
      and h.retired_at is null
      and public.habit_is_scheduled_on(
        h.schedule_type,
        h.schedule_days,
        p_plan_date
      );

    for v_candidate in
      select i.id, i.estimated_minutes
      from public.day_plan_items i
      join public.habits h on h.id = i.habit_id
      left join public.habit_logs l
        on l.habit_id = i.habit_id
       and l.log_date = p_plan_date
      where i.day_plan_id = v_plan.id
        and l.id is null
        and h.archived_at is null
        and h.retired_at is null
        and public.habit_is_scheduled_on(
          h.schedule_type,
          h.schedule_days,
          p_plan_date
        )
      order by
        i.estimated_minutes,
        i.sort_order,
        i.habit_id
    loop
      if v_planned >= v_plan.daily_ceiling then
        v_state := 'overflow';
        v_reason := 'daily_ceiling';
      elsif v_plan.minute_budget is not null
        and v_used_minutes + v_candidate.estimated_minutes > v_plan.minute_budget then
        v_state := 'overflow';
        v_reason := 'minute_budget';
      else
        v_state := 'planned';
        v_reason := 'within_limit';
        v_planned := v_planned + 1;
        v_used_minutes := v_used_minutes + v_candidate.estimated_minutes;
      end if;

      update public.day_plan_items i
      set plan_state = v_state, reason = v_reason
      where i.id = v_candidate.id;
    end loop;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'habit_id', i.habit_id,
        'plan_state', i.plan_state,
        'reason', i.reason,
        'sort_order', i.sort_order,
        'target_value', i.target_value,
        'estimated_minutes', i.estimated_minutes,
        'habit', to_jsonb(h)
      ) order by i.sort_order, h.title, i.habit_id
    ),
    '[]'::jsonb
  ) into v_items
  from public.day_plan_items i
  join public.habits h on h.id = i.habit_id
  where i.day_plan_id = v_plan.id;

  return jsonb_build_object(
    'id', v_plan.id,
    'user_id', v_plan.user_id,
    'plan_date', v_plan.plan_date,
    'daily_ceiling', v_plan.daily_ceiling,
    'minute_budget', v_plan.minute_budget,
    'timezone', v_plan.timezone,
    'day_start_hour', v_plan.day_start_hour,
    'is_rest', v_plan.is_rest,
    'is_quiet_week', v_plan.is_quiet_week,
    'items', v_items
  );
end;
$$;

comment on function public.ensure_day_plan(date) is
  'Idempotentnie tworzy lub rekoncyliuje snapshot daty logicznej i zwraca go z nawykami. Klient nie zapisuje skipped dla overflow.';

revoke all on function public.ensure_day_plan(date) from public;
grant execute on function public.ensure_day_plan(date) to authenticated, service_role;

-- Serie ---------------------------------------------------------------------

create or replace function public.get_habit_streak_for_day(
  p_habit_id uuid,
  p_today date
)
returns table (current_streak integer, longest_streak integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_habit public.habits%rowtype;
  v_opportunity record;
  v_running integer := 0;
  v_longest integer := 0;
begin
  select * into v_habit
  from public.habits h
  where h.id = p_habit_id;

  if not found then
    current_streak := 0;
    longest_streak := 0;
    return next;
    return;
  end if;

  for v_opportunity in
    select o.day, o.outcome
    from public.get_expected_habit_opportunities(v_habit.started_on, p_today) o
    where o.habit_id = p_habit_id
    order by o.day
  loop
    if v_opportunity.outcome = 'completed' then
      v_running := v_running + 1;
      v_longest := greatest(v_longest, v_running);
    elsif v_opportunity.outcome = 'skipped' then
      null;
    elsif v_opportunity.day = p_today then
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

comment on function public.get_habit_streak_for_day(uuid, date) is
  'Seria nawyku według kanonicznych okazji planu, dla jawnie podanej daty logicznej.';

create or replace function public.get_habits_streaks_for_day(p_today date)
returns table (habit_id uuid, current_streak integer, longest_streak integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, s.current_streak, s.longest_streak
  from public.habits h
  cross join lateral public.get_habit_streak_for_day(h.id, p_today) s
  where h.archived_at is null;
$$;

comment on function public.get_habits_streaks_for_day(date) is
  'Serie wszystkich niearchiwalnych nawyków według snapshotów planu i jawnej daty logicznej.';

-- Zachowujemy stare RPC jako wrappery dla starszego klienta. Nowy klient
-- zawsze przekazuje własną datę logiczną do wariantów *_for_day.
create or replace function public.get_habit_streak(p_habit_id uuid)
returns table (current_streak integer, longest_streak integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.get_habit_streak_for_day(
    p_habit_id,
    current_date
  );
$$;

create or replace function public.get_habits_streaks()
returns table (habit_id uuid, current_streak integer, longest_streak integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.get_habits_streaks_for_day(
    current_date
  );
$$;

revoke all on function public.get_habit_streak_for_day(uuid, date) from public;
grant execute on function public.get_habit_streak_for_day(uuid, date)
  to authenticated, service_role;
revoke all on function public.get_habits_streaks_for_day(date) from public;
grant execute on function public.get_habits_streaks_for_day(date)
  to authenticated, service_role;

-- Podsumowania, heatmapa i obserwacje ---------------------------------------

create or replace function public.get_daily_summary(p_from date, p_to date)
returns table (day date, scheduled integer, completed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  opportunities as (
    select * from public.get_expected_habit_opportunities(p_from, p_to)
  )
  select
    d.day,
    count(o.habit_id)::integer,
    count(o.habit_id) filter (where o.outcome = 'completed')::integer
  from days d
  left join opportunities o on o.day = d.day
  group by d.day
  order by d.day;
$$;

comment on function public.get_daily_summary(date, date) is
  'Zaplanowane i wykonane okazje według day_plan; overflow bez wykonania, rest i quiet week są neutralne.';

create or replace function public.get_habit_stats(p_today date)
returns table (
  habit_id uuid,
  scheduled_7 integer,
  completed_7 integer,
  scheduled_30 integer,
  completed_30 integer,
  current_streak integer,
  longest_streak integer,
  recent_days boolean[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with opportunities as (
    select *
    from public.get_expected_habit_opportunities(p_today - 29, p_today)
  )
  select
    h.id,
    count(o.day) filter (where o.day > p_today - 7)::integer,
    count(o.day) filter (
      where o.day > p_today - 7 and o.outcome = 'completed'
    )::integer,
    count(o.day)::integer,
    count(o.day) filter (where o.outcome = 'completed')::integer,
    s.current_streak,
    s.longest_streak,
    coalesce(
      array_agg((o.outcome = 'completed') order by o.day)
        filter (where o.day > p_today - 14),
      array[]::boolean[]
    )
  from public.habits h
  left join opportunities o on o.habit_id = h.id
  cross join lateral public.get_habit_streak_for_day(h.id, p_today) s
  where h.archived_at is null
    and h.retired_at is null
  group by h.id, h.sort_order, h.created_at, s.current_streak, s.longest_streak
  order by h.sort_order, h.created_at;
$$;

comment on function public.get_habit_stats(date) is
  'Statystyki nawyków według tej samej funkcji oczekiwanych okazji co serie i heatmapa.';

-- Historyczny krok progresji kalendarzowej pod prognozy. Przyszłość, dla
-- której snapshot jeszcze nie istnieje, nadal używa harmonogramu jako jawnego
-- fallbacku; przeszłość korzysta wyłącznie z kanonicznych okazji.
create or replace function public.get_habit_plan_progress(p_before date)
returns table (habit_id uuid, expected_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    h.id,
    count(o.day)::integer
  from public.habits h
  left join lateral public.get_expected_habit_opportunities(
    h.started_on,
    p_before - 1
  ) o on o.habit_id = h.id
  where h.archived_at is null
  group by h.id;
$$;

comment on function public.get_habit_plan_progress(date) is
  'Liczba oczekiwanych okazji sprzed daty, używana przez prognozy progresji calendar.';

revoke all on function public.get_habit_plan_progress(date) from public;
grant execute on function public.get_habit_plan_progress(date)
  to authenticated, service_role;

-- Ścieżki i obserwacje downshift również używają kanonicznych okazji -------

create or replace function public.get_path_completion_ratio(
  p_user_path_id uuid,
  p_today date,
  p_days integer default 14
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with practice_habits as (
    select upp.habit_id
    from public.user_path_practices upp
    where upp.user_path_id = p_user_path_id
  ),
  opportunities as (
    select o.*
    from public.get_expected_habit_opportunities(p_today - p_days, p_today - 1) o
    join practice_habits p on p.habit_id = o.habit_id
  )
  select case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where outcome = 'completed')::numeric / count(*),
      4
    )
  end
  from opportunities;
$$;

comment on function public.get_path_completion_ratio(uuid, date, integer) is
  'Udział wykonanych kanonicznych okazji praktyk ścieżki; overflow/rest/quiet bez wykonania nie obniżają wyniku.';

create or replace function public.habit_weekday_completion(
  p_habit_id uuid,
  p_days integer
)
returns table (dow smallint, scheduled integer, completed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with habit as (
    select h.*, public.logical_today(h.user_id) as today
    from public.habits h
    where h.id = p_habit_id
  ),
  opportunities as (
    select o.*
    from habit h
    cross join lateral public.get_expected_habit_opportunities(
      h.today - p_days,
      h.today - 1
    ) o
    where o.habit_id = h.id
  )
  select
    extract(dow from o.day)::smallint,
    count(*)::integer,
    count(*) filter (where o.outcome = 'completed')::integer
  from opportunities o
  group by 1
  order by 1;
$$;

comment on function public.habit_weekday_completion(uuid, integer) is
  'Wykonanie nawyku po dniach tygodnia według kanonicznych okazji planu.';
