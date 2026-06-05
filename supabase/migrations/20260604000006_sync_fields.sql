-- Sync fields added 2026-06-04
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.user_records
  ADD COLUMN IF NOT EXISTS removed_from_discogs boolean NOT NULL DEFAULT false;
