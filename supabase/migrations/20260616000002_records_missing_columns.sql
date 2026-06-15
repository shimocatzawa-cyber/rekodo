-- Three columns referenced in discogs-sync-processor but never migrated.
-- Their absence caused Phase 5 backfill to silently fail (PostgREST rejected
-- the .or() filter; the catch block swallowed the error).

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS styles            text[],
  ADD COLUMN IF NOT EXISTS discogs_artist_id integer,
  ADD COLUMN IF NOT EXISTS producers         text[];
