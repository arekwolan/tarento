-- W3: prywatna „Instrukcja obsługi siebie”.
--
-- Kandydaci powstają wyłącznie z zamkniętych, liczbowych wzorców. W bazie nie
-- zapisujemy notatek dnia, listów, nazw nawyków ani tekstowych dowodów transferu.

alter table public.day_plans
  add column day_kind text
  check (
    day_kind is null
    or day_kind in ('workday', 'free', 'night_shift', 'care', 'custom')
  );

comment on column public.day_plans.day_kind is
  'Typ doby zapisany od W3. Starsze plany pozostają NULL, aby nie wymyślać historii po zmianie rotacji.';

create or replace function public.day_kind_for_date(p_user_id uuid, p_day date)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select template.kind
  from public.day_rotations rotation
  join public.day_templates template
    on template.id = rotation.template_ids[
      1 + mod(
        mod(
          p_day - rotation.anchor_date,
          array_length(rotation.template_ids, 1)
        ) + array_length(rotation.template_ids, 1),
        array_length(rotation.template_ids, 1)
      )
    ]
  where rotation.user_id = p_user_id;
$$;

revoke all on function public.day_kind_for_date(uuid, date) from public;
grant execute on function public.day_kind_for_date(uuid, date)
  to authenticated, service_role;

create or replace function public.capture_day_plan_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.day_kind is null then
    new.day_kind := public.day_kind_for_date(new.user_id, new.plan_date);
  end if;
  return new;
end;
$$;

create trigger day_plans_capture_day_kind
  before insert or update of user_id, plan_date on public.day_plans
  for each row execute function public.capture_day_plan_kind();

create table public.self_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_key text not null check (char_length(rule_key) between 3 and 120),
  rule_type text not null check (
    rule_type in (
      'time_of_day',
      'target_size',
      'day_type',
      'friction',
      'minimal_version',
      'revision_outcome'
    )
  ),
  subject_habit_id uuid not null references public.habits (id) on delete cascade,
  status text not null default 'candidate' check (
    status in ('candidate', 'accepted', 'rejected', 'expired')
  ),
  algorithm_version text not null check (char_length(algorithm_version) between 1 and 40),
  conclusion_key text not null check (char_length(conclusion_key) between 1 and 40),
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot) = 'object'),
  evidence_hash text not null check (char_length(evidence_hash) = 32),
  sample_size integer not null check (sample_size >= 0),
  range_start date not null,
  range_end date not null,
  reevaluate_on date not null,
  review_required_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, rule_key, evidence_hash),
  constraint self_rules_range_check check (range_start <= range_end)
);

comment on table public.self_rules is
  'Prywatne hipotezy z deterministycznych wzorców. Evidence jest snapshotem liczników, nie diagnozą.';
comment on column public.self_rules.review_required_at is
  'Nowe dane przeczą zaakceptowanej regule. Oryginalny evidence pozostaje bez zmian.';

create unique index self_rules_one_accepted_idx
  on public.self_rules (user_id, rule_key)
  where status = 'accepted' and archived_at is null;
create index self_rules_user_status_review_idx
  on public.self_rules (user_id, status, review_required_at, created_at desc)
  where archived_at is null;
create index self_rules_habit_type_idx
  on public.self_rules (subject_habit_id, rule_type, created_at desc)
  where archived_at is null;

create trigger self_rules_set_updated_at
  before update on public.self_rules
  for each row execute function public.set_updated_at();

create table public.self_rule_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null,
  user_id uuid not null,
  event_type text not null check (
    event_type in (
      'generated',
      'accepted',
      'rejected',
      'expired',
      'review_required',
      'reviewed',
      'archived',
      'restored'
    )
  ),
  effective_on date not null,
  evidence_snapshot jsonb check (
    evidence_snapshot is null or jsonb_typeof(evidence_snapshot) = 'object'
  ),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint self_rule_events_rule_owner_fkey
    foreign key (rule_id, user_id)
    references public.self_rules (id, user_id)
    on delete cascade,
  unique (user_id, idempotency_key)
);

comment on table public.self_rule_events is
  'Append-only audyt wygenerowania, decyzji i rewaluacji prywatnej reguły.';

create index self_rule_events_rule_created_idx
  on public.self_rule_events (rule_id, created_at desc);
create index self_rule_events_user_effective_idx
  on public.self_rule_events (user_id, effective_on desc, created_at desc);

alter table public.self_rules enable row level security;
alter table public.self_rule_events enable row level security;

create policy "self_rules_select_own"
  on public.self_rules for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.habits habit
      where habit.id = self_rules.subject_habit_id
        and habit.user_id = (select auth.uid())
    )
  );

create policy "self_rule_events_select_via_parent"
  on public.self_rule_events for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.self_rules rule
      where rule.id = self_rule_events.rule_id
        and rule.user_id = (select auth.uid())
    )
  );

revoke all on public.self_rules from anon, authenticated;
revoke all on public.self_rule_events from anon, authenticated;
grant select on public.self_rules to authenticated;
grant select on public.self_rule_events to authenticated;
grant all on public.self_rules to service_role;
grant all on public.self_rule_events to service_role;

-- Prywatne, ustrukturyzowane fakty ------------------------------------------

create or replace function public.get_self_rule_evidence(p_from date, p_to date)
returns table (
  habit_id uuid,
  day date,
  outcome text,
  time_of_day text,
  target_value numeric,
  schedule_key text,
  day_kind text,
  revision_id uuid,
  revision_number integer,
  revision_source text,
  revision_reason text,
  is_minimal boolean,
  friction_reason text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with opportunities as (
    select *
    from public.get_expected_habit_opportunities(p_from, p_to)
  )
  select
    opportunity.habit_id,
    opportunity.day,
    opportunity.outcome,
    coalesce(revision.after_snapshot ->> 'time_of_day', habit.time_of_day),
    coalesce(
      plan_item.target_value,
      habit_log.target_value,
      (revision.after_snapshot ->> 'start_value')::numeric,
      habit.start_value
    ),
    concat_ws(
      ':',
      coalesce(revision.after_snapshot ->> 'schedule_type', habit.schedule_type),
      coalesce(revision.after_snapshot -> 'schedule_days', to_jsonb(habit.schedule_days))::text
    ),
    day_plan.day_kind,
    revision.id,
    revision.revision_number,
    revision.source,
    revision.reason,
    coalesce(
      revision.source in ('downshift', 'reentry')
      or revision.reason in ('difficult_period', 'reentry'),
      false
    ),
    friction.reason
  from opportunities opportunity
  join public.habits habit
    on habit.id = opportunity.habit_id
   and habit.user_id = (select auth.uid())
  left join lateral (
    select candidate.*
    from public.habit_revisions candidate
    where candidate.habit_id = opportunity.habit_id
      and candidate.effective_on <= opportunity.day
    order by candidate.effective_on desc, candidate.revision_number desc
    limit 1
  ) revision on true
  left join public.day_plans day_plan
    on day_plan.user_id = habit.user_id
   and day_plan.plan_date = opportunity.day
  left join public.day_plan_items plan_item
    on plan_item.day_plan_id = day_plan.id
   and plan_item.habit_id = opportunity.habit_id
  left join public.habit_logs habit_log
    on habit_log.habit_id = opportunity.habit_id
   and habit_log.log_date = opportunity.day
  left join public.habit_friction_events friction
    on friction.habit_id = opportunity.habit_id
   and friction.event_date = opportunity.day
   and friction.archived_at is null
  where p_to >= p_from
  order by opportunity.habit_id, opportunity.day;
$$;

comment on function public.get_self_rule_evidence(date, date) is
  'Kanoniczne okazje i zamknięte enumy dla W3. Celowo bez notatek, listów, nazw nawyków i tekstu transferu.';

revoke all on function public.get_self_rule_evidence(date, date) from public;
grant execute on function public.get_self_rule_evidence(date, date)
  to authenticated, service_role;

-- Walidacja zamkniętego katalogu -------------------------------------------

create or replace function public.self_rule_value_is_valid(
  p_rule_type text,
  p_value text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_rule_type
    when 'time_of_day' then p_value in ('morning', 'afternoon', 'evening')
    when 'target_size' then p_value in ('smaller', 'larger')
    when 'day_type' then p_value in ('workday', 'free', 'night_shift', 'care', 'custom')
    when 'friction' then p_value in (
      'forgot', 'no_time', 'too_big', 'wrong_time', 'environment', 'not_today'
    )
    when 'minimal_version' then p_value in ('minimal', 'standard')
    when 'revision_outcome' then p_value in ('before', 'after')
    else false
  end;
$$;

revoke all on function public.self_rule_value_is_valid(text, text) from public;
grant execute on function public.self_rule_value_is_valid(text, text)
  to authenticated, service_role;

-- Synchronizacja kandydatów jest naturalnie idempotentna: identyczny snapshot
-- ma UNIQUE hash, a status zmienia się tylko przy faktycznej zmianie dowodów.
create or replace function public.sync_self_rule_candidates(
  p_candidates jsonb,
  p_effective_on date
)
returns setof public.self_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_candidate jsonb;
  v_rule_type text;
  v_habit_id uuid;
  v_preferred text;
  v_comparison text;
  v_preferred_completed integer;
  v_preferred_opportunities integer;
  v_comparison_completed integer;
  v_comparison_opportunities integer;
  v_range_start date;
  v_range_end date;
  v_rule_key text;
  v_snapshot jsonb;
  v_hash text;
  v_existing public.self_rules%rowtype;
  v_inserted public.self_rules%rowtype;
begin
  if v_user_id is null then
    raise exception 'sync_self_rule_candidates: authentication required'
      using errcode = '42501';
  end if;
  if p_effective_on <> public.logical_today(v_user_id) then
    raise exception 'sync_self_rule_candidates: invalid logical date'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_candidates) <> 'array'
     or jsonb_array_length(p_candidates) > 24 then
    raise exception 'sync_self_rule_candidates: invalid candidates'
      using errcode = '22023';
  end if;

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    begin
      v_rule_type := v_candidate ->> 'rule_type';
      v_habit_id := (v_candidate ->> 'subject_habit_id')::uuid;
      v_preferred := v_candidate ->> 'preferred_value';
      v_comparison := nullif(v_candidate ->> 'comparison_value', '');
      v_preferred_completed := (v_candidate ->> 'preferred_completed')::integer;
      v_preferred_opportunities := (v_candidate ->> 'preferred_opportunities')::integer;
      v_comparison_completed := coalesce(
        (v_candidate ->> 'comparison_completed')::integer,
        0
      );
      v_comparison_opportunities := coalesce(
        (v_candidate ->> 'comparison_opportunities')::integer,
        0
      );
      v_range_start := (v_candidate ->> 'range_start')::date;
      v_range_end := (v_candidate ->> 'range_end')::date;
    exception when others then
      raise exception 'sync_self_rule_candidates: invalid candidate shape'
        using errcode = '22023';
    end;

    if not exists (
      select 1 from public.habits habit
      where habit.id = v_habit_id and habit.user_id = v_user_id
    ) then
      raise exception 'sync_self_rule_candidates: habit not found'
        using errcode = 'P0002';
    end if;
    if not public.self_rule_value_is_valid(v_rule_type, v_preferred)
       or (v_comparison is not null
           and not public.self_rule_value_is_valid(v_rule_type, v_comparison))
       or v_range_start > v_range_end
       or v_range_end >= p_effective_on
       or v_preferred_completed < 0
       or v_preferred_opportunities < v_preferred_completed
       or v_comparison_completed < 0
       or v_comparison_opportunities < v_comparison_completed then
      raise exception 'sync_self_rule_candidates: invalid evidence'
        using errcode = '22023';
    end if;

    if v_rule_type = 'friction' then
      if v_comparison is not null
         or v_preferred_opportunities < 3
         or v_comparison_opportunities <> 0 then
        raise exception 'sync_self_rule_candidates: insufficient evidence'
          using errcode = '22023';
      end if;
    else
      if v_comparison is null
         or v_preferred = v_comparison
         or v_preferred_opportunities < 6
         or v_comparison_opportunities < 6
         or v_preferred_completed::numeric / v_preferred_opportunities
              <= v_comparison_completed::numeric / v_comparison_opportunities
         or (
           v_preferred_completed::numeric / v_preferred_opportunities
           - v_comparison_completed::numeric / v_comparison_opportunities
         ) < 0.20 then
        raise exception 'sync_self_rule_candidates: insufficient evidence'
          using errcode = '22023';
      end if;
    end if;

    v_rule_key := concat(v_rule_type, ':', v_habit_id::text);
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'algorithm_version', 'self-rules-v1',
      'rule_type', v_rule_type,
      'subject_habit_id', v_habit_id,
      'preferred_value', v_preferred,
      'comparison_value', v_comparison,
      'preferred_completed', v_preferred_completed,
      'preferred_opportunities', v_preferred_opportunities,
      'comparison_completed', v_comparison_completed,
      'comparison_opportunities', v_comparison_opportunities,
      'range_start', v_range_start,
      'range_end', v_range_end
    ));
    v_hash := md5(v_snapshot::text);

    select rule.* into v_existing
    from public.self_rules rule
    where rule.user_id = v_user_id
      and rule.rule_key = v_rule_key
      and rule.evidence_hash = v_hash
      and rule.archived_at is null;
    if found then
      continue;
    end if;

    select rule.* into v_existing
    from public.self_rules rule
    where rule.user_id = v_user_id
      and rule.rule_key = v_rule_key
      and rule.status = 'accepted'
      and rule.archived_at is null
    for update;

    if found then
      if v_existing.conclusion_key <> v_preferred then
        if v_existing.review_required_at is null then
          update public.self_rules rule
          set review_required_at = now(), reevaluate_on = p_effective_on
          where rule.id = v_existing.id;

          insert into public.self_rule_events (
            rule_id, user_id, event_type, effective_on, evidence_snapshot,
            idempotency_key
          ) values (
            v_existing.id, v_user_id, 'review_required', p_effective_on,
            v_snapshot || jsonb_build_object('evidence_hash', v_hash),
            gen_random_uuid()
          );
        end if;
      elsif v_existing.reevaluate_on <= p_effective_on then
        update public.self_rules rule
        set reevaluate_on = p_effective_on + 30
        where rule.id = v_existing.id;

        insert into public.self_rule_events (
          rule_id, user_id, event_type, effective_on, evidence_snapshot,
          idempotency_key
        ) values (
          v_existing.id, v_user_id, 'reviewed', p_effective_on,
          v_snapshot || jsonb_build_object('evidence_hash', v_hash),
          gen_random_uuid()
        );
      end if;
      continue;
    end if;

    if exists (
      select 1
      from public.self_rules rule
      where rule.user_id = v_user_id
        and rule.rule_key = v_rule_key
        and rule.status = 'rejected'
        and rule.archived_at is null
        and rule.reevaluate_on > p_effective_on
    ) then
      continue;
    end if;

    with expired as (
      update public.self_rules rule
      set status = 'expired'
      where rule.user_id = v_user_id
        and rule.rule_key = v_rule_key
        and rule.status in ('candidate', 'rejected')
        and rule.archived_at is null
      returning rule.id
    )
    insert into public.self_rule_events (
      rule_id, user_id, event_type, effective_on, idempotency_key
    )
    select expired.id, v_user_id, 'expired', p_effective_on, gen_random_uuid()
    from expired;

    insert into public.self_rules (
      user_id, rule_key, rule_type, subject_habit_id, status,
      algorithm_version, conclusion_key, evidence_snapshot, evidence_hash,
      sample_size, range_start, range_end, reevaluate_on
    ) values (
      v_user_id, v_rule_key, v_rule_type, v_habit_id, 'candidate',
      'self-rules-v1', v_preferred, v_snapshot, v_hash,
      v_preferred_opportunities + v_comparison_opportunities,
      v_range_start, v_range_end, p_effective_on + 30
    )
    on conflict (user_id, rule_key, evidence_hash) do nothing
    returning * into v_inserted;

    if v_inserted.id is not null then
      insert into public.self_rule_events (
        rule_id, user_id, event_type, effective_on, evidence_snapshot,
        idempotency_key
      ) values (
        v_inserted.id, v_user_id, 'generated', p_effective_on,
        v_snapshot, gen_random_uuid()
      );
    end if;
  end loop;

  return query
  select rule.*
  from public.self_rules rule
  where rule.user_id = v_user_id
    and rule.archived_at is null
  order by
    case rule.status when 'candidate' then 0 when 'accepted' then 1 else 2 end,
    rule.created_at desc;
end;
$$;

create or replace function public.decide_self_rule(
  p_rule_id uuid,
  p_action text,
  p_effective_on date,
  p_idempotency_key uuid
)
returns public.self_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rule public.self_rules%rowtype;
  v_event public.self_rule_events%rowtype;
  v_event_type text;
begin
  if v_user_id is null then
    raise exception 'decide_self_rule: authentication required'
      using errcode = '42501';
  end if;
  if p_effective_on <> public.logical_today(v_user_id)
     or p_action not in ('accept', 'reject', 'review_keep', 'expire') then
    raise exception 'decide_self_rule: invalid decision'
      using errcode = '22023';
  end if;

  select event.* into v_event
  from public.self_rule_events event
  where event.user_id = v_user_id
    and event.idempotency_key = p_idempotency_key;
  if found then
    if v_event.rule_id <> p_rule_id
       or v_event.evidence_snapshot ->> 'action' <> p_action then
      raise exception 'decide_self_rule: idempotency key reused'
        using errcode = '22023';
    end if;
    select rule.* into v_rule from public.self_rules rule where rule.id = p_rule_id;
    return v_rule;
  end if;

  select rule.* into v_rule
  from public.self_rules rule
  where rule.id = p_rule_id
    and rule.user_id = v_user_id
    and rule.archived_at is null
  for update;
  if not found then
    raise exception 'decide_self_rule: rule not found' using errcode = 'P0002';
  end if;

  if p_action = 'accept' then
    if v_rule.status not in ('candidate', 'accepted') then
      raise exception 'decide_self_rule: stale rule state' using errcode = '40001';
    end if;

    with expired as (
      update public.self_rules rule
      set status = 'expired'
      where rule.user_id = v_user_id
        and rule.rule_key = v_rule.rule_key
        and rule.id <> v_rule.id
        and rule.status = 'accepted'
        and rule.archived_at is null
      returning rule.id
    )
    insert into public.self_rule_events (
      rule_id, user_id, event_type, effective_on, idempotency_key
    )
    select expired.id, v_user_id, 'expired', p_effective_on, gen_random_uuid()
    from expired;

    update public.self_rules rule
    set status = 'accepted', review_required_at = null,
        reevaluate_on = p_effective_on + 30
    where rule.id = v_rule.id
    returning * into v_rule;
    v_event_type := 'accepted';
  elsif p_action = 'reject' then
    if v_rule.status not in ('candidate', 'accepted') then
      raise exception 'decide_self_rule: stale rule state' using errcode = '40001';
    end if;
    update public.self_rules rule
    set status = 'rejected', review_required_at = null,
        reevaluate_on = p_effective_on + 30
    where rule.id = v_rule.id
    returning * into v_rule;
    v_event_type := 'rejected';
  elsif p_action = 'review_keep' then
    if v_rule.status <> 'accepted' or v_rule.review_required_at is null then
      raise exception 'decide_self_rule: stale rule state' using errcode = '40001';
    end if;
    update public.self_rules rule
    set review_required_at = null, reevaluate_on = p_effective_on + 30
    where rule.id = v_rule.id
    returning * into v_rule;
    v_event_type := 'reviewed';
  else
    update public.self_rules rule
    set status = 'expired', review_required_at = null
    where rule.id = v_rule.id
    returning * into v_rule;
    v_event_type := 'expired';
  end if;

  insert into public.self_rule_events (
    rule_id, user_id, event_type, effective_on, evidence_snapshot,
    idempotency_key
  ) values (
    v_rule.id, v_user_id, v_event_type, p_effective_on,
    jsonb_build_object('action', p_action), p_idempotency_key
  );

  return v_rule;
end;
$$;

create or replace function public.set_self_rule_archived(
  p_rule_id uuid,
  p_archived boolean,
  p_effective_on date,
  p_idempotency_key uuid
)
returns public.self_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rule public.self_rules%rowtype;
  v_event public.self_rule_events%rowtype;
  v_action text := case when p_archived then 'archived' else 'restored' end;
begin
  if v_user_id is null then
    raise exception 'set_self_rule_archived: authentication required'
      using errcode = '42501';
  end if;
  if p_effective_on <> public.logical_today(v_user_id) then
    raise exception 'set_self_rule_archived: invalid logical date'
      using errcode = '22023';
  end if;

  select event.* into v_event
  from public.self_rule_events event
  where event.user_id = v_user_id
    and event.idempotency_key = p_idempotency_key;
  if found then
    if v_event.rule_id <> p_rule_id or v_event.event_type <> v_action then
      raise exception 'set_self_rule_archived: idempotency key reused'
        using errcode = '22023';
    end if;
    select rule.* into v_rule from public.self_rules rule where rule.id = p_rule_id;
    return v_rule;
  end if;

  select rule.* into v_rule
  from public.self_rules rule
  where rule.id = p_rule_id and rule.user_id = v_user_id
  for update;
  if not found then
    raise exception 'set_self_rule_archived: rule not found' using errcode = 'P0002';
  end if;
  if (p_archived and v_rule.archived_at is not null)
     or (not p_archived and v_rule.archived_at is null) then
    raise exception 'set_self_rule_archived: stale rule state' using errcode = '40001';
  end if;

  update public.self_rules rule
  set archived_at = case when p_archived then now() else null end
  where rule.id = p_rule_id
  returning * into v_rule;

  insert into public.self_rule_events (
    rule_id, user_id, event_type, effective_on, evidence_snapshot,
    idempotency_key
  ) values (
    v_rule.id, v_user_id, v_action, p_effective_on,
    jsonb_build_object('archived', p_archived), p_idempotency_key
  );

  return v_rule;
end;
$$;

revoke all on function public.sync_self_rule_candidates(jsonb, date) from public;
grant execute on function public.sync_self_rule_candidates(jsonb, date)
  to authenticated, service_role;
revoke all on function public.decide_self_rule(uuid, text, date, uuid) from public;
grant execute on function public.decide_self_rule(uuid, text, date, uuid)
  to authenticated, service_role;
revoke all on function public.set_self_rule_archived(uuid, boolean, date, uuid)
  from public;
grant execute on function public.set_self_rule_archived(uuid, boolean, date, uuid)
  to authenticated, service_role;
