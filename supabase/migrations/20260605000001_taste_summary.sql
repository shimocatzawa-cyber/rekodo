ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS taste_summary TEXT,
  ADD COLUMN IF NOT EXISTS taste_summary_count INT;
