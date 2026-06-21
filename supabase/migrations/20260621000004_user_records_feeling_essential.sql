-- Documents columns already present in production (added outside tracked
-- migrations) so new environments provision them too. IF NOT EXISTS makes
-- this a no-op where they already exist.
alter table public.user_records add column if not exists is_essential boolean not null default false;
alter table public.user_records add column if not exists feeling text;
alter table public.user_records add column if not exists feeling_tagged_at timestamptz;
