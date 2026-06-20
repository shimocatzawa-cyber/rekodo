-- Spotify album/track matching for the AI playlist generator.
-- Adds match columns to `records` (album-level, shared across all owners)
-- and a parallel set directly on `list_items` for item_type='song' wantlist
-- rows that have no record_id to join through.

-- ── records (per-release, shared) ──────────────────────────────────────────
alter table records
  add column if not exists spotify_album_id   text,
  add column if not exists spotify_matched     boolean not null default false,
  add column if not exists spotify_tracks      jsonb,
  add column if not exists spotify_matched_at  timestamptz;

create index if not exists idx_records_spotify_unmatched
  on records (id)
  where spotify_matched_at is null;

-- ── list_items (song-type wantlist rows only — no record_id to join) ──────
alter table list_items
  add column if not exists spotify_album_id   text,
  add column if not exists spotify_matched     boolean not null default false,
  add column if not exists spotify_tracks      jsonb,
  add column if not exists spotify_matched_at  timestamptz;

create index if not exists idx_list_items_spotify_unmatched
  on list_items (id)
  where item_type = 'song' and spotify_matched_at is null;

comment on column records.spotify_tracks is
  'JSON array of {spotify_uri, title, track_number, duration_ms, preview_url} for every track on the matched album, written once at match time.';
comment on column list_items.spotify_tracks is
  'Same shape as records.spotify_tracks — only populated for item_type=''song'' rows (freeform wantlist songs with no record_id).';
