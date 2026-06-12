-- Wantlists can have hundreds of items; the ≤20 cap was intended for
-- curated Top-N lists and is enforced in app code there. Remove the
-- upper bound at the DB level so large Discogs imports don't fail.

alter table public.list_items
  drop constraint if exists list_items_position_check;

alter table public.list_items
  add constraint list_items_position_check
  check (position >= 1);
