-- W5: prywatny radar konfliktów przed aktywacją protokołu książkowego.
-- Teksty notatek pozostają w book_lab_notes. Tabele poniżej przechowują
-- identyfikatory, zamknięte enumy i prywatny, neutralny opis sugestii AI.

create table public.protocol_conflict_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  path_id uuid not null references public.paths (id) on delete cascade,
  request_key uuid not null,
  input_fingerprint text not null check (char_length(input_fingerprint) = 32),
  state_fingerprint text not null check (char_length(state_fingerprint) = 32),
  status text not null default 'scanning'
    check (status in ('scanning', 'ready', 'applied', 'archived')),
  semantic_status text not null default 'pending'
    check (semantic_status in ('pending', 'complete', 'unavailable', 'not_needed')),
  algorithm_version text not null check (
    char_length(algorithm_version) between 1 and 40
  ),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, request_key),
  unique (id, owner_id)
);

comment on table public.protocol_conflict_reviews is
  'Idempotentny review prywatnego protokołu. Bez tytułów, treści notatek i nazw praktyk.';

create index protocol_conflict_reviews_owner_created_idx
  on public.protocol_conflict_reviews (owner_id, created_at desc)
  where archived_at is null;

create trigger protocol_conflict_reviews_set_updated_at
  before update on public.protocol_conflict_reviews
  for each row execute function public.set_updated_at();

create table public.protocol_conflicts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  conflict_key text not null check (char_length(conflict_key) between 1 and 320),
  conflict_type text not null check (
    conflict_type in ('capacity', 'execution', 'rule')
  ),
  stage_id uuid references public.path_stages (id) on delete cascade,
  incoming_practice_id uuid references public.path_practices (id) on delete cascade,
  existing_habit_id uuid references public.habits (id) on delete cascade,
  note_a_id uuid references public.book_lab_notes (id) on delete cascade,
  note_b_id uuid references public.book_lab_notes (id) on delete cascade,
  description text check (
    description is null or char_length(btrim(description)) between 1 and 180
  ),
  confidence text check (
    confidence is null or confidence in ('low', 'medium', 'high')
  ),
  day_kinds text[],
  time_of_day text check (
    time_of_day is null or time_of_day in ('morning', 'afternoon', 'evening')
  ),
  required_minutes smallint check (required_minutes is null or required_minutes >= 0),
  available_minutes smallint check (available_minutes is null or available_minutes >= 0),
  decision text check (
    decision is null or decision in ('context_split', 'reject_incoming', 'reject_existing')
  ),
  context_a text check (
    context_a is null or context_a in (
      'workday', 'free', 'night_shift', 'care', 'custom',
      'morning', 'afternoon', 'evening'
    )
  ),
  context_b text check (
    context_b is null or context_b in (
      'workday', 'free', 'night_shift', 'care', 'custom',
      'morning', 'afternoon', 'evening'
    )
  ),
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, conflict_key),
  constraint protocol_conflicts_review_owner_fkey
    foreign key (review_id, owner_id)
    references public.protocol_conflict_reviews (id, owner_id)
    on delete cascade,
  constraint protocol_conflicts_shape_check check (
    (
      conflict_type = 'rule'
      and note_a_id is not null
      and note_b_id is not null
      and description is not null
      and confidence is not null
    )
    or (
      conflict_type in ('capacity', 'execution')
      and stage_id is not null
      and incoming_practice_id is not null
      and note_a_id is null
      and note_b_id is null
      and description is null
      and confidence is null
    )
  ),
  constraint protocol_conflicts_resolution_check check (
    (
      decision = 'context_split'
      and conflict_type = 'rule'
      and context_a is not null
      and context_b is not null
      and context_a <> context_b
    )
    or (
      decision in ('reject_incoming', 'reject_existing')
      and context_a is null
      and context_b is null
    )
    or (
      decision is null
      and context_a is null
      and context_b is null
      and resolved_at is null
    )
  )
);

comment on table public.protocol_conflicts is
  'Strukturalne kolizje i prywatne sugestie semantyczne. Detektor nie zapisuje decyzji.';

create index protocol_conflicts_review_idx
  on public.protocol_conflicts (review_id, conflict_type)
  where archived_at is null;

create table public.book_lab_note_contexts (
  note_id uuid primary key references public.book_lab_notes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  context_value text not null check (context_value in (
    'workday', 'free', 'night_shift', 'care', 'custom',
    'morning', 'afternoon', 'evening'
  )),
  source_conflict_id uuid not null references public.protocol_conflicts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.book_lab_note_contexts is
  'Jawnie wybrany, pojedynczy kontekst prywatnej notatki. Nigdy decyzja detektora.';

create trigger book_lab_note_contexts_set_updated_at
  before update on public.book_lab_note_contexts
  for each row execute function public.set_updated_at();

create table public.path_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  request_key uuid not null,
  path_id uuid not null references public.paths (id) on delete cascade,
  review_id uuid references public.protocol_conflict_reviews (id) on delete set null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  user_path_id uuid unique references public.user_paths (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, request_key)
);

comment on table public.path_enrollment_requests is
  'Idempotencja aktywacji. Retry po utracie odpowiedzi zwraca ten sam user_path_id.';

-- RLS ---------------------------------------------------------------------

alter table public.protocol_conflict_reviews enable row level security;
alter table public.protocol_conflicts enable row level security;
alter table public.book_lab_note_contexts enable row level security;
alter table public.path_enrollment_requests enable row level security;

create policy "protocol_conflict_reviews_select_own"
  on public.protocol_conflict_reviews for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "protocol_conflicts_select_own"
  on public.protocol_conflicts for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.protocol_conflict_reviews review
      where review.id = protocol_conflicts.review_id
        and review.owner_id = (select auth.uid())
    )
  );

create policy "book_lab_note_contexts_select_own"
  on public.book_lab_note_contexts for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.book_lab_notes note
      where note.id = book_lab_note_contexts.note_id
        and note.owner_id = (select auth.uid())
    )
  );

create policy "path_enrollment_requests_select_own"
  on public.path_enrollment_requests for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.protocol_conflict_reviews from anon, authenticated;
revoke all on public.protocol_conflicts from anon, authenticated;
revoke all on public.book_lab_note_contexts from anon, authenticated;
revoke all on public.path_enrollment_requests from anon, authenticated;
grant all on public.protocol_conflict_reviews to service_role;
grant all on public.protocol_conflicts to service_role;
grant all on public.book_lab_note_contexts to service_role;
grant all on public.path_enrollment_requests to service_role;
grant select on public.protocol_conflict_reviews to authenticated;
grant select on public.protocol_conflicts to authenticated;
grant select on public.book_lab_note_contexts to authenticated;
grant select on public.path_enrollment_requests to authenticated;

-- Stan strukturalny i pełny cykl day-type × dzień tygodnia ----------------

create or replace function public.protocol_conflict_state_fingerprint(
  p_user_id uuid,
  p_path_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(
    p_path_id::text || '|'
    || coalesce((
      select string_agg(
        stage.id::text || ':' || stage.ordinal::text || ':'
        || stage.daily_minutes_p50::text || ':'
        || md5(coalesce(stage.environment_setup, '')),
        ',' order by stage.ordinal
      )
      from public.path_stages stage
      where stage.path_id = p_path_id
    ), '') || '|'
    || coalesce((
      select string_agg(
        practice.id::text || ':' || practice.stage_id::text || ':'
        || practice.start_value::text || ':' || practice.schedule_type || ':'
        || coalesce(practice.schedule_days::text, '') || ':'
        || coalesce(practice.time_of_day, '') || ':'
        || coalesce(practice.source_note_ordinals::text, ''),
        ',' order by practice.id
      )
      from public.path_practices practice
      join public.path_stages stage on stage.id = practice.stage_id
      where stage.path_id = p_path_id
    ), '') || '|'
    || coalesce((
      select string_agg(
        note.id::text || ':' || md5(note.content) || ':'
        || coalesce(note.archived_at::text, ''),
        ',' order by note.id
      )
      from public.book_lab_projects project
      join public.book_lab_notes note on note.project_id = project.id
      where project.owner_id = p_user_id and project.path_id = p_path_id
    ), '') || '|'
    || coalesce((
      select string_agg(
        habit.id::text || ':' || habit.updated_at::text || ':'
        || habit.schedule_type || ':' || coalesce(habit.schedule_days::text, '')
        || ':' || coalesce(habit.time_of_day, '') || ':' || habit.start_value::text,
        ',' order by habit.id
      )
      from public.habits habit
      where habit.user_id = p_user_id
        and habit.archived_at is null
        and habit.retired_at is null
    ), '') || '|'
    || coalesce((
      select string_agg(
        template.id::text || ':' || template.updated_at::text || ':'
        || template.kind || ':' || template.self_minutes::text,
        ',' order by template.id
      )
      from public.day_templates template
      where template.user_id = p_user_id and template.archived_at is null
    ), '') || '|'
    || coalesce((
      select string_agg(
        block.id::text || ':' || block.template_id::text || ':'
        || block.start_time::text || ':' || block.end_time::text || ':'
        || block.kind,
        ',' order by block.id
      )
      from public.day_blocks block
      where block.user_id = p_user_id and block.archived_at is null
    ), '') || '|'
    || coalesce((
      select rotation.updated_at::text || ':' || rotation.anchor_date::text
        || ':' || rotation.template_ids::text
      from public.day_rotations rotation
      where rotation.user_id = p_user_id
    ), '')
  );
$$;

create or replace function public.protocol_conflict_day_slots(p_user_id uuid)
returns table (
  slot_date date,
  day_of_week smallint,
  day_kind text,
  available_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    day.value::date,
    extract(dow from day.value)::smallint,
    coalesce(public.day_kind_for_date(p_user_id, day.value::date), 'custom'),
    coalesce(public.allocated_window_minutes(p_user_id, day.value::date), 30)
  from generate_series(
    public.logical_today(p_user_id),
    public.logical_today(p_user_id) + 195,
    interval '1 day'
  ) day(value);
$$;

revoke all on function public.protocol_conflict_state_fingerprint(uuid, uuid) from public;
revoke all on function public.protocol_conflict_day_slots(uuid) from public;
grant execute on function public.protocol_conflict_state_fingerprint(uuid, uuid)
  to service_role;
grant execute on function public.protocol_conflict_day_slots(uuid)
  to service_role;

-- Decyzja użytkownika; opis AI nigdy nie wywołuje tej funkcji --------------

create or replace function public.resolve_protocol_conflict(
  p_review_id uuid,
  p_conflict_id uuid,
  p_decision text,
  p_context_a text default null,
  p_context_b text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_conflict public.protocol_conflicts%rowtype;
begin
  if v_user_id is null then
    raise exception 'resolve_protocol_conflict: authentication required'
      using errcode = '28000';
  end if;

  select conflict.* into v_conflict
  from public.protocol_conflicts conflict
  join public.protocol_conflict_reviews review on review.id = conflict.review_id
  where conflict.id = p_conflict_id
    and conflict.review_id = p_review_id
    and conflict.owner_id = v_user_id
    and review.owner_id = v_user_id
    and review.status = 'ready'
    and conflict.archived_at is null
  for update of conflict;

  if not found then
    raise exception 'resolve_protocol_conflict: conflict not found'
      using errcode = 'P0002';
  end if;

  if p_decision not in ('context_split', 'reject_incoming', 'reject_existing')
     or (p_decision = 'context_split' and (
       v_conflict.conflict_type <> 'rule'
       or p_context_a is null
       or p_context_b is null
       or p_context_a = p_context_b
       or p_context_a not in (
         'workday', 'free', 'night_shift', 'care', 'custom',
         'morning', 'afternoon', 'evening'
       )
       or p_context_b not in (
         'workday', 'free', 'night_shift', 'care', 'custom',
         'morning', 'afternoon', 'evening'
       )
     ))
     or (p_decision <> 'context_split' and (
       p_context_a is not null or p_context_b is not null
     ))
     or (p_decision = 'reject_existing' and v_conflict.existing_habit_id is null)
  then
    raise exception 'resolve_protocol_conflict: invalid decision'
      using errcode = '22023';
  end if;

  update public.protocol_conflicts
  set decision = p_decision,
      context_a = case when p_decision = 'context_split' then p_context_a end,
      context_b = case when p_decision = 'context_split' then p_context_b end,
      resolved_at = now()
  where id = v_conflict.id
  returning * into v_conflict;

  if p_decision = 'context_split' then
    insert into public.book_lab_note_contexts (
      note_id, owner_id, context_value, source_conflict_id
    ) values
      (v_conflict.note_a_id, v_user_id, p_context_a, v_conflict.id),
      (v_conflict.note_b_id, v_user_id, p_context_b, v_conflict.id)
    on conflict (note_id) do update
    set context_value = excluded.context_value,
        source_conflict_id = excluded.source_conflict_id;
  end if;

  return to_jsonb(v_conflict);
end;
$$;

revoke all on function public.resolve_protocol_conflict(uuid, uuid, text, text, text)
  from public;
grant execute on function public.resolve_protocol_conflict(uuid, uuid, text, text, text)
  to authenticated, service_role;

-- Prywatny protokół wolno materializować tylko z zatwierdzonego review.
create or replace function public.validate_user_path_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path public.paths%rowtype;
  v_free integer;
  v_first_stage_minutes integer;
begin
  if (select auth.uid()) is not null
     and new.user_id <> (select auth.uid()) then
    raise exception 'user_path_parent: użytkownik nie jest właścicielem wpisu'
      using errcode = '42501';
  end if;

  select * into v_path from public.paths where id = new.path_id;

  if not found
     or v_path.archived_at is not null
     or (v_path.owner_id is null and not v_path.is_published)
     or (v_path.owner_id is not null and v_path.owner_id <> new.user_id) then
    raise exception 'user_path_parent: ścieżka nie jest dostępna'
      using errcode = '42501';
  end if;

  if v_path.origin_kind = 'private' then
    if nullif(current_setting('tarento.protocol_conflict_path', true), '')
       is distinct from new.path_id::text then
      raise exception 'user_path_parent: wymagany przegląd konfliktów'
        using errcode = '23514';
    end if;

    v_free := public.book_lab_free_minutes(new.user_id);
    select stage.daily_minutes_p50 into v_first_stage_minutes
    from public.path_stages stage
    where stage.path_id = v_path.id
    order by stage.ordinal
    limit 1;

    if v_first_stage_minutes is null
       or v_first_stage_minutes > floor(
         v_free * public.book_lab_safe_budget_ratio()
       ) then
      raise exception 'user_path_parent: prywatny protokół nie mieści się w aktualnym budżecie'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enroll_in_path_reviewed(
  p_request_id uuid,
  p_path_id uuid,
  p_review_id uuid,
  p_lite boolean,
  p_today date,
  p_skip_practice_ids uuid[],
  p_fit jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_path public.paths%rowtype;
  v_review public.protocol_conflict_reviews%rowtype;
  v_request public.path_enrollment_requests%rowtype;
  v_user_path_id uuid;
  v_fingerprint text := md5(
    p_path_id::text || '|' || coalesce(p_review_id::text, '') || '|'
    || p_lite::text || '|' || p_today::text || '|'
    || coalesce(p_skip_practice_ids::text, '') || '|' || coalesce(p_fit::text, '')
  );
  v_conflict record;
begin
  if v_user_id is null then
    raise exception 'enroll_in_path_reviewed: authentication required'
      using errcode = '28000';
  end if;

  insert into public.path_enrollment_requests (
    owner_id, request_key, path_id, review_id, request_fingerprint
  ) values (v_user_id, p_request_id, p_path_id, p_review_id, v_fingerprint)
  on conflict (owner_id, request_key) do nothing;

  select * into v_request
  from public.path_enrollment_requests request
  where request.owner_id = v_user_id and request.request_key = p_request_id
  for update;

  if v_request.request_fingerprint <> v_fingerprint then
    raise exception 'enroll_in_path_reviewed: idempotency key reused'
      using errcode = '22023';
  end if;
  if v_request.user_path_id is not null then
    return v_request.user_path_id;
  end if;

  select * into v_path from public.paths path
  where path.id = p_path_id
    and path.archived_at is null
    and (path.owner_id is null or path.owner_id = v_user_id);
  if not found then
    raise exception 'enroll_in_path_reviewed: path not found'
      using errcode = 'P0002';
  end if;

  if v_path.origin_kind = 'private' then
    select * into v_review
    from public.protocol_conflict_reviews review
    where review.id = p_review_id
      and review.owner_id = v_user_id
      and review.path_id = p_path_id
      and review.status = 'ready'
      and review.archived_at is null
    for update;

    if not found
       or v_review.state_fingerprint <> public.protocol_conflict_state_fingerprint(
         v_user_id, p_path_id
       ) then
      raise exception 'enroll_in_path_reviewed: review missing or stale'
        using errcode = '40001';
    end if;

    if exists (
      select 1 from public.protocol_conflicts conflict
      where conflict.review_id = v_review.id
        and conflict.archived_at is null
        and conflict.decision is null
    ) then
      raise exception 'enroll_in_path_reviewed: unresolved conflicts'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.protocol_conflicts conflict
      where conflict.review_id = v_review.id
        and conflict.archived_at is null
        and conflict.decision = 'reject_incoming'
    ) then
      raise exception 'enroll_in_path_reviewed: incoming practice rejected'
        using errcode = '23514';
    end if;

    for v_conflict in
      select conflict.id, conflict.existing_habit_id
      from public.protocol_conflicts conflict
      where conflict.review_id = v_review.id
        and conflict.archived_at is null
        and conflict.decision = 'reject_existing'
    loop
      perform public.set_habit_lifecycle_with_revision(
        v_conflict.existing_habit_id,
        'retired',
        p_today,
        v_conflict.id,
        null
      );
    end loop;

    perform set_config('tarento.protocol_conflict_path', p_path_id::text, true);
  end if;

  v_user_path_id := public.enroll_in_path(
    p_path_id,
    p_lite,
    p_today,
    coalesce(p_skip_practice_ids, '{}'::uuid[]),
    coalesce(p_fit, '{}'::jsonb)
  );

  update public.path_enrollment_requests
  set user_path_id = v_user_path_id
  where id = v_request.id;

  if v_path.origin_kind = 'private' then
    update public.protocol_conflict_reviews
    set status = 'applied'
    where id = v_review.id;
  end if;

  return v_user_path_id;
end;
$$;

revoke all on function public.enroll_in_path_reviewed(
  uuid, uuid, uuid, boolean, date, uuid[], jsonb
) from public;
grant execute on function public.enroll_in_path_reviewed(
  uuid, uuid, uuid, boolean, date, uuid[], jsonb
) to authenticated, service_role;
