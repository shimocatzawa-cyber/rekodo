ALTER TABLE records
  ADD COLUMN IF NOT EXISTS community_have         INT,
  ADD COLUMN IF NOT EXISTS community_want         INT,
  ADD COLUMN IF NOT EXISTS community_num_for_sale INT,
  ADD COLUMN IF NOT EXISTS community_fetched_at   TIMESTAMPTZ;
