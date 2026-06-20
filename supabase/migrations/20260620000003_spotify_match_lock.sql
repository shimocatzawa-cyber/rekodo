-- Lightweight lock so the client's periodic re-trigger (see PlaylistTab.tsx)
-- can't spin up multiple overlapping match-spotify-worker invocations for the
-- same user at once — concurrent runs were hammering Spotify's API together
-- and causing cascading 429s/timeouts. TTL-based (no cleanup guarantee needed):
-- a stale lock from a crashed/killed invocation simply expires on its own.
alter table profiles
  add column if not exists spotify_match_lock_at timestamptz;
