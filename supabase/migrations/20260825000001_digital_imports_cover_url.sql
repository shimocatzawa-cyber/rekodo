-- Add cover_url column to digital_imports so Bandcamp artwork can be stored
-- at import time and served directly without scraping on every page load.
alter table digital_imports
  add column if not exists cover_url text;
