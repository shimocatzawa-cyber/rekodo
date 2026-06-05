-- Add marketplace pricing columns to user_records.
-- Run in Supabase Dashboard → SQL Editor.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS price_last_sold  numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_low        numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_median     numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_high       numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_currency   text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS price_fetched_at timestamptz;
