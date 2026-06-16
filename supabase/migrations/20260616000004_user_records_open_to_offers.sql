-- Add open_to_offers flag to user_records, used by the Sell List feature
-- and the "Open to Offers" toggle on the collection page.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS open_to_offers    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_offers_at timestamptz;
