-- Track how many copies of each pressing a user owns.
-- Discogs lets collectors add multiple instances of the same release; rekodo
-- previously deduplicated these to a single user_records row, making the
-- collection total incorrect for dealers or multi-copy collectors.
-- The copies column stores that count so totals stay accurate without
-- changing the unique (user_id, record_id) constraint.

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS copies smallint NOT NULL DEFAULT 1;

-- Expose copies through the narrow public view so profile pages can sum it.
CREATE OR REPLACE VIEW public.public_collection_summary AS
  SELECT user_id, record_id, copies
  FROM public.user_records;

GRANT SELECT ON public.public_collection_summary TO anon, authenticated;
