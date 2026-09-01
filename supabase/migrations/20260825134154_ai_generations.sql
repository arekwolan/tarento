-- Log wywołań modelu. Istnieje pod kontrolę kosztów, nie pod feature'y.

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('daily_plan', 'habit_suggestion')),
  model text not null,
  prompt_hash text,
  input_tokens integer,
  output_tokens integer,
  response jsonb,
  created_at timestamptz not null default now()
);

comment on table public.ai_generations is
  'Ślad po wywołaniach modelu. Zapisuje Edge Function (service_role),
   klient tylko czyta własną historię.';

create index ai_generations_user_id_created_at_idx
  on public.ai_generations (user_id, created_at desc);

-- RLS -----------------------------------------------------------------------

alter table public.ai_generations enable row level security;

create policy "ai_generations_select_own"
  on public.ai_generations for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Brak polityki INSERT celowo: gdyby klient mógł dopisywać wiersze, licznik
-- kosztów przestałby cokolwiek znaczyć. Wpisy robi Edge Function kluczem
-- service_role, który omija RLS.

-- Granty ---------------------------------------------------------------------
--
-- authenticated dostaje wyłącznie SELECT. Wiersze dopisuje Edge Function
-- kluczem service_role — inaczej licznik kosztów byłby sterowany z klienta.

revoke all on public.ai_generations from anon, authenticated;
grant all on public.ai_generations to service_role;
grant select on public.ai_generations to authenticated;
