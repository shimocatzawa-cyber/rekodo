-- Pressing identifiers sourced from the Discogs full release API (Phase 5 backfill).
-- All nullable — populated progressively over successive syncs, never blocks core sync.
alter table public.records
  add column if not exists barcode      text,
  add column if not exists matrix       text[],
  add column if not exists edition_size integer;
