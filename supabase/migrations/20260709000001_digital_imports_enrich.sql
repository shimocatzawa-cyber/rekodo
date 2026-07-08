-- Enrich digital_imports with Bandcamp metadata captured at sync time
alter table digital_imports
  add column if not exists purchased_at  timestamptz,
  add column if not exists item_url      text,
  add column if not exists release_date  text,
  add column if not exists label         text,
  add column if not exists tags          text[];
