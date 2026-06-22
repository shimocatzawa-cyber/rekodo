-- Security fix: profiles.spotify_access_token / spotify_refresh_token /
-- spotify_token_expiry are live Spotify OAuth credentials, but profiles
-- SELECT is otherwise intentionally public (`using (true)`, for public
-- profile pages) — RLS is row-level only, so it couldn't restrict this to
-- "just the safe columns". Anyone with the public anon key could read every
-- connected user's Spotify tokens directly via REST, bypassing the app
-- entirely — full account takeover for every connected user, not just a
-- rekōdo-side issue.
--
-- Column-level privileges (not RLS) are the right tool here: revoke
-- SELECT/UPDATE/INSERT on these three columns from anon and authenticated,
-- so the row-level "public" policy can no longer expose them regardless of
-- which row, while every other column on profiles keeps working exactly as
-- before. App code now reads/writes these columns through a service-role
-- client (src/lib/spotify.ts getProfileTokenDb()) instead of the user's own
-- session-scoped client — every call site was audited to confirm it always
-- operates on the caller's own verified id, never a client-supplied one
-- (this required fixing a latent gap in playlist/match-spotify-worker that
-- previously trusted a client-supplied userId untethered from its own auth).

revoke select (spotify_access_token, spotify_refresh_token, spotify_token_expiry),
       insert (spotify_access_token, spotify_refresh_token, spotify_token_expiry),
       update (spotify_access_token, spotify_refresh_token, spotify_token_expiry)
  on public.profiles from anon, authenticated;
