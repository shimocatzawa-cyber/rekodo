-- Store Discogs tracklist directly on records.
-- Populated during sync backfill (free — release data already fetched)
-- and lazily on first mixtape expand for records already synced.
alter table records
  add column if not exists discogs_tracks jsonb;

comment on column records.discogs_tracks is
  'Discogs tracklist: [{position, title, duration, type_}]. Populated during sync backfill or lazily on first mixtape use.';
