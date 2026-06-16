-- user_records has SELECT/INSERT/DELETE policies but is missing UPDATE.
-- With RLS enabled and no matching UPDATE policy, updates silently affect
-- zero rows (no error) — this is why toggles like open_to_offers, media/sleeve
-- condition, and last_played_at appeared to save but never persisted.

CREATE POLICY "Users can update their own records"
  ON public.user_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
