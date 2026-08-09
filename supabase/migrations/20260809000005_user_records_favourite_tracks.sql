alter table public.user_records
  add column if not exists favourite_tracks text[] not null default '{}'::text[];
