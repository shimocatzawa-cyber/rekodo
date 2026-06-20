-- Tracks recently-recommended albums so "Regenerate" on the Taste Profile
-- card doesn't suggest the same album (or cycle between a couple) repeatedly.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS taste_summary_history JSONB NOT NULL DEFAULT '[]'::jsonb;
