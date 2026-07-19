-- Add Spotify matching columns to digital_imports so the playlist generator
-- can match and persist results the same way it does for records/list_items.
alter table digital_imports
  add column if not exists spotify_album_id   text,
  add column if not exists spotify_matched    boolean,
  add column if not exists spotify_matched_at timestamptz,
  add column if not exists spotify_tracks     jsonb;

-- Fast lookup for unmatched imports during on-demand top-up
create index if not exists digital_imports_unmatched_idx
  on digital_imports (user_id)
  where spotify_matched_at is null;
