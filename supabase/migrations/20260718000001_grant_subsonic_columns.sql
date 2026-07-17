-- Grant SELECT on the new Bandcamp Subsonic columns to authenticated.
-- bandcamp_subsonic_token is intentionally excluded: it contains the
-- AES-256-GCM encrypted password and must only be read by service_role
-- (the API routes that decrypt it server-side).

grant select (
  bandcamp_subsonic_username,
  bandcamp_subsonic_synced_at
) on public.profiles to authenticated;
