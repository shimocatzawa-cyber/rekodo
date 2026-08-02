ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS user_tags text[] NOT NULL DEFAULT '{}';
