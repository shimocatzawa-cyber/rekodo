-- collection_value_snapshots only had a SELECT policy, so nothing but the
-- service-role Edge Function could ever write a row — and that write only
-- fires when the Discogs collection/value API call succeeds, which it
-- never has (table is empty for every user). Insights now records a
-- snapshot itself, using the same totalMed figure it displays, so it needs
-- to insert as the authenticated user.

CREATE POLICY "Users can insert own snapshots"
  ON collection_value_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
