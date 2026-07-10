-- Allow users to read their own activity events (e.g. for the Insights
-- "Plays · Last 7 days" stat). The existing SELECT policy only covers
-- followers reading followed-users' events; this adds the missing self-read.
create policy "Users can read their own activity"
  on public.activity_events for select
  using (auth.uid() = user_id);
