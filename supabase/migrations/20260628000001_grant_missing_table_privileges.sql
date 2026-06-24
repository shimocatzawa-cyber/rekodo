-- RLS policies alone don't grant access — Postgres requires the base table
-- GRANT before RLS gets a chance to filter rows (see 20260627000001 for the
-- deep_dive_favorites case that surfaced this). These tables all have RLS
-- policies already declaring an intended access pattern, but were created
-- without the matching GRANT, so every client-side read/write against them
-- was silently rejected with "permission denied for table" — each grant
-- below matches exactly what that table's existing policies already permit,
-- nothing broader.
--
-- Deliberately excludes discogs_tokens and payments — those need a careful
-- RLS review before granting anything, given what they hold.

-- Read-only for the authenticated user's own rows (writes go through a
-- security-definer RPC or service role, which bypass grants entirely):
grant select on public.api_daily_usage    to authenticated;
grant select on public.compatibility_scores to authenticated;
grant select on public.deep_dive_cache    to authenticated;
grant select on public.deep_dive_sessions to authenticated;
grant select on public.dig_daily_count    to authenticated;

-- Own-row read + insert:
grant select, insert on public.dig_history to authenticated;

-- Shared cache, open to any authenticated user per its existing policies:
grant select, insert, update on public.gig_cache to authenticated;

-- Followers can read, owner can insert — matches its two existing policies
-- exactly (no update/delete policy exists for this table):
grant select, insert on public.activity_events to authenticated;

-- Full own-row CRUD, matching each table's existing "manage own rows" policy:
grant select, insert, update, delete on public.archetype_cache     to authenticated;
grant select, insert, update, delete on public.taste_profile_cache to authenticated;
grant select, insert, update, delete on public.user_quiz_profile   to authenticated;
grant select, insert, update, delete on public.wantlist            to authenticated;
