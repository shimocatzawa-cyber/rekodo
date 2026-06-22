-- 20260622000007's column-level REVOKE was a no-op: anon/authenticated hold
-- TABLE-LEVEL SELECT/INSERT/UPDATE on profiles (Supabase's default grant
-- pattern, relying on RLS for row-level restriction), and a column-level
-- REVOKE cannot narrow a table-level grant in Postgres — whichever grant is
-- broader wins. Confirmed live: a direct anon-key REST call could still read
-- spotify_access_token/spotify_refresh_token after that migration applied.
--
-- The actual fix: revoke the table-level grants entirely, then re-grant
-- column-level SELECT/INSERT/UPDATE for every column EXCEPT the three
-- Spotify token columns. This is the verified, complete column list as of
-- this migration (see the inspection migrations immediately prior) — every
-- column genuinely existing on profiles right now, deliberately excluding
-- spotify_access_token, spotify_refresh_token, spotify_token_expiry.

revoke select, insert, update on public.profiles from anon, authenticated;

grant select (
  id, username, created_at, display_name, location, bio, last_synced_at,
  avatar_url, is_public, taste_summary, taste_summary_count, is_donor, city,
  country, country_code, star_sign, collection_value_low, collection_value_med,
  collection_value_high, collection_value_currency, collection_value_at,
  collection_photos, bandcamp_username, role, subscription_tier,
  spotify_connected, spotify_display_name, spotify_product, is_supporter,
  stripe_customer_id, taste_summary_history, spotify_match_lock_at
) on public.profiles to anon, authenticated;

grant insert (
  id, username, created_at, display_name, location, bio, last_synced_at,
  avatar_url, is_public, taste_summary, taste_summary_count, is_donor, city,
  country, country_code, star_sign, collection_value_low, collection_value_med,
  collection_value_high, collection_value_currency, collection_value_at,
  collection_photos, bandcamp_username, role, subscription_tier,
  spotify_connected, spotify_display_name, spotify_product, is_supporter,
  stripe_customer_id, taste_summary_history, spotify_match_lock_at
) on public.profiles to authenticated;

grant update (
  id, username, created_at, display_name, location, bio, last_synced_at,
  avatar_url, is_public, taste_summary, taste_summary_count, is_donor, city,
  country, country_code, star_sign, collection_value_low, collection_value_med,
  collection_value_high, collection_value_currency, collection_value_at,
  collection_photos, bandcamp_username, role, subscription_tier,
  spotify_connected, spotify_display_name, spotify_product, is_supporter,
  stripe_customer_id, taste_summary_history, spotify_match_lock_at
) on public.profiles to authenticated;
