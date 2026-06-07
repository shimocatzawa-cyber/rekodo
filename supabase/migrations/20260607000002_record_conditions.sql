-- Add per-copy media and sleeve condition columns to user_records.
-- These are user-specific (condition of your copy, not the canonical release).
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS media_condition  text,
  ADD COLUMN IF NOT EXISTS sleeve_condition text;
