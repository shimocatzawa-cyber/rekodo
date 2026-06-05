-- Add display_name and location to profiles.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS location     text;
