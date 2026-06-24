-- Public view exposing only the columns needed to show a user's tagged
-- "essential" records on their public profile, mirroring the narrow-column
-- pattern already used by public_collection_summary / public_sell_list
-- (20260622000006_user_records_public_views.sql) rather than reopening
-- public read access to all of user_records.

create or replace view public.public_essentials as
  select user_id, record_id, date_added
  from public.user_records
  where is_essential = true;

grant select on public.public_essentials to anon, authenticated;
