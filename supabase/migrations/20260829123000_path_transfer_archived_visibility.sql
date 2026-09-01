-- Miękko usunięta odpowiedź zostaje w audycie systemowym, ale znika również
-- na poziomie RLS, nie tylko przez filtr produktowy klienta.

drop policy if exists "path_transfer_responses_select_own_parent"
  on public.path_transfer_responses;

create policy "path_transfer_responses_select_own_parent"
  on public.path_transfer_responses for select
  to authenticated
  using (
    archived_at is null
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.user_paths up
      where up.id = path_transfer_responses.user_path_id
        and up.user_id = (select auth.uid())
    )
  );
