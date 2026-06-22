-- Security fix: the sync_queue UPDATE policy was `USING (true)` with no
-- ownership check — the comment says it's meant for the service role (which
-- bypasses RLS entirely and doesn't need a policy at all), but with no `TO
-- service_role` clause it actually applied to every authenticated user,
-- letting any user update any other user's sync job row (status, progress
-- counters, error_message).

drop policy if exists "Service role can update sync jobs" on sync_queue;

create policy "Users can update own sync jobs" on sync_queue
  for update using (auth.uid() = user_id);
