-- Per-record "Memory" notes on the Collection detail panel — a free-text
-- note plus an opt-in flag for showing it on the public profile (rendering
-- shared memories there is a separate future task; this just persists the
-- flag). Both columns are opt-in and start null/false for existing rows,
-- no backfill needed. user_records has no column-level grant lockdown
-- (unlike profiles), so no additional grants are required here.

alter table user_records
  add column memory_text text,
  add column memory_shared boolean not null default false;
