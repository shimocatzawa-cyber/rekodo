-- Add highlights, start time, and duration to gigs

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS highlight_moment    TEXT,
  ADD COLUMN IF NOT EXISTS highlight_best_song TEXT,
  ADD COLUMN IF NOT EXISTS highlight_sound     TEXT,
  ADD COLUMN IF NOT EXISTS start_time          TEXT,
  ADD COLUMN IF NOT EXISTS duration            TEXT;
