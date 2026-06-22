-- Security fix: "User records are publicly readable" (20260604000004) ORs
-- with the owner-only SELECT policy, making EVERY column of every user's
-- user_records row — valuation, condition notes, play history, feeling
-- tags — readable by anyone via direct REST, not just the record_id list
-- the public profile pages actually display. RLS is row-level only, so it
-- can't restrict this to "just the safe columns" on its own; views can,
-- since a view (owned by a privileged role) projects only the columns it
-- defines regardless of the querying role's own table-level restrictions.
--
-- Two narrow public views replace the blanket policy:
--   1. public_collection_summary — record_id only, for every owned record.
--      Used by public profile pages to show what someone owns.
--   2. public_sell_list — value/condition/price columns, but ONLY for rows
--      marked open_to_offers — matches what the Sell List feature already
--      intends, now enforced at the data layer instead of trusted to the
--      app's own .eq("open_to_offers", true) filter.

drop policy if exists "User records are publicly readable" on public.user_records;

create or replace view public.public_collection_summary as
  select user_id, record_id
  from public.user_records;

grant select on public.public_collection_summary to anon, authenticated;

create or replace view public.public_sell_list as
  select user_id, record_id, media_condition, sleeve_condition, value, price_median, price_currency, open_to_offers_at
  from public.user_records
  where open_to_offers = true;

grant select on public.public_sell_list to anon, authenticated;
