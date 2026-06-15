-- Capture when the user added each record to their Discogs collection.
-- Per-user field (not a property of the record itself).

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS date_added timestamptz;
